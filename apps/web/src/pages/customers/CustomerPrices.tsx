import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/Alert';
import { ProductPicker } from '@/components/ProductPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatMoney, formatPercent } from '@/lib/format';
import { toastError } from '@/lib/notify';
import type { CustomerPrice, Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { priceDifference } from './credit';

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

interface Row {
  product: CustomerPrice['product'];
  price: string;
}

const toRows = (prices: CustomerPrice[]): Row[] => prices.map((p) => ({ product: p.product, price: String(Number(p.price)) }));

interface Props {
  customerId: number;
  currency: string;
  /** OWNER/MANAGER only; the API rejects PUT for STAFF as well. */
  canEdit: boolean;
}

/** Customer-specific prices: GET to show, PUT the whole list to save (the API replaces it). */
export function CustomerPrices({ customerId, currency, canEdit }: Props) {
  const { t, i18n } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const lang = i18n.language;
  const qc = useQueryClient();
  const key = ['customers', customerId, 'prices'];

  const prices = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<CustomerPrice[]>(`/customers/${customerId}/prices`)).data,
  });

  // null = viewing; an array = the draft being edited.
  const [draft, setDraft] = useState<Row[] | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const save = useMutation({
    mutationFn: async (rows: Row[]) =>
      (await api.put<CustomerPrice[]>(`/customers/${customerId}/prices`, {
        prices: rows.map((r) => ({ productId: r.product.id, price: Number(r.price) })),
      })).data,
    onSuccess: (saved) => {
      qc.setQueryData(key, saved);
      toast.success(t('prices.saved'));
      setDraft(null);
    },
    onError: toastError,
  });

  const startEdit = () => {
    setShowErrors(false);
    setDraft(toRows(prices.data ?? []));
  };

  const addProduct = (p: Product | null) => {
    if (!p || !draft) return;
    if (draft.some((r) => r.product.id === p.id)) {
      toast.info(t('prices.alreadyListed'));
      return;
    }
    setDraft([...draft, { product: { id: p.id, name: p.name, sku: p.sku, salePrice: p.salePrice }, price: String(Number(p.salePrice)) }]);
  };

  const invalid = draft ? draft.filter((r) => !MONEY.test(r.price.trim())).length : 0;

  const submit = () => {
    if (!draft) return;
    if (invalid > 0) {
      setShowErrors(true);
      return;
    }
    save.mutate(draft.map((r) => ({ ...r, price: r.price.trim() })));
  };

  if (prices.isError) return <Alert>{tc('status.loadError')}</Alert>;
  if (prices.isPending) return <Skeleton className="h-32" />;

  const rows: Row[] = draft ?? toRows(prices.data);
  const editing = draft !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{canEdit ? t('prices.description') : t('prices.readOnly')}</p>
        {canEdit && !editing ? (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <PencilIcon aria-hidden="true" />
            {t('prices.edit')}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="max-w-md">
          <ProductPicker value={null} onChange={addProduct} placeholder={t('prices.addProduct')} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">{t('prices.empty')}</p>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('prices.product')}</TableHead>
                <TableHead className="text-end">{t('prices.standard')}</TableHead>
                <TableHead className="w-44 text-end">{t('prices.special')}</TableHead>
                <TableHead className="text-end">{t('prices.difference')}</TableHead>
                {editing ? <TableHead className="w-12"><span className="sr-only">{tc('actions.actions')}</span></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const valid = MONEY.test(r.price.trim());
                const diff = valid ? priceDifference(Number(r.price), Number(r.product.salePrice)) : null;
                const inputId = `price-${r.product.id}`;
                return (
                  <TableRow key={r.product.id}>
                    <TableCell>
                      <label htmlFor={editing ? inputId : undefined} className="font-medium">{r.product.name}</label>
                      <span className="text-muted-foreground ms-2 text-xs" dir="ltr">{r.product.sku}</span>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground text-end">{formatMoney(r.product.salePrice, currency, lang)}</TableCell>
                    <TableCell className="tabular text-end">
                      {editing ? (
                        <Input
                          id={inputId}
                          value={r.price}
                          onChange={(e) => {
                            const price = e.target.value;
                            setDraft((d) => d && d.map((row, j) => (j === i ? { ...row, price } : row)));
                          }}
                          inputMode="decimal"
                          dir="ltr"
                          aria-invalid={showErrors && !valid ? true : undefined}
                          className="tabular h-8 text-end"
                        />
                      ) : (
                        <span className="font-medium">{formatMoney(r.price, currency, lang)}</span>
                      )}
                    </TableCell>
                    <TableCell className={cn('tabular text-end text-sm', diff !== null && diff < 0 && 'text-primary', diff !== null && diff > 0 && 'text-warning-foreground')}>
                      {diff === null ? '—' : formatPercent(diff, lang)}
                    </TableCell>
                    {editing ? (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDraft((d) => d && d.filter((_, j) => j !== i))}
                          aria-label={`${t('prices.remove')}: ${r.product.name}`}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showErrors && invalid > 0 ? <p role="alert" className="text-destructive me-auto text-sm">{t('prices.invalid')}</p> : null}
          <Button variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null}
            {tc('actions.save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
