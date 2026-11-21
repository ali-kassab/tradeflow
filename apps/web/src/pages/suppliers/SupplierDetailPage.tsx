import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, ClipboardListIcon, MailIcon, MapPinIcon, PencilIcon, PhoneIcon, PlusIcon, ReceiptTextIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useSession } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { LedgerStatement } from '@/components/LedgerStatement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, errorCode } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Statement, StatementEntry, SupplierDetail } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SupplierFormDialog } from './SupplierFormDialog';

// Received purchase orders open the order. Payment entries get a link once the supplier
// payments page exists.
const entryHref = (e: StatementEntry) => (e.type === 'PURCHASE_RECEIVED' ? `/purchase-orders/${e.refId}` : undefined);

export default function SupplierDetailPage() {
  const { t, i18n } = useTranslation('suppliers');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  const [formOpen, setFormOpen] = useState(false);

  // Both requests start together; the statement doesn't wait for the header.
  const supplier = useQuery({
    queryKey: ['suppliers', id],
    queryFn: async () => (await api.get<SupplierDetail>(`/suppliers/${id}`)).data,
    enabled: validId,
  });
  const statement = useQuery({
    queryKey: ['suppliers', id, 'statement'],
    queryFn: async () => (await api.get<Statement>(`/suppliers/${id}/statement`)).data,
    enabled: validId,
  });

  const backLink = (
    <Link to="/suppliers" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
      <ArrowRightIcon className="size-4 ltr:-scale-x-100" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (!validId || errorCode(supplier.error) === 'NOT_FOUND') {
    return (
      <div>
        {backLink}
        <Alert>{t('notFound')}</Alert>
      </div>
    );
  }
  if (supplier.isError) {
    return (
      <div>
        {backLink}
        <Alert>{tc('status.loadError')}</Alert>
      </div>
    );
  }
  if (supplier.isPending) {
    return (
      <div className="space-y-4" role="status">
        <span className="sr-only">{tc('status.loading')}</span>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const s = supplier.data;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const balance = Number(s.balance);
  const balanceState = balance > 0 ? 'owed' : balance < 0 ? 'credit' : 'settled';
  const contact = [
    s.phone ? { icon: PhoneIcon, text: s.phone, ltr: true } : null,
    s.email ? { icon: MailIcon, text: s.email, ltr: true } : null,
    s.address ? { icon: MapPinIcon, text: s.address, ltr: false } : null,
    s.taxNumber ? { icon: ReceiptTextIcon, text: s.taxNumber, ltr: true } : null,
  ].filter((x) => x !== null);

  return (
    <div>
      {backLink}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {s.name}
            {!s.isActive ? <Badge variant="outline">{t('inactive')}</Badge> : null}
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
            <Link to={`/purchase-orders?supplierId=${s.id}`}>
              <ClipboardListIcon aria-hidden="true" />
              {t('orders')}
            </Link>
          </Button>
          {s.isActive ? (
            <Button asChild>
              <Link to={`/purchase-orders/new?supplierId=${s.id}`}>
                <PlusIcon aria-hidden="true" />
                {t('newOrder')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Account summary: received − paid = what you owe. */}
      <dl className="bg-card mb-6 grid divide-y rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <dt className="text-muted-foreground text-sm">{t('summary.billed')}</dt>
          <dd className="tabular mt-1 text-xl font-semibold">{money(s.totalBilled)}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-muted-foreground text-sm">{t('summary.paid')}</dt>
          <dd className="tabular mt-1 text-xl font-semibold">{money(s.totalPaid)}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            {t('summary.balance')}
            <span className={cn('text-xs font-medium', balanceState === 'credit' && 'text-primary', balanceState === 'owed' && 'text-foreground')}>
              {t(`summary.${balanceState}`)}
            </span>
          </dt>
          <dd className={cn('tabular mt-1 text-xl font-semibold', balance < 0 && 'text-primary')}>{money(s.balance)}</dd>
        </div>
      </dl>

      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">{t('tabs.statement')}</TabsTrigger>
          {s.notes ? <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="statement" className="space-y-3 pt-2">
          {statement.isError ? <Alert>{tc('status.loadError')}</Alert> : null}
          {statement.isPending ? <Skeleton className="h-48" /> : null}
          {statement.data ? (
            <>
              <LedgerStatement
                statement={statement.data}
                currency={tenant.currency}
                caption={t('statement.caption', { name: s.name })}
                emptyText={t('statement.empty')}
                referenceHref={entryHref}
              />
              {statement.data.entries.length > 0 ? <p className="text-muted-foreground text-xs">{t('statement.hint')}</p> : null}
            </>
          ) : null}
        </TabsContent>
        {s.notes ? (
          <TabsContent value="details" className="pt-2">
            <h2 className="text-muted-foreground mb-1 text-sm">{t('fields.notes')}</h2>
            <p className="max-w-prose text-sm whitespace-pre-line">{s.notes}</p>
          </TabsContent>
        ) : null}
      </Tabs>

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={s} />
    </div>
  );
}
