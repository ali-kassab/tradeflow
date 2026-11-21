import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, BanknoteIcon, MailIcon, MapPinIcon, PencilIcon, PhoneIcon, PlusIcon, ReceiptIcon, ReceiptTextIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useSession } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { Alert } from '@/components/Alert';
import { LedgerStatement } from '@/components/LedgerStatement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, errorCode } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { CustomerDetail, Statement, StatementEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RecordPaymentDialog } from '@/pages/payments/RecordPaymentDialog';
import { CustomerFormDialog } from './CustomerFormDialog';
import { CustomerPrices } from './CustomerPrices';
import { isOverLimit } from './credit';

// Order entries open the order; payment entries open this customer's payments list.
const entryHref = (customerId: number) => (e: StatementEntry) =>
  e.type === 'ORDER_CONFIRMED' || e.type === 'ORDER_CANCELLED' ? `/sales-orders/${e.refId}` : `/payments?customerId=${customerId}`;

export default function CustomerDetailPage() {
  const { t, i18n } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const { user, tenant } = useSession();
  const lang = i18n.language;
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  const [formOpen, setFormOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  // Both requests start together; the statement doesn't wait for the header.
  const customer = useQuery({
    queryKey: ['customers', id],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${id}`)).data,
    enabled: validId,
  });
  const statement = useQuery({
    queryKey: ['customers', id, 'statement'],
    queryFn: async () => (await api.get<Statement>(`/customers/${id}/statement`)).data,
    enabled: validId,
  });

  const backLink = (
    <Link to="/customers" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
      <ArrowRightIcon className="size-4 ltr:-scale-x-100" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (!validId || errorCode(customer.error) === 'NOT_FOUND') {
    return (
      <div>
        {backLink}
        <Alert>{t('notFound')}</Alert>
      </div>
    );
  }
  if (customer.isError) {
    return (
      <div>
        {backLink}
        <Alert>{tc('status.loadError')}</Alert>
      </div>
    );
  }
  if (customer.isPending) {
    return (
      <div className="space-y-4" role="status">
        <span className="sr-only">{tc('status.loading')}</span>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const c = customer.data;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const balance = Number(c.balance);
  const over = isOverLimit(c);
  const balanceState = balance > 0 ? 'owes' : balance < 0 ? 'credit' : 'settled';
  const contact = [
    c.phone ? { icon: PhoneIcon, text: c.phone, ltr: true } : null,
    c.email ? { icon: MailIcon, text: c.email, ltr: true } : null,
    c.address ? { icon: MapPinIcon, text: c.address, ltr: false } : null,
    c.taxNumber ? { icon: ReceiptTextIcon, text: c.taxNumber, ltr: true } : null,
  ].filter((x) => x !== null);

  return (
    <div>
      {backLink}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {c.name}
            {!c.isActive ? <Badge variant="outline">{t('inactive')}</Badge> : null}
          </h1>
          {contact.length > 0 ? (
            <ul className="text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {contact.map(({ icon: Icon, text, ltr }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span dir={ltr ? 'ltr' : undefined}>{text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFormOpen(true)}>
            <PencilIcon aria-hidden="true" />
            {tc('actions.edit')}
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/payments?customerId=${c.id}`}>
              <BanknoteIcon aria-hidden="true" />
              {t('payments')}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/sales-orders?customerId=${c.id}`}>
              <ReceiptIcon aria-hidden="true" />
              {t('orders')}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setPaying(true)}>
            <PlusIcon aria-hidden="true" />
            {t('recordPayment')}
          </Button>
          {c.isActive ? (
            <Button asChild>
              <Link to={`/sales-orders/new?customerId=${c.id}`}>
                <PlusIcon aria-hidden="true" />
                {t('newOrder')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Account summary: billed − paid = balance, read left-to-right (or right-to-left) like a sum. */}
      <dl className="bg-card mb-6 grid divide-y rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <dt className="text-muted-foreground text-sm">{t('summary.billed')}</dt>
          <dd className="tabular mt-1 text-xl font-semibold">{money(c.totalBilled)}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-muted-foreground text-sm">{t('summary.paid')}</dt>
          <dd className="tabular mt-1 text-xl font-semibold">{money(c.totalPaid)}</dd>
        </div>
        <div className={cn('px-5 py-4', over && 'bg-warning/10')}>
          <dt className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            {t('summary.balance')}
            <span className={cn('text-xs font-medium', balanceState === 'credit' && 'text-primary', balanceState === 'owes' && 'text-foreground')}>
              {t(`summary.${balanceState}`)}
            </span>
          </dt>
          <dd className={cn('tabular mt-1 text-xl font-semibold', balance < 0 && 'text-primary', over && 'text-warning-foreground')}>
            {money(c.balance)}
          </dd>
          {c.creditLimit != null ? (
            <dd className={cn('text-muted-foreground mt-1 text-xs', over && 'text-warning-foreground font-medium')}>
              {over ? <span className="block">{t('overLimit')}</span> : null}
              {t('summary.limit', { amount: money(c.creditLimit) })}
            </dd>
          ) : null}
        </div>
      </dl>

      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">{t('tabs.statement')}</TabsTrigger>
          <TabsTrigger value="prices">{t('tabs.prices')}</TabsTrigger>
          {c.notes ? <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="statement" className="space-y-3 pt-2">
          {statement.isError ? <Alert>{tc('status.loadError')}</Alert> : null}
          {statement.isPending ? <Skeleton className="h-48" /> : null}
          {statement.data ? (
            <>
              <LedgerStatement
                statement={statement.data}
                currency={tenant.currency}
                caption={t('statement.caption', { name: c.name })}
                emptyText={t('statement.empty')}
                referenceHref={entryHref(c.id)}
              />
              {statement.data.entries.length > 0 ? <p className="text-muted-foreground text-xs">{t('statement.hint')}</p> : null}
            </>
          ) : null}
        </TabsContent>
        <TabsContent value="prices" className="pt-2">
          <CustomerPrices customerId={c.id} currency={tenant.currency} canEdit={isManagerOrAbove(user.role)} />
        </TabsContent>
        {c.notes ? (
          <TabsContent value="details" className="pt-2">
            <h2 className="text-muted-foreground mb-1 text-sm">{t('fields.notes')}</h2>
            <p className="max-w-prose text-sm whitespace-pre-line">{c.notes}</p>
          </TabsContent>
        ) : null}
      </Tabs>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={c} />
      <RecordPaymentDialog open={paying} onOpenChange={setPaying} party={c} />
    </div>
  );
}
