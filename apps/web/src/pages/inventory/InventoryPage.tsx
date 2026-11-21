import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useSession } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { TableEmpty } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { ProductPicker } from '@/components/ProductPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import type { Paginated, Product, StockMovement, StockMovementType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AdjustStockDialog } from './AdjustStockDialog';

const TYPES: StockMovementType[] = ['OPENING', 'SALE', 'SALE_CANCEL', 'PURCHASE_RECEIPT', 'ADJUSTMENT'];
const ALL = 'all';

export default function InventoryPage() {
  const { t, i18n } = useTranslation('inventory');
  const { t: tc } = useTranslation();
  const { user } = useSession();
  const canAdjust = isManagerOrAbove(user.role);
  const lang = i18n.language;

  // ?productId= lets other pages link straight to one product's history.
  const [searchParams, setSearchParams] = useSearchParams();
  const productId = Number(searchParams.get('productId')) || null;
  const [type, setType] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const selected = useQuery({
    queryKey: ['products', 'one', productId],
    queryFn: async () => (await api.get<Product>(`/products/${productId}`)).data,
    enabled: productId !== null,
  });

  const params = { page, pageSize: 25, ...(productId ? { productId } : {}), ...(type !== ALL ? { type } : {}) };
  const movements = useQuery({
    queryKey: ['inventory', 'movements', params],
    queryFn: async () => (await api.get<Paginated<StockMovement>>('/inventory/movements', { params })).data,
    placeholderData: keepPreviousData,
  });

  const selectProduct = (p: Product | null) => {
    setPage(1);
    setSearchParams(p ? { productId: String(p.id) } : {});
  };

  const n = (v: number) => formatNumber(Math.abs(v), lang);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canAdjust ? (
            <Button onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontalIcon aria-hidden="true" />
              {t('adjust')}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-80">
          <ProductPicker
            value={productId ? (selected.data ?? null) : null}
            onChange={selectProduct}
            allowClear
            placeholder={tc('picker.anyProduct')}
          />
        </div>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label={t('filters.type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filters.allTypes')}</SelectItem>
            {TYPES.map((ty) => (
              <SelectItem key={ty} value={ty}>
                {tc(`movementType.${ty}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {movements.isError ? <Alert>{tc('status.loadError')}</Alert> : null}

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.date')}</TableHead>
              <TableHead>{t('columns.product')}</TableHead>
              <TableHead>{t('columns.type')}</TableHead>
              <TableHead className="text-end">{t('columns.quantity')}</TableHead>
              <TableHead className="text-end">{t('columns.balance')}</TableHead>
              <TableHead>{t('columns.note')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  </TableRow>
                ))
              : null}
            {movements.data?.data.length === 0 ? (
              <TableEmpty colSpan={6}>{t('empty')}</TableEmpty>
            ) : null}
            {movements.data?.data.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">{formatDate(m.createdAt, lang)}</TableCell>
                <TableCell>
                  <span className="font-medium">{m.product.name}</span>
                  <span className="text-muted-foreground ms-2 text-xs" dir="ltr">
                    {m.product.sku}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{tc(`movementType.${m.type}`)}</Badge>
                </TableCell>
                <TableCell
                  className={cn('tabular text-end font-medium', m.quantity > 0 ? 'text-primary' : 'text-destructive')}
                  dir="ltr"
                >
                  {m.quantity > 0 ? '+' : '−'}
                  {n(m.quantity)}
                </TableCell>
                <TableCell className="tabular text-end">{formatNumber(m.balanceAfter, lang)}</TableCell>
                <TableCell className="text-muted-foreground max-w-64 truncate" title={m.note ?? undefined}>
                  {m.note ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {movements.data ? <PaginationBar meta={movements.data.meta} onPage={setPage} /> : null}

      {canAdjust ? (
        <AdjustStockDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          initialProduct={productId ? (selected.data ?? null) : null}
        />
      ) : null}
    </div>
  );
}
