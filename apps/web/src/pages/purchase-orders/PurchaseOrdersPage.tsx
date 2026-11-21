import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useSession } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import type { Paginated, PurchaseOrderListItem, PurchaseOrderStatus, SupplierDetail } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { PaymentStatusText } from '@/pages/sales-orders/badges';
import { PurchaseStatusBadge } from './badges';

const STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'];
const ALL = 'all';
const COLUMNS = 7;

export default function PurchaseOrdersPage() {
  const { t, i18n } = useTranslation('purchaseOrders');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;

  // ?supplierId= narrows the list to one supplier (linked from the supplier page).
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierId = Number(searchParams.get('supplierId')) || null;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());

  const params = {
    page,
    pageSize: 20,
    ...(status !== ALL ? { status } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };
  const orders = useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: async () => (await api.get<Paginated<PurchaseOrderListItem>>('/purchase-orders', { params })).data,
    placeholderData: keepPreviousData,
  });
  const supplier = useQuery({
    queryKey: ['suppliers', supplierId],
    queryFn: async () => (await api.get<SupplierDetail>(`/suppliers/${supplierId}`)).data,
    enabled: supplierId !== null,
  });

  const newOrderHref = supplierId ? `/purchase-orders/new?supplierId=${supplierId}` : '/purchase-orders/new';

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button asChild>
            <Link to={newOrderHref}>
              <PlusIcon aria-hidden="true" />
              {t('add')}
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={tc('actions.search')}
            className="ps-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label={t('filters.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filters.all')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {tc(`purchaseStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {supplierId ? (
          <Badge variant="secondary" className="h-9 gap-1 px-3 text-sm">
            {supplier.data?.name ?? '…'}
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setSearchParams({});
              }}
              aria-label={`${tc('actions.clear')}: ${supplier.data?.name ?? ''}`}
              className="hover:text-foreground -me-1 rounded p-0.5"
            >
              <XIcon className="size-3.5" aria-hidden="true" />
            </button>
          </Badge>
        ) : null}
      </div>

      {orders.isError ? <Alert>{tc('status.loadError')}</Alert> : null}

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.number')}</TableHead>
              <TableHead>{t('columns.supplier')}</TableHead>
              <TableHead>{t('columns.date')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead className="text-end">{t('columns.items')}</TableHead>
              <TableHead className="text-end">{t('columns.total')}</TableHead>
              <TableHead>{t('columns.payment')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={COLUMNS}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  </TableRow>
                ))
              : null}
            {orders.data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS} className="text-muted-foreground py-10 text-center">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : null}
            {orders.data?.data.map((o) => (
              <TableRow key={o.id} className={o.status === 'CANCELLED' ? 'text-muted-foreground' : undefined}>
                <TableCell className="font-medium">
                  <Link to={`/purchase-orders/${o.id}`} className="hover:text-primary tabular underline-offset-4 hover:underline" dir="ltr">
                    {o.number}
                  </Link>
                </TableCell>
                <TableCell>{o.supplier.name}</TableCell>
                <TableCell className="tabular whitespace-nowrap">{formatDate(o.orderDate, lang)}</TableCell>
                <TableCell>
                  <PurchaseStatusBadge status={o.status} />
                </TableCell>
                <TableCell className="tabular text-end">{formatNumber(o.itemCount, lang)}</TableCell>
                <TableCell className="tabular text-end whitespace-nowrap">{formatMoney(o.total, tenant.currency, lang)}</TableCell>
                <TableCell>
                  <PaymentStatusText status={o.paymentStatus} />
                  {o.paymentStatus === 'PARTIAL' ? (
                    <span className="text-muted-foreground block text-xs whitespace-nowrap">
                      {t('columns.outstanding')} <span className="tabular">{formatMoney(o.outstanding, tenant.currency, lang)}</span>
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {orders.data ? <PaginationBar meta={orders.data.meta} onPage={setPage} /> : null}
    </div>
  );
}
