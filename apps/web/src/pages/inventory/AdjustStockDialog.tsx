import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ProductPicker } from '@/components/ProductPicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api, errorCode } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { toastError } from '@/lib/notify';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

type Direction = 'increase' | 'decrease';
type Errors = Partial<Record<'product' | 'quantity' | 'note', string>>;

/** Manual stock adjustment (OWNER/MANAGER). Positive or negative, always with a reason. */
export function AdjustStockDialog({
  open,
  onOpenChange,
  initialProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProduct: Product | null;
}) {
  const { t } = useTranslation('inventory');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
        </DialogHeader>
        {/* Radix mounts the content only while open, so each opening starts a fresh form;
            the key restarts it if the preset product arrives while open. */}
        <AdjustStockForm key={initialProduct?.id ?? 'none'} initialProduct={initialProduct} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockForm({ initialProduct, onDone }: { initialProduct: Product | null; onDone: () => void }) {
  const { t, i18n } = useTranslation('inventory');
  const { t: tc } = useTranslation();
  const { t: te } = useTranslation('errors');
  const qc = useQueryClient();

  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [direction, setDirection] = useState<Direction>('decrease');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const qty = /^\d{1,7}$/.test(quantity.trim()) ? Number(quantity.trim()) : NaN;
  const delta = Number.isFinite(qty) ? (direction === 'increase' ? qty : -qty) : 0;
  const after = product ? product.stockQty + delta : null;

  const save = useMutation({
    mutationFn: () => api.post('/inventory/adjustments', { productId: product!.id, quantity: delta, note: note.trim() }),
    onSuccess: () => {
      toast.success(t('saved'));
      for (const key of ['inventory', 'products', 'dashboard']) void qc.invalidateQueries({ queryKey: [key] });
      onDone();
    },
    onError: (e) => {
      if (errorCode(e) === 'INSUFFICIENT_STOCK') setErrors({ quantity: te('INSUFFICIENT_STOCK') });
      else toastError(e);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!product) next.product = t('validation.product');
    if (!Number.isFinite(qty) || qty <= 0) next.quantity = t('validation.quantity');
    else if (after !== null && after < 0) next.quantity = t('validation.negative');
    if (note.trim().length < 2) next.note = t('validation.note');
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  const n = (v: number) => formatNumber(v, i18n.language);

  return (
    <>
      <form id="adjust-form" noValidate onSubmit={submit} className="space-y-4">
        <Field data-invalid={errors.product ? true : undefined}>
          <FieldLabel htmlFor="adjust-product">{t('form.product')}</FieldLabel>
          <ProductPicker
            id="adjust-product"
            value={product}
            onChange={(p) => {
              setProduct(p);
              setErrors((x) => ({ ...x, product: undefined }));
            }}
            invalid={Boolean(errors.product)}
          />
          {errors.product ? <FieldError>{errors.product}</FieldError> : null}
        </Field>

        <Field>
          <FieldLabel id="adjust-direction">{t('form.direction')}</FieldLabel>
          <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <TabsList className="w-full" aria-labelledby="adjust-direction">
              <TabsTrigger value="decrease" className="flex-1">
                {t('form.decrease')}
              </TabsTrigger>
              <TabsTrigger value="increase" className="flex-1">
                {t('form.increase')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>

        <Field data-invalid={errors.quantity ? true : undefined}>
          <FieldLabel htmlFor="adjust-qty">{t('form.quantity')}</FieldLabel>
          <Input
            id="adjust-qty"
            inputMode="numeric"
            dir="ltr"
            className="tabular"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setErrors((x) => ({ ...x, quantity: undefined }));
            }}
            aria-invalid={errors.quantity ? true : undefined}
          />
          {errors.quantity ? <FieldError>{errors.quantity}</FieldError> : null}
        </Field>

        {product ? (
          <dl className="bg-muted grid grid-cols-2 gap-2 rounded-md p-3 text-sm">
            <dt className="text-muted-foreground">{t('form.current')}</dt>
            <dd className="tabular text-end">{n(product.stockQty)}</dd>
            <dt className="text-muted-foreground">{t('form.after')}</dt>
            <dd className={cn('tabular text-end font-semibold', after !== null && after < 0 && 'text-destructive')}>
              {after !== null ? n(after) : '—'}
            </dd>
          </dl>
        ) : null}

        <Field data-invalid={errors.note ? true : undefined}>
          <FieldLabel htmlFor="adjust-note">{t('form.note')}</FieldLabel>
          <Textarea
            id="adjust-note"
            rows={2}
            maxLength={255}
            placeholder={t('form.notePlaceholder')}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setErrors((x) => ({ ...x, note: undefined }));
            }}
            aria-invalid={errors.note ? true : undefined}
          />
          {errors.note ? <FieldError>{errors.note}</FieldError> : null}
        </Field>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          {tc('actions.cancel')}
        </Button>
        <Button type="submit" form="adjust-form" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {t('form.submit')}
        </Button>
      </DialogFooter>
    </>
  );
}
