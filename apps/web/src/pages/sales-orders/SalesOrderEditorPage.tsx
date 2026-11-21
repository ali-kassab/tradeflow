import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, RotateCcwIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useSession } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { CustomerPicker, type PickedCustomer } from '@/components/CustomerPicker';
import { ProductPicker } from '@/components/ProductPicker';
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
import type { CustomerDetail, CustomerPrice, Product, SalesOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

const WHOLE = /^\d{1,7}$/;

interface Line {
  productId: number;
  name: string;
  sku: string;
  quantity: string;
  /** Manager-typed unit price; null means "use the usual price". */
  override: string | null;
  /** The product's standard sale price (null if it couldn't be loaded). */
  standard: string | null;
  /** Price stored on an existing draft line, used only as a last-resort display value. */
  stored: string | null;
  stock: number | null;
}

interface Initial {
  customer: PickedCustomer | null;
  orderDate: string;
  lines: Line[];
  discount: string;
  taxRate: string;
  notes: string;
}

type PriceSource = 'override' | 'customer' | 'standard';

/** Price resolution, as on the server: manager override → customer price → product sale price. */
function resolvePrice(line: Line, customerPrices: Map<number, string>): { price: string; source: PriceSource } {
  if (line.override !== null) return { price: line.override, source: 'override' };
  const special = customerPrices.get(line.productId);
  if (special !== undefined) return { price: special, source: 'customer' };
  return { price: line.standard ?? line.stored ?? '0', source: 'standard' };
}

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const plain = (v: string) => String(Number(v)); // "175.00" → "175"
const pricesMap = (prices: CustomerPrice[] | undefined) => new Map((prices ?? []).map((p) => [p.productId, p.price]));

function useCustomerPrices(customerId: number | null | undefined) {
  return useQuery({
    queryKey: ['customers', customerId, 'prices'],
    queryFn: async () => (await api.get<CustomerPrice[]>(`/customers/${customerId}/prices`)).data,
    enabled: Boolean(customerId),
  });
}

/** Loads what the editor needs, then mounts it with complete initial state. */
export default function SalesOrderEditorPage() {
  const { t } = useTranslation('salesOrders');
  const { t: tc } = useTranslation();
  const { user, tenant } = useSession();
  const canOverride = isManagerOrAbove(user.role);
  const params = useParams();
  const [searchParams] = useSearchParams();
  const editId = params.id ? Number(params.id) : null;
  const presetCustomerId = Number(searchParams.get('customerId')) || null;

  const order = useQuery({
    queryKey: ['sales-orders', editId],
    queryFn: async () => (await api.get<SalesOrder>(`/sales-orders/${editId}`)).data,
    enabled: editId !== null,
  });
  const preset = useQuery({
    queryKey: ['customers', presetCustomerId],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${presetCustomerId}`)).data,
    enabled: editId === null && presetCustomerId !== null,
  });
  const productIds = order.data?.items.map((i) => i.productId) ?? [];
  const products = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['products', 'one', id],
      queryFn: async () => (await api.get<Product>(`/products/${id}`)).data,
    })),
  });
  const orderPrices = useCustomerPrices(order.data?.customerId);

  const backLink = (
    <Link to={editId ? `/sales-orders/${editId}` : '/sales-orders'} className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
      <ArrowRightIcon className="size-4 ltr:-scale-x-100" aria-hidden="true" />
      {editId ? order.data?.number ?? t('back') : t('back')}
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
    if (order.isError || orderPrices.isError) {
      return (
        <div>
          {backLink}
          <Alert>{tc('status.loadError')}</Alert>
        </div>
      );
    }
    if (order.data && order.data.status !== 'DRAFT') return <Navigate to={`/sales-orders/${editId}`} replace />;
    // Products that fail to load (e.g. deleted) fall back to the stored line price.
    const ready = order.data && orderPrices.data && products.every((p) => !p.isPending);
    if (!ready) return <EditorSkeleton />;

    const o = order.data!;
    const special = pricesMap(orderPrices.data);
    const lines: Line[] = o.items.map((item, i) => {
      const product = products[i]?.data;
      const usual = special.get(item.productId) ?? product?.salePrice ?? null;
      // STAFF can't send overrides, so for them the server re-resolves every price on save.
      const isOverride = canOverride && usual !== null && Number(usual) !== Number(item.unitPrice);
      return {
        productId: item.productId,
        name: product?.name ?? item.productName,
        sku: item.sku,
        quantity: String(item.quantity),
        override: isOverride ? plain(item.unitPrice) : null,
        standard: product?.salePrice ?? null,
        stored: item.unitPrice,
        stock: product?.stockQty ?? null,
      };
    });
    return (
      <OrderEditor
        key={o.id}
        order={o}
        backLink={backLink}
        initial={{
          customer: { id: o.customer.id, name: o.customer.name, phone: o.customer.phone },
          orderDate: o.orderDate.slice(0, 10),
          lines,
          discount: plain(o.discount),
          taxRate: plain(o.taxRate),
          notes: o.notes ?? '',
        }}
      />
    );
  }

  if (presetCustomerId !== null && preset.isPending) return <EditorSkeleton />;
  return (
    <OrderEditor
      backLink={backLink}
      initial={{
        customer: preset.data && preset.data.isActive ? preset.data : null,
        orderDate: today(),
        lines: [],
        discount: '0',
        taxRate: plain(tenant.defaultTaxRate),
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

function OrderEditor({ initial, order, backLink }: { initial: Initial; order?: SalesOrder; backLink: ReactNode }) {
  const { t, i18n } = useTranslation('salesOrders');
  const { t: tc } = useTranslation();
  const { user, tenant } = useSession();
  const canOverride = isManagerOrAbove(user.role);
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<PickedCustomer | null>(initial.customer);
  const [orderDate, setOrderDate] = useState(initial.orderDate);
  const [lines, setLines] = useState<Line[]>(initial.lines);
  const [discount, setDiscount] = useState(initial.discount);
  const [taxRate, setTaxRate] = useState(initial.taxRate);
  const [notes, setNotes] = useState(initial.notes);
  const [showErrors, setShowErrors] = useState(false);

  const prices = useCustomerPrices(customer?.id);
  const special = pricesMap(prices.data);
  const account = useQuery({
    queryKey: ['customers', customer?.id],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${customer!.id}`)).data,
    enabled: Boolean(customer),
  });

  // Everything below is derived during render from the state above.
  const rows = lines.map((line) => {
    const { price, source } = resolvePrice(line, special);
    const qtyValid = WHOLE.test(line.quantity.trim()) && Number(line.quantity) >= 1;
    const priceValid = toCents(price) !== null;
    return { line, price, source, qtyValid, priceValid, qty: Number(line.quantity) };
  });
  const rateCents = toCents(taxRate);
  const rateValid = rateCents !== null && rateCents <= 10_000n;
  const discountValid = toCents(discount === '' ? '0' : discount) !== null;
  const totals =
    rateValid && rows.every((r) => r.qtyValid && r.priceValid)
      ? computeTotals({ lines: rows.map((r) => ({ quantity: r.qty, unitPrice: r.price })), discount, taxRate })
      : null;
  const errors = {
    customer: !customer,
    lines: lines.length === 0,
    quantity: rows.some((r) => !r.qtyValid),
    price: rows.some((r) => !r.priceValid),
    discount: !discountValid || Boolean(totals?.discountTooLarge),
    rate: !rateValid,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const creditLimit = account.data?.creditLimit;
  const projected = account.data && totals ? (Number(account.data.balance) + Number(totals.total)).toFixed(2) : null;
  const overLimit = creditLimit != null && projected !== null && Number(projected) > Number(creditLimit);

  const updateLine = (productId: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));

  const addProduct = (p: Product | null) => {
    if (!p) return;
    if (lines.some((l) => l.productId === p.id)) {
      toast.info(t('editor.alreadyListed'));
      return;
    }
    setLines((ls) => [
      ...ls,
      { productId: p.id, name: p.name, sku: p.sku, quantity: '1', override: null, standard: p.salePrice, stored: null, stock: p.stockQty },
    ]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        customerId: customer!.id,
        orderDate,
        items: rows.map((r) => ({
          productId: r.line.productId,
          quantity: r.qty,
          ...(canOverride && r.line.override !== null ? { unitPrice: Number(r.line.override) } : {}),
        })),
        discount: Number(discount || 0),
        taxRate: Number(taxRate),
        notes,
      };
      return order
        ? (await api.patch<SalesOrder>(`/sales-orders/${order.id}`, body)).data
        : (await api.post<SalesOrder>('/sales-orders', body)).data;
    },
    onSuccess: (saved) => {
      toast.success(order ? t('editor.saved') : t('editor.created', { number: saved.number }));
      qc.setQueryData(['sales-orders', saved.id], saved);
      void qc.invalidateQueries({ queryKey: ['sales-orders'] });
      void navigate(`/sales-orders/${saved.id}`);
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
        <Field data-invalid={show(errors.customer) ? true : undefined}>
          <FieldLabel htmlFor="so-customer">{t('editor.customer')}</FieldLabel>
          <CustomerPicker id="so-customer" value={customer} onChange={setCustomer} invalid={show(errors.customer)} />
          {show(errors.customer) ? <FieldError>{t('editor.validation.customer')}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="so-date">{t('editor.orderDate')}</FieldLabel>
          <Input id="so-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="tabular" />
        </Field>
      </div>

      {overLimit ? (
        <div role="status" className="border-warning/40 bg-warning/10 text-warning-foreground mb-4 flex items-start gap-2 rounded-md border p-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t('editor.creditWarning', { name: customer?.name ?? '', balance: money(projected!), limit: money(creditLimit!) })}
          </span>
        </div>
      ) : null}

      <section aria-labelledby="so-lines" className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="so-lines" className="text-lg font-medium">{t('editor.lines')}</h2>
          <div className="w-full sm:w-80">
            <label htmlFor="so-add-product" className="sr-only">
              {t('editor.addProduct')}
            </label>
            <ProductPicker id="so-add-product" value={null} onChange={addProduct} placeholder={t('editor.addProduct')} invalid={show(errors.lines)} />
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
                  <TableHead className="w-40 text-end">{t('editor.unitPrice')}</TableHead>
                  <TableHead className="text-end">{t('editor.lineTotal')}</TableHead>
                  <TableHead className="w-12"><span className="sr-only">{tc('actions.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ line, price, source, qtyValid, priceValid, qty }, i) => {
                  const short = qtyValid && line.stock !== null && qty > line.stock;
                  return (
                    <TableRow key={line.productId} className="align-top">
                      <TableCell>
                        <div className="font-medium">{line.name}</div>
                        <div className="text-muted-foreground text-xs" dir="ltr">
                          <span className="tabular">{line.sku}</span>
                        </div>
                        {short ? (
                          <div className="text-warning-foreground mt-0.5 text-xs">{t('editor.stockWarning', { available: formatNumber(line.stock!, lang) })}</div>
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
                      <TableCell className="text-end">
                        {canOverride ? (
                          <Input
                            value={line.override ?? plain(price)}
                            onChange={(e) => updateLine(line.productId, { override: e.target.value })}
                            inputMode="decimal"
                            dir="ltr"
                            aria-label={`${t('editor.unitPrice')}: ${line.name}`}
                            aria-invalid={show(!priceValid) ? true : undefined}
                            title={t('editor.overrideHint')}
                            className={cn('tabular h-8 text-end', source === 'override' && 'border-warning')}
                          />
                        ) : (
                          <div className="tabular py-1.5">{money(price)}</div>
                        )}
                        <div className="text-muted-foreground mt-1 flex items-center justify-end gap-1 text-xs">
                          {t(`editor.priceSource.${source}`)}
                          {canOverride && source === 'override' ? (
                            <button
                              type="button"
                              onClick={() => updateLine(line.productId, { override: null })}
                              className="hover:text-foreground rounded p-0.5"
                              aria-label={`${t('editor.resetPrice')}: ${line.name}`}
                              title={t('editor.resetPrice')}
                            >
                              <RotateCcwIcon className="size-3" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {show(errors.quantity) ? <FieldError>{t('editor.validation.quantity')}</FieldError> : null}
        {show(errors.price) ? <FieldError>{t('editor.validation.money')}</FieldError> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Field>
          <FieldLabel htmlFor="so-notes">{t('editor.notes')}</FieldLabel>
          <Textarea id="so-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>

        <div className="panel p-4">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('editor.subtotal')}</dt>
              <dd className="tabular">{totals ? money(totals.subtotal) : '—'}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>
                <label htmlFor="so-discount" className="text-muted-foreground">{t('editor.discount')}</label>
                <p className="text-muted-foreground/80 text-xs">{t('editor.discountHint')}</p>
              </dt>
              <dd className="w-32">
                <Input
                  id="so-discount"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  aria-invalid={show(errors.discount) ? true : undefined}
                  className="tabular h-8 text-end"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label htmlFor="so-rate" className="text-muted-foreground">{t('editor.taxRate')}</label>
              </dt>
              <dd className="w-32">
                <Input
                  id="so-rate"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  aria-invalid={show(errors.rate) ? true : undefined}
                  className="tabular h-8 text-end"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('editor.tax', { rate: rateValid ? plain(taxRate) : '—' })}</dt>
              <dd className="tabular">{totals ? money(totals.taxAmount) : '—'}</dd>
            </div>
            <div className="border-foreground/70 flex items-center justify-between gap-3 border-t-[3px] border-double pt-3">
              <dt className="font-semibold">{t('editor.total')}</dt>
              <dd className="tabular text-lg font-semibold">{totals ? money(totals.total) : '—'}</dd>
            </div>
          </dl>
          {show(errors.discount) ? (
            <FieldError className="mt-2">{totals?.discountTooLarge ? t('editor.validation.discountTooLarge') : t('editor.validation.money')}</FieldError>
          ) : null}
          {show(errors.rate) ? <FieldError className="mt-2">{t('editor.validation.rate')}</FieldError> : null}
          <FieldDescription className="mt-3 text-xs">{t('editor.estimate')}</FieldDescription>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {showErrors && hasErrors ? <p role="alert" className="text-destructive me-auto text-sm">{t('editor.validation.fix')}</p> : null}
        <Button variant="outline" asChild>
          <Link to={order ? `/sales-orders/${order.id}` : '/sales-orders'}>{tc('actions.cancel')}</Link>
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {t('editor.saveDraft')}
        </Button>
      </div>
    </div>
  );
}
