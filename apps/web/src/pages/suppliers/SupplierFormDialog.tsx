import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toastError } from '@/lib/notify';
import type { Supplier } from '@/lib/types';

const EMAIL = z.email();

// Mirrors PartyDto / UpdateSupplierDto in apps/api (parties.module.ts).
const schema = (t: TFunction<'suppliers'>) => {
  const optional = (max: number) => z.string().trim().max(max, t('validation.tooLong'));
  return z.object({
    name: z.string().trim().min(1, t('validation.required')).max(160, t('validation.tooLong')),
    phone: optional(40),
    email: optional(190).refine((v) => v === '' || EMAIL.safeParse(v).success, t('validation.email')),
    address: optional(255),
    taxNumber: optional(60),
    notes: optional(2000),
    isActive: z.boolean(),
  });
};
type Values = z.infer<ReturnType<typeof schema>>;

const toValues = (s?: Supplier): Values => ({
  name: s?.name ?? '',
  phone: s?.phone ?? '',
  email: s?.email ?? '',
  address: s?.address ?? '',
  taxNumber: s?.taxNumber ?? '',
  notes: s?.notes ?? '',
  isActive: s?.isActive ?? true,
});

// Empty optional fields are sent as null so an edit can clear them.
const orNull = (v: string) => (v === '' ? null : v);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
  onCreated?: (s: Supplier) => void;
}

/** Create or edit a supplier (manager and owner; the API enforces it). */
export function SupplierFormDialog({ open, onOpenChange, supplier, onCreated }: Props) {
  const { t } = useTranslation('suppliers');
  const { t: tc } = useTranslation();
  const qc = useQueryClient();
  const editing = Boolean(supplier);

  const resolver = useMemo(() => zodResolver(schema(t)), [t]);
  const form = useForm<Values>({ resolver, defaultValues: toValues(supplier) });

  useEffect(() => {
    if (open) form.reset(toValues(supplier));
  }, [open, supplier, form]);

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const body = {
        name: v.name,
        phone: orNull(v.phone),
        email: orNull(v.email),
        address: orNull(v.address),
        taxNumber: orNull(v.taxNumber),
        notes: orNull(v.notes),
      };
      if (supplier) return (await api.patch<Supplier>(`/suppliers/${supplier.id}`, { ...body, isActive: v.isActive })).data;
      return (await api.post<Supplier>('/suppliers', body)).data;
    },
    onSuccess: (saved) => {
      toast.success(editing ? tc('status.saved') : t('created'));
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      onOpenChange(false);
      if (!editing) onCreated?.(saved);
    },
    onError: toastError,
  });

  const notesError = form.formState.errors.notes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('addTitle')}</DialogTitle>
        </DialogHeader>
        <form id="supplier-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField form={form} name="name" label={t('fields.name')} autoComplete="off" />
          </div>
          <FormField form={form} name="phone" label={t('fields.phone')} type="tel" dir="ltr" className="text-start" autoComplete="off" />
          <FormField form={form} name="email" label={t('fields.email')} type="email" dir="ltr" className="text-start" autoComplete="off" />
          <div className="sm:col-span-2">
            <FormField form={form} name="address" label={t('fields.address')} autoComplete="off" />
          </div>
          <FormField form={form} name="taxNumber" label={t('fields.taxNumber')} dir="ltr" className="text-start" autoComplete="off" />
          <Field className="sm:col-span-2" data-invalid={notesError ? true : undefined}>
            <FieldLabel htmlFor="f-notes">{t('fields.notes')}</FieldLabel>
            <Textarea id="f-notes" rows={3} aria-invalid={notesError ? true : undefined} {...form.register('notes')} />
            {notesError ? <FieldError>{String(notesError.message ?? '')}</FieldError> : null}
          </Field>
          {editing ? (
            <Field orientation="horizontal" className="items-center sm:col-span-2">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => <Checkbox id="f-isActive" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
              />
              <FieldLabel htmlFor="f-isActive">{t('fields.isActive')}</FieldLabel>
            </Field>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="supplier-form" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null}
            {tc('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
