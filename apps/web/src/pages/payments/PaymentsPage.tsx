import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BanIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useSession } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { Alert } from '@/components/Alert';
import type { PickedCustomer } from '@/components/CustomerPicker';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { CustomerDetail, CustomerPaymentListItem, Paginated } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { VoidPaymentDialog, type VoidTarget } from './VoidPaymentDialog';

export default function PaymentsPage() {
  const { t, i18n } = useTranslation('payments');
  const { t: tc } = useTranslation();
  const { user, tenant } = useSession();
  const canVoid = isManagerOrAbove(user.role);
  const lang = i18n.language;
  const columns = canVoid ? 7 : 6;

  // ?customerId= narrows the list to one customer (linked from the customer page).
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = Number(searchParams.get('customerId')) || null;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());
  const [recordOpen, setRecordOpen] = useState(false);
  const [voiding, setVoiding] = useState<VoidTarget | undefined>();

  const params = {
    page,
    pageSize: 20,
    ...(customerId ? { partyId: customerId } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };
  const payments = useQuery({
    queryKey: ['payments', 'customer', params],
    queryFn: async () => (await api.get<Paginated<CustomerPaymentListItem>>('/payments/customer', { params })).data,
    placeholderData: keepPreviousData,
  });
  const customer = useQuery({
    queryKey: ['customers', customerId],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${customerId}`)).data,
    enabled: customerId !== null,
  });
  // With the list filtered to one customer, a new payment is preset to that customer.
  const preset: PickedCustomer | undefined = customerId && customer.data ? customer.data : undefined;
  const filtered = Boolean(customerId || debouncedSearch);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setRecordOpen(true)}>
            <PlusIcon aria-hidden="true" />
            {t('record')}
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
        {customerId ? (
          <Badge variant="secondary" className="h-9 gap-1 px-3 text-sm">
            {customer.data?.name ?? '…'}
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setSearchParams({});
              }}
              aria-label={`${tc('actions.clear')}: ${customer.data?.name ?? ''}`}
              className="hover:text-foreground -me-1 rounded p-0.5"
            >
              <XIcon className="size-3.5" aria-hidden="true" />
            </button>
          </Badge>
        ) : null}
      </div>

      {payments.isError ? <Alert>{tc('status.loadError')}</Alert> : null}

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.date')}</TableHead>
              <TableHead>{t('columns.customer')}</TableHead>
              <TableHead>{t('columns.order')}</TableHead>
              <TableHead>{t('columns.method')}</TableHead>
              <TableHead>{t('columns.reference')}</TableHead>
              <TableHead className="text-end">{t('columns.amount')}</TableHead>
              {canVoid ? (
                <TableHead className="w-20">
                  <span className="sr-only">{tc('actions.actions')}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  </TableRow>
                ))
              : null}
            {payments.data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns} className="text-muted-foreground py-10 text-center">
                  {filtered ? t('emptySearch') : t('empty')}
                </TableCell>
              </TableRow>
            ) : null}
            {payments.data?.data.map((p) => {
              const voided = p.voidedAt !== null;
              return (
                <TableRow key={p.id} className={voided ? 'text-muted-foreground' : undefined}>
                  <TableCell className="tabular whitespace-nowrap">{formatDate(p.paidAt, lang)}</TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/customers/${p.customer.id}`} className="hover:text-primary underline-offset-4 hover:underline">
                      {p.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.salesOrder ? (
                      <Link to={`/sales-orders/${p.salesOrder.id}`} className="hover:text-primary tabular underline-offset-4 hover:underline" dir="ltr">
                        {p.salesOrder.number}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t('onAccount')}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{tc(`paymentMethod.${p.method}`)}</TableCell>
                  <TableCell>
                    {p.reference ? (
                      <span className="tabular" dir="ltr">
                        {p.reference}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <span className={cn('tabular font-medium whitespace-nowrap', voided && 'line-through')}>
                      {formatMoney(p.amount, tenant.currency, lang)}
                    </span>
                    {voided ? (
                      <span className="text-destructive block max-w-56 truncate text-xs ms-auto" title={p.voidReason ?? undefined}>
                        {p.voidReason ? t('voidedReason', { reason: p.voidReason }) : t('voided')}
                      </span>
                    ) : null}
                  </TableCell>
                  {canVoid ? (
                    <TableCell>
                      {voided ? null : (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVoiding({ id: p.id, amount: p.amount, customerName: p.customer.name })}
                            aria-label={`${t('void.action')}: ${p.customer.name} ${formatMoney(p.amount, tenant.currency, lang)}`}
                          >
                            <BanIcon aria-hidden="true" />
                            {t('void.action')}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {payments.data ? <PaginationBar meta={payments.data.meta} onPage={setPage} /> : null}

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} customer={preset} />
      <VoidPaymentDialog payment={voiding} onClose={() => setVoiding(undefined)} />
    </div>
  );
}
