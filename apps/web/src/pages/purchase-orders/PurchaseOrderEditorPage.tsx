import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, Trash2Icon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useSession } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { ProductPicker } from '@/components/ProductPicker';
import { type PickedSupplier, SupplierPicker } from '@/components/SupplierPicker';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { api, errorCode } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';
import { toastError } from '@/lib/notify';
import { computeTotals, toCents } from '@/lib/order-math';
import type { Product, PurchaseOrder, SupplierDetail } from '@/lib/types';

const WHOLE = /^\d{1,7}$/;
const MAX_LINES = 200;

interface Line {
  productId: number;
  name: string;
  sku: string;
  quantity: string;
  unitCost: string;
  /** Current stock, shown for context (null when unknown, e.g. on a reopened draft). */
  stock: number | null;
}

interface Initial {
  supplier: PickedSupplier | null;
  expectedDate: string;
  lines: Line[];
  notes: string;
}

const plain = (v: string) => String(Number(v)); // "175.00" → "175"

/** Loads what the editor needs, then mounts it with complete initial state. */
export default function PurchaseOrderEditorPage() {
  const { t } = useTranslation('purchaseOrders');
  const { t: tc } = useTranslation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const editId = params.id ? Number(params.id) : null;
  const presetSupplierId = Number(searchParams.get('supplierId')) || null;

  const order = useQuery({
    queryKey: ['purchase-orders', editId],
    queryFn: async () => (await api.get<PurchaseOrder>(`/purchase-orders/${editId}`)).data,
    enabled: editId !== null,
  });
  const preset = useQuery({
    queryKey: ['suppliers', presetSupplierId],
    queryFn: async () => (await api.get<SupplierDetail>(`/suppliers/${presetSupplierId}`)).data,
    enabled: editId === null && presetSupplierId !== null,
  });

  const backLink = (
    <Link
      to={editId ? `/purchase-orders/${editId}` : '/purchase-orders'}
      className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
    >
      <ArrowRightIcon className="size-4 ltr:-scale-x-100" aria-hidden="true" />
      {editId ? (order.data?.number ?? t('back')) : t('back')}
    </Link>
  );

  if (editId !== null) {
    if (!Number.isInteger(editId) || editId < 1 || errorCode(order.error) === 'NOT_FOUND') {
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
    if (!order.data) return <EditorSkeleton />;
    const o = order.data;
    if (o.status !== 'DRAFT') return <Navigate to={`/purchase-orders/${editId}`} replace />;
    return (
      <OrderEditor
        key={o.id}
        order={o}
        backLink={backLink}
        initial={{
          supplier: { id: o.supplier.id, name: o.supplier.name, phone: o.supplier.phone },
          expectedDate: o.expectedDate ? o.expectedDate.slice(0, 10) : '',
          lines: o.items.map((item) => ({
            productId: item.productId,
            name: item.productName,
            sku: item.sku,
            quantity: String(item.quantity),
            unitCost: plain(item.unitCost),
            stock: null,
          })),
          notes: o.notes ?? '',
        }}
      />
    );
  }

  if (presetSupplierId !== null && preset.isPending) return <EditorSkeleton />;
  return (
    <OrderEditor
      backLink={backLink}
      initial={{
        supplier: preset.data && preset.data.isActive ? preset.data : null,
        expectedDate: '',
        lines: [],
        notes: '',
      }}
    />
  );
}

function EditorSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" role="status">
      <span className="sr-only">{t('status.loading')}</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-16" />
      <Skeleton className="h-56" />
    </div>
  );
}

function OrderEditor({ initial, order, backLink }: { initial: Initial; order?: PurchaseOrder; backLink: ReactNode }) {
  const { t, i18n } = useTranslation('purchaseOrders');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<PickedSupplier | null>(initial.supplier);
  const [expectedDate, setExpectedDate] = useState(initial.expectedDate);
  const [lines, setLines] = useState<Line[]>(initial.lines);
  const [notes, setNotes] = useState(initial.notes);
  const [showErrors, setShowErrors] = useState(false);

  // Everything below is derived during render from the state above.
  const rows = lines.map((line) => ({
    line,
    qty: Number(line.quantity),
    qtyValid: WHOLE.test(line.quantity.trim()) && Number(line.quantity) >= 1,
    costValid: toCents(line.unitCost) !== null,
  }));
  // Lines are qty × unit cost only: the shared order maths with no discount and no VAT.
  const totals = rows.every((r) => r.qtyValid && r.costValid)
    ? computeTotals({ lines: rows.map((r) => ({ quantity: r.qty, unitPrice: r.line.unitCost })), discount: '0', taxRate: '0' })
    : null;
  const errors = {
    supplier: !supplier,
    lines: lines.length === 0,
    quantity: rows.some((r) => !r.qtyValid),
    cost: rows.some((r) => !r.costValid),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const updateLine = (productId: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));

  const addProduct = (p: Product | null) => {
    if (!p) return;
    if (lines.some((l) => l.productId === p.id)) {
      toast.info(t('editor.alreadyListed'));
      return;
    }
    if (lines.length >= MAX_LINES) {
      toast.info(t('editor.tooManyLines', { max: MAX_LINES }));
      return;
    }
    setLines((ls) => [
      ...ls,
      { productId: p.id, name: p.name, sku: p.sku, quantity: '1', unitCost: plain(p.costPrice ?? '0'), stock: p.stockQty },
    ]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        supplierId: supplier!.id,
        items: rows.map((r) => ({ productId: r.line.productId, quantity: r.qty, unitCost: Number(r.line.unitCost) })),
        ...(expectedDate ? { expectedDate } : {}),
        notes,
      };
      return order
        ? (await api.patch<PurchaseOrder>(`/purchase-orders/${order.id}`, body)).data
        : (await api.post<PurchaseOrder>('/purchase-orders', body)).data;
    },
    onSuccess: (saved) => {
      toast.success(order ? t('editor.saved') : t('editor.created', { number: saved.number }));
      qc.setQueryData(['purchase-orders', saved.id], saved);
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      void navigate(`/purchase-orders/${saved.id}`);
    },
    onError: toastError,
  });

  const submit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    save.mutate();
  };

  const show = (flag: boolean) => showErrors && flag;

  return (
    <div>
      {backLink}
      <h1 className="mb-6 text-[1.625rem] leading-tight font-semibold tracking-tight">{order ? t('editor.editTitle', { number: order.number }) : t('editor.newTitle')}</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field data-invalid={show(errors.supplier) ? true : undefined}>
          <FieldLabel htmlFor="po-supplier">{t('editor.supplier')}</FieldLabel>
          <SupplierPicker id="po-supplier" value={supplier} onChange={setSupplier} invalid={show(errors.supplier)} />
          {show(errors.supplier) ? <FieldError>{t('editor.validation.supplier')}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="po-expected">{t('editor.expectedDate')}</FieldLabel>
          <Input id="po-expected" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="tabular" />
        </Field>
      </div>

      <section aria-labelledby="po-lines" className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="po-lines" className="text-lg font-medium">
            {t('editor.lines')}
          </h2>
          <div className="w-full sm:w-80">
            <label htmlFor="po-add-product" className="sr-only">
              {t('editor.addProduct')}
            </label>
            <ProductPicker id="po-add-product" value={null} onChange={addProduct} placeholder={t('editor.addProduct')} invalid={show(errors.lines)} />
          </div>
        </div>
        {lines.length === 0 ? (
          <EmptyState tone={show(errors.lines) ? 'error' : 'muted'}>{t('editor.noLines')}</EmptyState>
        ) : (
          <div className="panel overflow-x-auto">
            <Table className="min-w-[36rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('editor.product')}</TableHead>
                  <TableHead className="w-24 text-end">{t('editor.quantity')}</TableHead>
                  <TableHead className="w-40 text-end">{t('editor.unitCost')}</TableHead>
                  <TableHead className="text-end">{t('editor.lineTotal')}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{tc('actions.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ line, qtyValid, costValid }, i) => (
                  <TableRow key={line.productId} className="align-top">
                    <TableCell>
                      <div className="font-medium">{line.name}</div>
                      <div className="text-muted-foreground text-xs" dir="ltr">
                        <span className="tabular">{line.sku}</span>
                      </div>
                      {line.stock !== null ? (
                        <div className="text-muted-foreground mt-0.5 text-xs">{t('editor.inStock', { qty: formatNumber(line.stock, lang) })}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.quantity}
                        onChange={(e) => updateLine(line.productId, { quantity: e.target.value })}
                        inputMode="numeric"
                        dir="ltr"
                        aria-label={`${t('editor.quantity')}: ${line.name}`}
                        aria-invalid={show(!qtyValid) ? true : undefined}
                        className="tabular h-8 text-end"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.productId, { unitCost: e.target.value })}
                        inputMode="decimal"
                        dir="ltr"
                        aria-label={`${t('editor.unitCost')}: ${line.name}`}
                        aria-invalid={show(!costValid) ? true : undefined}
                        className="tabular h-8 text-end"
                      />
                    </TableCell>
                    <TableCell className="tabular py-3.5 text-end whitespace-nowrap">{totals ? money(totals.lineTotals[i]) : '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLines((ls) => ls.filter((l) => l.productId !== line.productId))}
                        aria-label={`${t('editor.remove')}: ${line.name}`}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {show(errors.quantity) ? <FieldError>{t('editor.validation.quantity')}</FieldError> : null}
        {show(errors.cost) ? <FieldError>{t('editor.validation.money')}</FieldError> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Field>
          <FieldLabel htmlFor="po-notes">{t('editor.notes')}</FieldLabel>
          <Textarea id="po-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>

        <div className="panel h-fit p-4">
          <dl className="text-sm">
            <div className="border-foreground/70 flex items-center justify-between gap-3 border-b-[3px] border-double pb-3">
              <dt className="font-semibold">{t('editor.total')}</dt>
              <dd className="tabular text-lg font-semibold">{totals ? money(totals.total) : '—'}</dd>
            </div>
          </dl>
          <FieldDescription className="mt-3 text-xs">{t('editor.costHint')}</FieldDescription>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {showErrors && hasErrors ? (
          <p role="alert" className="text-destructive me-auto text-sm">
            {t('editor.validation.fix')}
          </p>
        ) : null}
        <Button variant="outline" asChild>
          <Link to={order ? `/purchase-orders/${order.id}` : '/purchase-orders'}>{tc('actions.cancel')}</Link>
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {t('editor.saveDraft')}
        </Button>
      </div>
    </div>
  );
}
