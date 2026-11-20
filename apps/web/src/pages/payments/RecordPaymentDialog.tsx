import { zodResolver } from '@hookform/resolvers/zod';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useSession } from '@/auth/context';
import { CustomerPicker, type PickedCustomer } from '@/components/CustomerPicker';
import { FormField } from '@/components/FormField';
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
import type { CustomerPayment, Paginated, SalesOrderListItem } from '@/lib/types';
import { PAYMENT_METHODS, checkAmount, localToday, paidAtForApi } from './payment-form';

const ON_ACCOUNT = 'none';

/** An order the payment can be applied to: billed, with money still outstanding. */
export interface PayableOrder {
  id: number;
  number: string;
  outstanding: string;
}

// Mirrors RecordCustomerPaymentDto in apps/api (payments.module.ts).
const schema = (t: TFunction<'payments'>) =>
  z.object({
    customer: z.custom<PickedCustomer | null>().refine((c) => Boolean(c), t('validation.customer')),
    orderId: z.string(),
    amount: z.string().trim().refine((v) => checkAmount(v) === 'ok', t('validation.amount')),
    method: z.enum(PAYMENT_METHODS),
    paidAt: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= localToday(), t('validation.date')),
    reference: z.string().trim().max(100, t('validation.tooLong')),
    notes: z.string().trim().max(255, t('validation.tooLong')),
  });
type Values = z.infer<ReturnType<typeof schema>>;

const defaults = (customer?: PickedCustomer, order?: PayableOrder): Values => ({
  customer: customer ?? null,
  orderId: order ? String(order.id) : ON_ACCOUNT,
  amount: order ? String(Number(order.outstanding)) : '',
  method: 'CASH',
  paidAt: localToday(),
  reference: '',
  notes: '',
});

/** Billed orders of one customer that still have money outstanding, oldest first. */
async function fetchPayableOrders(customerId: number): Promise<PayableOrder[]> {
  const pages = await Promise.all(
    (['CONFIRMED', 'DELIVERED'] as const).map(
      async (status) =>
        (await api.get<Paginated<SalesOrderListItem>>('/sales-orders', { params: { customerId, status, pageSize: 100 } })).data.data,
    ),
  );
  return pages
    .flat()
    .filter((o) => Number(o.outstanding) > 0)
    .toSorted((a, b) => a.orderDate.localeCompare(b.orderDate) || a.id - b.id)
    .map((o) => ({ id: o.id, number: o.number, outstanding: o.outstanding }));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preset and locked (opened from a customer or an order page). */
  customer?: PickedCustomer;
  /** Preset and locked (opened from an order page); requires `customer`. */
  order?: PayableOrder;
}

const MUTATION_KEY = ['record-payment'];

/** Records a customer payment, optionally applied to one billed order. Every role may do this. */
export function RecordPaymentDialog({ open, onOpenChange, customer, order }: Props) {
  const { t } = useTranslation('payments');
  const saving = useIsMutating({ mutationKey: MUTATION_KEY }) > 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
        </DialogHeader>
        {/* Radix mounts the content only while open, so each opening starts a fresh form. */}
        <PaymentForm customer={customer} order={order} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({ customer, order, onDone }: Pick<Props, 'customer' | 'order'> & { onDone: () => void }) {
  const { t, i18n } = useTranslation('payments');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const qc = useQueryClient();

  const resolver = useMemo(() => zodResolver(schema(t)), [t]);
  const form = useForm<Values>({ resolver, defaultValues: defaults(customer, order) });

  const picked = useWatch({ control: form.control, name: 'customer' });
  const orderId = useWatch({ control: form.control, name: 'orderId' });

  const payable = useQuery({
    queryKey: ['sales-orders', 'payable', picked?.id],
    queryFn: () => fetchPayableOrders(picked!.id),
    enabled: !order && picked !== null,
  });
  const orders = order ? [order] : (payable.data ?? []);
  const selected = orders.find((o) => String(o.id) === orderId);

  const save = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: async (v: Values) => {
      const body = {
        customerId: v.customer!.id,
        ...(v.orderId !== ON_ACCOUNT ? { salesOrderId: Number(v.orderId) } : {}),
        amount: Number(v.amount),
        method: v.method,
        paidAt: paidAtForApi(v.paidAt),
        reference: v.reference || undefined,
        notes: v.notes || undefined,
      };
      return (await api.post<CustomerPayment>('/payments/customer', body)).data;
    },
    onSuccess: (p) => {
      toast.success(t('form.recorded', { amount: money(p.amount) }));
      // A payment changes balances, order payment status, statements and the dashboard.
      for (const key of ['payments', 'customers', 'sales-orders', 'dashboard']) void qc.invalidateQueries({ queryKey: [key] });
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
  const customerLocked = Boolean(customer);
  const showOrders = order !== undefined || picked !== null;

  return (
    <>
      <form id="payment-form" noValidate onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" data-invalid={errors.customer ? true : undefined}>
          <FieldLabel htmlFor="pay-customer">{t('form.customer')}</FieldLabel>
          {customerLocked ? (
            <p id="pay-customer" className="font-medium">
              {customer!.name}
            </p>
          ) : (
            <Controller
              control={form.control}
              name="customer"
              render={({ field }) => (
                <CustomerPicker
                  id="pay-customer"
                  value={field.value}
                  invalid={Boolean(errors.customer)}
                  onChange={(c) => {
                    field.onChange(c);
                    form.setValue('orderId', ON_ACCOUNT);
                  }}
                />
              )}
            />
          )}
          {picked?.balance !== undefined ? (
            <FieldDescription className="tabular text-xs">{t('form.balance', { amount: money(picked.balance) })}</FieldDescription>
          ) : null}
          {errors.customer ? <FieldError>{String(errors.customer.message ?? '')}</FieldError> : null}
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
              <FieldDescription>{t('form.noOpenOrders')}</FieldDescription>
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
          <FieldLabel htmlFor="pay-date">{t('form.paidAt')}</FieldLabel>
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
