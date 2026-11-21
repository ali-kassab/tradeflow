import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, BanIcon, PackageCheckIcon, PencilIcon, SendIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useSession } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, errorCode } from '@/lib/api';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { toastError } from '@/lib/notify';
import type { PurchaseOrder } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PaymentStatusText } from '@/pages/sales-orders/badges';
import { PurchaseStatusBadge } from './badges';

type Action = 'order' | 'receive' | 'cancel';
const DIALOG = { order: 'orderDialog', receive: 'receiveDialog', cancel: 'cancelDialog' } as const;

export default function PurchaseOrderDetailPage() {
  const { t, i18n } = useTranslation('purchaseOrders');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const qc = useQueryClient();
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  const [pending, setPending] = useState<Action | null>(null);
  // The dialog keeps showing the last action while it animates closed.
  const [shown, setShown] = useState<Action>('order');
  const ask = (a: Action) => {
    setShown(a);
    setPending(a);
  };

  const order = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: async () => (await api.get<PurchaseOrder>(`/purchase-orders/${id}`)).data,
    enabled: validId,
  });

  const act = useMutation({
    mutationFn: async (action: Action) => (await api.post<PurchaseOrder>(`/purchase-orders/${id}/${action}`)).data,
    onSuccess: (saved, action) => {
      qc.setQueryData(['purchase-orders', id], saved);
      toast.success(t(`${DIALOG[action]}.done`));
      setPending(null);
      // Receiving adds stock, updates cost prices and the supplier balance.
      for (const key of ['purchase-orders', 'suppliers', 'products', 'inventory', 'dashboard']) {
        void qc.invalidateQueries({ queryKey: [key], predicate: (q) => !(q.queryKey[0] === 'purchase-orders' && q.queryKey[1] === id) });
      }
    },
    onError: (e) => {
      setPending(null);
      toastError(e);
      // A stale view (another user acted first) is corrected by refetching.
      if (errorCode(e) === 'INVALID_STATUS') void order.refetch();
    },
  });

  const backLink = (
    <Link to="/purchase-orders" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
      <ArrowRightIcon className="size-4 ltr:-scale-x-100" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (!validId || errorCode(order.error) === 'NOT_FOUND') {
    return (
      <div>
        {backLink}
        <Alert>{t('notFound')}</Alert>
      </div>
    );
  }
  if (order.isError) {
    return (
      <div>
        {backLink}
        <Alert>{tc('status.loadError')}</Alert>
      </div>
    );
  }
  if (order.isPending) {
    return (
      <div className="space-y-4" role="status">
        <span className="sr-only">{tc('status.loading')}</span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const o = order.data;
  const billed = o.status === 'RECEIVED';
  // Mirrors the API: edit and "ordered" from DRAFT; receive/cancel from DRAFT or ORDERED.
  const open = o.status === 'DRAFT' || o.status === 'ORDERED';
  const busy = act.isPending;

  const timeline = [
    { key: 'created', at: o.createdAt },
    { key: 'ordered', at: o.orderedAt },
    { key: 'received', at: o.receivedAt },
    { key: 'cancelled', at: o.cancelledAt },
  ].filter((e): e is { key: string; at: string } => Boolean(e.at));

  const dialog = {
    order: {
      title: t('orderDialog.title', { number: o.number }),
      description: t('orderDialog.body', { name: o.supplier.name }),
      confirmLabel: t('actions.order'),
      destructive: false,
    },
    receive: {
      title: t('receiveDialog.title', { number: o.number }),
      description: t('receiveDialog.body', { total: money(o.total), name: o.supplier.name }),
      confirmLabel: t('actions.receive'),
      destructive: false,
    },
    cancel: {
      title: t('cancelDialog.title', { number: o.number }),
      description: t('cancelDialog.body'),
      confirmLabel: t('actions.cancel'),
      destructive: true,
    },
  }[shown];

  return (
    <div>
      {backLink}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="tabular text-2xl font-semibold" dir="ltr">
            {o.number}
          </h1>
          <PurchaseStatusBadge status={o.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {o.status === 'DRAFT' ? (
            <Button variant="outline" asChild>
              <Link to={`/purchase-orders/${o.id}/edit`}>
                <PencilIcon aria-hidden="true" />
                {t('actions.edit')}
              </Link>
            </Button>
          ) : null}
          {open ? (
            <Button variant="outline" onClick={() => ask('cancel')} disabled={busy}>
              <BanIcon aria-hidden="true" />
              {t('actions.cancel')}
            </Button>
          ) : null}
          {o.status === 'DRAFT' ? (
            <Button variant="outline" onClick={() => ask('order')} disabled={busy}>
              <SendIcon aria-hidden="true" className="rtl:-scale-x-100" />
              {t('actions.order')}
            </Button>
          ) : null}
          {open ? (
            <Button onClick={() => ask('receive')} disabled={busy}>
              <PackageCheckIcon aria-hidden="true" />
              {t('actions.receive')}
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="bg-card mb-6 grid gap-x-8 gap-y-4 rounded-lg border p-5 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-sm">{t('detail.supplier')}</dt>
          <dd className="mt-1 font-medium">
            <Link to={`/suppliers/${o.supplier.id}`} className="hover:text-primary underline-offset-4 hover:underline">
              {o.supplier.name}
            </Link>
          </dd>
          {o.supplier.phone ? (
            <dd className="text-muted-foreground tabular text-sm" dir="ltr">
              <span className="block text-start">{o.supplier.phone}</span>
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('detail.orderDate')}</dt>
          <dd className="tabular mt-1 font-medium">{formatDate(o.orderDate, lang)}</dd>
          {o.expectedDate ? (
            <>
              <dt className="text-muted-foreground mt-3 text-sm">{t('detail.expectedDate')}</dt>
              <dd className="tabular mt-1 font-medium">{formatDate(o.expectedDate, lang)}</dd>
            </>
          ) : null}
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('detail.timeline')}</dt>
          <dd className="mt-1">
            <ol className="space-y-0.5 text-sm">
              {timeline.map((e) => (
                <li key={e.key} className="flex justify-between gap-3">
                  <span>{t(`detail.${e.key}` as 'detail.created')}</span>
                  <span className="text-muted-foreground tabular">{formatDate(e.at, lang)}</span>
                </li>
              ))}
            </ol>
          </dd>
        </div>
      </dl>

      <div className="bg-card mb-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('editor.product')}</TableHead>
              <TableHead className="text-end">{t('editor.quantity')}</TableHead>
              <TableHead className="text-end">{t('editor.unitCost')}</TableHead>
              <TableHead className="text-end">{t('editor.lineTotal')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {o.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-medium">{item.productName}</span>
                  <span className="text-muted-foreground ms-2 text-xs" dir="ltr">
                    {item.sku}
                  </span>
                </TableCell>
                <TableCell className="tabular text-end">{formatNumber(item.quantity, lang)}</TableCell>
                <TableCell className="tabular text-end whitespace-nowrap">{money(item.unitCost)}</TableCell>
                <TableCell className="tabular text-end whitespace-nowrap">{money(item.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {o.notes ? (
            <section>
              <h2 className="text-muted-foreground mb-1 text-sm">{t('detail.notes')}</h2>
              <p className="max-w-prose text-sm whitespace-pre-line">{o.notes}</p>
            </section>
          ) : null}
          {billed || o.payments.length > 0 ? (
            <section aria-labelledby="po-payments">
              <h2 id="po-payments" className="mb-2 text-lg font-medium">
                {t('detail.payments')}
              </h2>
              {o.payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('detail.noPayments')}</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {o.payments.map((p) => (
                    <li
                      key={p.id}
                      className={cn('flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm', p.voidedAt && 'text-muted-foreground')}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tabular">{formatDate(p.paidAt, lang)}</span>
                        <span>{tc(`paymentMethod.${p.method}`)}</span>
                        {p.reference ? (
                          <span className="text-muted-foreground tabular" dir="ltr">
                            {p.reference}
                          </span>
                        ) : null}
                        {p.voidedAt ? <span className="text-destructive text-xs">{t('detail.voided')}</span> : null}
                      </span>
                      <span className={cn('tabular font-medium', p.voidedAt && 'line-through')}>{money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        <div className="bg-card h-fit rounded-lg border p-4">
          <dl className="space-y-2.5 text-sm">
            <div className="border-foreground/70 flex justify-between gap-3 border-b-[3px] border-double pb-2.5">
              <dt className="font-semibold">{t('editor.total')}</dt>
              <dd className="tabular text-lg font-semibold">{money(o.total)}</dd>
            </div>
            {billed ? (
              <>
                <div className="flex justify-between gap-3 pt-1">
                  <dt className="text-muted-foreground">{t('detail.paid')}</dt>
                  <dd className="tabular">{money(o.paidAmount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2">
                    {t('detail.outstanding')}
                    <PaymentStatusText status={o.paymentStatus} />
                  </dt>
                  <dd className={cn('tabular font-semibold', Number(o.outstanding) > 0 && 'text-warning-foreground')}>{money(o.outstanding)}</dd>
                </div>
              </>
            ) : null}
          </dl>
          {open ? <p className="text-muted-foreground mt-3 text-xs">{t('detail.notBilledHint')}</p> : null}
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(isOpen) => !isOpen && !busy && setPending(null)}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={shown === 'cancel' ? t('cancelDialog.keep') : undefined}
        destructive={dialog.destructive}
        pending={busy}
        onConfirm={() => pending && act.mutate(pending)}
      />
    </div>
  );
}
