import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HistoryIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSession } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';
import { toastError } from '@/lib/notify';
import { useCategories } from '@/lib/queries';
import type { Paginated, Product } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { ProductFormDialog } from './ProductFormDialog';

type Status = 'active' | 'inactive' | 'all';
const ALL = 'all';

export default function ProductsPage() {
  const { t, i18n } = useTranslation('products');
  const { t: tc } = useTranslation();
  const { user, tenant } = useSession();
  const canManage = isManagerOrAbove(user.role);
  const lang = i18n.language;
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL);
  const [status, setStatus] = useState<Status>('active');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());

  const [editing, setEditing] = useState<Product | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | undefined>();

  const params = {
    page,
    pageSize: 20,
    status,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categoryId !== ALL ? { categoryId: Number(categoryId) } : {}),
    ...(lowStock ? { lowStock: true } : {}),
  };
  const products = useQuery({
    queryKey: ['products', params],
    queryFn: async () => (await api.get<Paginated<Product>>('/products', { params })).data,
    placeholderData: keepPreviousData,
  });
  const categories = useCategories();

  const remove = useMutation({
    mutationFn: (p: Product) => api.delete(`/products/${p.id}`),
    onSuccess: () => {
      toast.success(tc('status.deleted'));
      setDeleting(undefined);
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e) => {
      setDeleting(undefined);
      toastError(e);
    },
  });

  // Any filter change returns to the first page.
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const openForm = (p?: Product) => {
    setEditing(p);
    setFormOpen(true);
  };

  const showCost = canManage; // STAFF never receives cost data from the API
  const columns = 7 + (showCost ? 1 : 0);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canManage ? (
            <Button onClick={() => openForm()}>
              <PlusIcon aria-hidden="true" />
              {t('add')}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => filter(setSearch)(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={tc('actions.search')}
            className="ps-8"
          />
        </div>
        <Select value={categoryId} onValueChange={filter(setCategoryId)}>
          <SelectTrigger className="w-44" aria-label={t('filters.category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filters.allCategories')}</SelectItem>
            {categories.data?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => filter(setStatus)(v as Status)}>
          <SelectTrigger className="w-32" aria-label={t('filters.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t('filters.active')}</SelectItem>
            <SelectItem value="inactive">{t('filters.inactive')}</SelectItem>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex h-9 items-center gap-2">
          <Checkbox id="low-stock" checked={lowStock} onCheckedChange={(v) => filter(setLowStock)(v === true)} />
          <Label htmlFor="low-stock">{t('filters.lowStock')}</Label>
        </div>
      </div>

      {products.isError ? <Alert>{tc('status.loadError')}</Alert> : null}

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.sku')}</TableHead>
              <TableHead>{t('columns.category')}</TableHead>
              <TableHead>{t('columns.unit')}</TableHead>
              <TableHead className="text-end">{t('columns.salePrice')}</TableHead>
              {showCost ? <TableHead className="text-end">{t('columns.costPrice')}</TableHead> : null}
              <TableHead className="text-end">{t('columns.stock')}</TableHead>
              <TableHead className={canManage ? 'w-32' : 'w-12'}><span className="sr-only">{tc('actions.actions')}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  </TableRow>
                ))
              : null}
            {products.data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns} className="text-muted-foreground py-10 text-center">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : null}
            {products.data?.data.map((p) => (
              <TableRow key={p.id} className={p.isActive ? undefined : 'text-muted-foreground'}>
                <TableCell className="font-medium">
                  {p.name}
                  {!p.isActive ? (
                    <Badge variant="outline" className="ms-2">
                      {t('inactive')}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell dir="ltr" className="text-start">{p.sku}</TableCell>
                <TableCell>{p.category?.name ?? '—'}</TableCell>
                <TableCell>{p.unit}</TableCell>
                <TableCell className="tabular text-end">{formatMoney(p.salePrice, tenant.currency, lang)}</TableCell>
                {showCost ? (
                  <TableCell className="tabular text-end">{p.costPrice !== undefined ? formatMoney(p.costPrice, tenant.currency, lang) : '—'}</TableCell>
                ) : null}
                <TableCell className="tabular text-end">
                  <span className={p.isLowStock ? 'text-warning-foreground font-semibold' : undefined}>{formatNumber(p.stockQty, lang)}</span>
                  {p.isLowStock ? (
                    <Badge className="bg-warning/15 text-warning-foreground ms-2">{t('lowStock')}</Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link to={`/inventory?productId=${p.id}`} aria-label={`${t('history')}: ${p.name}`} title={t('history')}>
                        <HistoryIcon />
                      </Link>
                    </Button>
                    {canManage ? (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => openForm(p)} aria-label={`${tc('actions.edit')}: ${p.name}`}>
                          <PencilIcon />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(p)} aria-label={`${tc('actions.delete')}: ${p.name}`}>
                          <Trash2Icon />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {products.data ? <PaginationBar meta={products.data.meta} onPage={setPage} /> : null}

      {canManage ? (
        <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} categories={categories.data ?? []} />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t('deleteTitle')}
        description={t('deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={tc('actions.delete')}
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}
