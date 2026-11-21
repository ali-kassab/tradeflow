import { zodResolver } from '@hookform/resolvers/zod';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useSession } from '@/auth/context';
import { CustomerPicker } from '@/components/CustomerPicker';
import { FormField } from '@/components/FormField';
import { SupplierPicker } from '@/components/SupplierPicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { api, errorCode, errorDetails } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { toastError } from '@/lib/notify';
import type { CustomerPayment } from '@/lib/types';
import { PAYMENT_METHODS, checkAmount, localToday, paidAtForApi } from './payment-form';
import { KINDS, type PartyKind, type PayableOrder, type PickedParty, fetchPayableOrders } from './payment-kinds';

export type { PayableOrder } from './payment-kinds';

const ON_ACCOUNT = 'none';

// Mirrors RecordCustomerPaymentDto / RecordSupplierPaymentDto in apps/api (payments.module.ts).
const schema = (t: TFunction<'payments'>, kind: PartyKind) =>
  z.object({
    party: z.custom<PickedParty | null>().refine((c) => Boolean(c), t(`party.${kind}.validation`)),
    orderId: z.string(),
    amount: z.string().trim().refine((v) => checkAmount(v) === 'ok', t('validation.amount')),
    method: z.enum(PAYMENT_METHODS),
    paidAt: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= localToday(), t('validation.date')),
    reference: z.string().trim().max(100, t('validation.tooLong')),
    notes: z.string().trim().max(255, t('validation.tooLong')),
  });
type Values = z.infer<ReturnType<typeof schema>>;

const defaults = (party?: PickedParty, order?: PayableOrder): Values => ({
  party: party ?? null,
  orderId: order ? String(order.id) : ON_ACCOUNT,
  amount: order ? String(Number(order.outstanding)) : '',
  method: 'CASH',
  paidAt: localToday(),
  reference: '',
  notes: '',
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Customer payments (default; every role) or supplier payments (manager+, enforced by the API). */
  kind?: PartyKind;
  /** Preset and locked (opened from a party or an order page). */
  party?: PickedParty;
  /** Preset and locked (opened from an order page); requires `party`. */
  order?: PayableOrder;
}

const MUTATION_KEY = ['record-payment'];

/** Records a customer or supplier payment, optionally applied to one billed order. */
export function RecordPaymentDialog({ open, onOpenChange, kind = 'customer', party, order }: Props) {
  const { t } = useTranslation('payments');
  const saving = useIsMutating({ mutationKey: MUTATION_KEY }) > 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
        </DialogHeader>
        {/* Radix mounts the content only while open, so each opening starts a fresh form. */}
        <PaymentForm kind={kind} party={party} order={order} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({ kind, party, order, onDone }: Pick<Props, 'party' | 'order'> & { kind: PartyKind; onDone: () => void }) {
  const { t, i18n } = useTranslation('payments');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const qc = useQueryClient();
  const k = KINDS[kind];

  const resolver = useMemo(() => zodResolver(schema(t, kind)), [t, kind]);
  const form = useForm<Values>({ resolver, defaultValues: defaults(party, order) });

  const picked = useWatch({ control: form.control, name: 'party' });
  const orderId = useWatch({ control: form.control, name: 'orderId' });

  const payable = useQuery({
    queryKey: [k.orderPath.slice(1), 'payable', picked?.id],
    queryFn: () => fetchPayableOrders(kind, picked!.id),
    enabled: !order && picked !== null,
  });
  const orders = order ? [order] : (payable.data ?? []);
  const selected = orders.find((o) => String(o.id) === orderId);

  const save = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: async (v: Values) => {
      const body = {
        [`${kind}Id`]: v.party!.id,
        ...(v.orderId !== ON_ACCOUNT ? { [k.orderField]: Number(v.orderId) } : {}),
        amount: Number(v.amount),
        method: v.method,
        paidAt: paidAtForApi(v.paidAt),
        reference: v.reference || undefined,
        notes: v.notes || undefined,
      };
      // Both endpoints answer with the stored payment; only `amount` is read here.
      return (await api.post<Pick<CustomerPayment, 'amount'>>(k.endpoint, body)).data;
    },
    onSuccess: (p) => {
      toast.success(t('form.recorded', { amount: money(p.amount) }));
      // A payment changes balances, order payment status, statements and the dashboard.
      for (const key of k.invalidate) void qc.invalidateQueries({ queryKey: [key] });
      onDone();
    },
    onError: (e) => {
      if (errorCode(e) === 'AMOUNT_EXCEEDS_OUTSTANDING') {
        // Someone else paid part of the order meanwhile: show the server's figure and refresh the list.
        const outstanding = errorDetails<{ outstanding: string }>(e)?.outstanding;
        form.setError('amount', { message: t('validation.exceeds', { amount: outstanding ? money(outstanding) : '' }) });
        void payable.refetch();
        return;
      }
      toastError(e);
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    if (selected && checkAmount(v.amount, selected.outstanding) === 'exceeds') {
      form.setError('amount', { message: t('validation.exceeds', { amount: money(selected.outstanding) }) });
      return;
    }
    save.mutate(v);
  });

  const { errors } = form.formState;
  const showOrders = order !== undefined || picked !== null;
  const Picker = kind === 'customer' ? CustomerPicker : SupplierPicker;

  return (
    <>
      <form id="payment-form" noValidate onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" data-invalid={errors.party ? true : undefined}>
          <FieldLabel htmlFor="pay-party">{t(`party.${kind}.field`)}</FieldLabel>
          {party ? (
            <p id="pay-party" className="font-medium">
              {party.name}
            </p>
          ) : (
            <Controller
              control={form.control}
              name="party"
              render={({ field }) => (
                <Picker
                  id="pay-party"
                  value={field.value}
                  invalid={Boolean(errors.party)}
                  onChange={(c: PickedParty) => {
                    field.onChange(c);
                    form.setValue('orderId', ON_ACCOUNT);
                  }}
                />
              )}
            />
          )}
          {picked?.balance !== undefined ? (
            <FieldDescription className="tabular text-xs">{t(`party.${kind}.balance`, { amount: money(picked.balance) })}</FieldDescription>
          ) : null}
          {errors.party ? <FieldError>{String(errors.party.message ?? '')}</FieldError> : null}
        </Field>

        {showOrders ? (
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="pay-order">{t('form.order')}</FieldLabel>
            {order ? (
              <p id="pay-order" className="tabular font-medium" dir="ltr">
                <span className="block text-start">{order.number}</span>
              </p>
            ) : payable.isPending ? (
              <Spinner />
            ) : orders.length === 0 ? (
              <FieldDescription>{t(`party.${kind}.noOpenOrders`)}</FieldDescription>
            ) : (
              <Controller
                control={form.control}
                name="orderId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pay-order" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ON_ACCOUNT}>{t('onAccount')}</SelectItem>
                      {orders.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          <span className="tabular" dir="ltr">
                            {o.number}
                          </span>
                          <span className="text-muted-foreground tabular">{money(o.outstanding)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {selected ? (
              <FieldDescription className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className="tabular">{t('form.outstanding', { number: selected.number, amount: money(selected.outstanding) })}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => form.setValue('amount', String(Number(selected.outstanding)), { shouldValidate: true })}
                >
                  {t('form.payInFull')}
                </Button>
              </FieldDescription>
            ) : !order && orders.length > 0 ? (
              <FieldDescription className="text-xs">{t('form.orderHint')}</FieldDescription>
            ) : null}
          </Field>
        ) : null}

        <FormField form={form} name="amount" label={t('form.amount')} inputMode="decimal" dir="ltr" className="tabular text-start" autoComplete="off" />
        <Field>
          <FieldLabel htmlFor="pay-method">{t('form.method')}</FieldLabel>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="pay-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {tc(`paymentMethod.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field data-invalid={errors.paidAt ? true : undefined}>
          <FieldLabel htmlFor="pay-date">{t(`party.${kind}.paidAt`)}</FieldLabel>
          <Input id="pay-date" type="date" max={localToday()} className="tabular" aria-invalid={errors.paidAt ? true : undefined} {...form.register('paidAt')} />
          {errors.paidAt ? <FieldError>{String(errors.paidAt.message ?? '')}</FieldError> : null}
        </Field>
        <div>
          <FormField form={form} name="reference" label={t('form.reference')} dir="ltr" className="text-start" autoComplete="off" />
        </div>
        <FieldDescription className="-mt-2 text-xs sm:col-span-2">{t('form.referenceHint')}</FieldDescription>
        <Field className="sm:col-span-2" data-invalid={errors.notes ? true : undefined}>
          <FieldLabel htmlFor="pay-notes">{t('form.notes')}</FieldLabel>
          <Textarea id="pay-notes" rows={2} aria-invalid={errors.notes ? true : undefined} {...form.register('notes')} />
          {errors.notes ? <FieldError>{String(errors.notes.message ?? '')}</FieldError> : null}
        </Field>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          {tc('actions.cancel')}
        </Button>
        <Button type="submit" form="payment-form" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {t('form.submit')}
        </Button>
      </DialogFooter>
    </>
  );
}
