import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useSession } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { toastError } from '@/lib/notify';
import type { Customer, Paginated } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';
import { CustomerFormDialog } from './CustomerFormDialog';
import { isOverLimit } from './credit';

type Status = 'active' | 'inactive' | 'all';
const COLUMNS = 5;

export default function CustomersPage() {
  const { t, i18n } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const { user, tenant } = useSession();
  const canDelete = isManagerOrAbove(user.role); // STAFF may create and edit, not delete
  const lang = i18n.language;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());

  const [editing, setEditing] = useState<Customer | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Customer | undefined>();

  const params = { page, pageSize: 20, status, ...(debouncedSearch ? { search: debouncedSearch } : {}) };
  const customers = useQuery({
    queryKey: ['customers', params],
    queryFn: async () => (await api.get<Paginated<Customer>>('/customers', { params })).data,
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (c: Customer) => api.delete(`/customers/${c.id}`),
    onSuccess: () => {
      toast.success(tc('status.deleted'));
      setDeleting(undefined);
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => {
      setDeleting(undefined);
      toastError(e);
    },
  });

  const openForm = (c?: Customer) => {
    setEditing(c);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => openForm()}>
            <PlusIcon aria-hidden="true" />
            {t('add')}
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
            setStatus(v as Status);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-32" aria-label={t('filters.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t('filters.active')}</SelectItem>
            <SelectItem value="inactive">{t('filters.inactive')}</SelectItem>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {customers.isError ? <Alert>{tc('status.loadError')}</Alert> : null}

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.phone')}</TableHead>
              <TableHead className="text-end">{t('columns.creditLimit')}</TableHead>
              <TableHead className="text-end">{t('columns.balance')}</TableHead>
              <TableHead className={canDelete ? 'w-24' : 'w-12'}><span className="sr-only">{tc('actions.actions')}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={COLUMNS}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  </TableRow>
                ))
              : null}
            {customers.data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS} className="text-muted-foreground py-10 text-center">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : null}
            {customers.data?.data.map((c) => {
              const over = isOverLimit(c);
              const balance = Number(c.balance);
              return (
                <TableRow key={c.id} className={c.isActive ? undefined : 'text-muted-foreground'}>
                  <TableCell className="font-medium">
                    <Link to={`/customers/${c.id}`} className="hover:text-primary underline-offset-4 hover:underline">
                      {c.name}
                    </Link>
                    {!c.isActive ? (
                      <Badge variant="outline" className="ms-2">
                        {t('inactive')}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell dir="ltr" className="tabular text-start">{c.phone ?? '—'}</TableCell>
                  <TableCell className="tabular text-end">{c.creditLimit != null ? formatMoney(c.creditLimit, tenant.currency, lang) : '—'}</TableCell>
                  <TableCell className="tabular text-end">
                    <span className={cn(over && 'text-warning-foreground font-semibold', balance < 0 && 'text-primary')}>
                      {formatMoney(c.balance, tenant.currency, lang)}
                    </span>
                    {over ? <Badge className="bg-warning/15 text-warning-foreground ms-2">{t('overLimit')}</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openForm(c)} aria-label={`${tc('actions.edit')}: ${c.name}`}>
                        <PencilIcon />
                      </Button>
                      {canDelete ? (
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(c)} aria-label={`${tc('actions.delete')}: ${c.name}`}>
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {customers.data ? <PaginationBar meta={customers.data.meta} onPage={setPage} /> : null}

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onCreated={(c) => void navigate(`/customers/${c.id}`)}
      />
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
