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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { api, errorCode } from '@/lib/api';
import { toastError } from '@/lib/notify';
import type { Category, Product } from '@/lib/types';

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const WHOLE = /^\d{1,8}$/;
const NO_CATEGORY = 'none';

// Mirrors CreateProductDto / UpdateProductDto in apps/api (catalog.dto.ts).
const schema = (t: TFunction<'products'>) =>
  z.object({
    sku: z.string().trim().regex(/^[A-Za-z0-9._-]{1,60}$/, t('validation.sku')),
    name: z.string().trim().min(1, t('validation.required')).max(160, t('validation.tooLong')),
    unit: z.string().trim().min(1, t('validation.required')).max(30, t('validation.tooLong')),
    categoryId: z.string(),
    salePrice: z.string().trim().regex(MONEY, t('validation.money')),
    costPrice: z.string().trim().regex(MONEY, t('validation.money')),
    reorderLevel: z.string().trim().regex(WHOLE, t('validation.wholeNumber')),
    openingStock: z.string().trim().regex(WHOLE, t('validation.wholeNumber')),
    isActive: z.boolean(),
  });
type Values = z.infer<ReturnType<typeof schema>>;

const toValues = (p?: Product): Values => ({
  sku: p?.sku ?? '',
  name: p?.name ?? '',
  unit: p?.unit ?? 'piece',
  categoryId: p?.categoryId ? String(p.categoryId) : NO_CATEGORY,
  salePrice: p ? String(Number(p.salePrice)) : '',
  costPrice: p?.costPrice !== undefined ? String(Number(p.costPrice)) : '0',
  reorderLevel: String(p?.reorderLevel ?? 0),
  openingStock: '0',
  isActive: p?.isActive ?? true,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  categories: Category[];
}

/** Create or edit a product. Only rendered for OWNER/MANAGER (the API enforces it too). */
export function ProductFormDialog({ open, onOpenChange, product, categories }: Props) {
  const { t } = useTranslation('products');
  const { t: tc } = useTranslation();
  const { t: te } = useTranslation('errors');
  const qc = useQueryClient();
  const editing = Boolean(product);

  const resolver = useMemo(() => zodResolver(schema(t)), [t]);
  const form = useForm<Values>({ resolver, defaultValues: toValues(product) });

  useEffect(() => {
    if (open) form.reset(toValues(product));
  }, [open, product, form]);

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const body = {
        sku: v.sku,
        name: v.name,
        unit: v.unit,
        categoryId: v.categoryId === NO_CATEGORY ? null : Number(v.categoryId),
        salePrice: Number(v.salePrice),
        costPrice: Number(v.costPrice),
        reorderLevel: Number(v.reorderLevel),
      };
      if (product) return api.patch(`/products/${product.id}`, { ...body, isActive: v.isActive });
      return api.post('/products', { ...body, openingStock: Number(v.openingStock) });
    },
    onSuccess: () => {
      toast.success(editing ? tc('status.saved') : t('created'));
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      onOpenChange(false);
    },
    onError: (e) => {
      const code = errorCode(e);
      if (code === 'SKU_TAKEN') form.setError('sku', { message: te('SKU_TAKEN') });
      else toastError(e);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('addTitle')}</DialogTitle>
        </DialogHeader>
        <form id="product-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField form={form} name="name" label={t('fields.name')} autoComplete="off" />
          </div>
          <div>
            <FormField form={form} name="sku" label={t('fields.sku')} dir="ltr" autoComplete="off" />
            <p className="text-muted-foreground mt-1 text-xs">{t('fields.skuHint')}</p>
          </div>
          <FormField form={form} name="unit" label={t('fields.unit')} placeholder={t('fields.unitPlaceholder')} />
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="f-categoryId">{t('fields.category')}</FieldLabel>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="f-categoryId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>{t('fields.noCategory')}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <FormField form={form} name="salePrice" label={t('fields.salePrice')} inputMode="decimal" dir="ltr" className="tabular" />
          <FormField form={form} name="costPrice" label={t('fields.costPrice')} inputMode="decimal" dir="ltr" className="tabular" />
          <FormField form={form} name="reorderLevel" label={t('fields.reorderLevel')} inputMode="numeric" dir="ltr" className="tabular" />
          {editing ? (
            <Field orientation="horizontal" className="items-center self-end">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Checkbox id="f-isActive" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                )}
              />
              <FieldLabel htmlFor="f-isActive">{t('fields.isActive')}</FieldLabel>
            </Field>
          ) : (
            <div>
              <FormField form={form} name="openingStock" label={t('fields.openingStock')} inputMode="numeric" dir="ltr" className="tabular" />
              <FieldDescription className="mt-1 text-xs">{t('fields.openingStockHint')}</FieldDescription>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="product-form" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null}
            {tc('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
