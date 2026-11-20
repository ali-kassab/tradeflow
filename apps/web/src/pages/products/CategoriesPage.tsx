import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSession } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, errorCode } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { toastError } from '@/lib/notify';
import type { Category } from '@/lib/types';
import { useCategories } from '@/lib/queries';

export default function CategoriesPage() {
  const { t, i18n } = useTranslation('products');
  const { t: tc } = useTranslation();
  const { t: te } = useTranslation('errors');
  const { user } = useSession();
  const canManage = isManagerOrAbove(user.role);
  const qc = useQueryClient();
  const categories = useCategories();

  const [dialog, setDialog] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | undefined>();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['categories'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };

  const save = useMutation({
    mutationFn: (v: { id?: number; name: string }) =>
      v.id ? api.patch(`/categories/${v.id}`, { name: v.name }) : api.post('/categories', { name: v.name }),
    onSuccess: () => {
      toast.success(tc('status.saved'));
      setDialog({ open: false });
      invalidate();
    },
    onError: (e) => {
      if (errorCode(e) === 'NAME_TAKEN') setNameError(te('NAME_TAKEN'));
      else toastError(e);
    },
  });

  const remove = useMutation({
    mutationFn: (c: Category) => api.delete(`/categories/${c.id}`),
    onSuccess: () => {
      toast.success(tc('status.deleted'));
      invalidate();
    },
    onError: toastError,
    onSettled: () => setDeleting(undefined),
  });

  const open = (category?: Category) => {
    setName(category?.name ?? '');
    setNameError(null);
    setDialog({ open: true, category });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return setNameError(t('validation.required'));
    if (v.length > 100) return setNameError(t('validation.tooLong'));
    save.mutate({ id: dialog.category?.id, name: v });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t('categories.title')}
        description={t('categories.description')}
        actions={
          canManage ? (
            <Button onClick={() => open()}>
              <PlusIcon aria-hidden="true" />
              {t('categories.add')}
            </Button>
          ) : null
        }
      />
      {categories.isError ? <Alert>{tc('status.loadError')}</Alert> : null}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('categories.name')}</TableHead>
              <TableHead className="text-end">{t('categories.products')}</TableHead>
              {canManage ? <TableHead className="w-24"><span className="sr-only">{tc('actions.actions')}</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.isPending ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-5" />
                </TableCell>
              </TableRow>
            ) : null}
            {categories.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-10 text-center">
                  {t('categories.empty')}
                </TableCell>
              </TableRow>
            ) : null}
            {categories.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="tabular text-end">{formatNumber(c.productCount, i18n.language)}</TableCell>
                {canManage ? (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => open(c)} aria-label={`${tc('actions.edit')}: ${c.name}`}>
                        <PencilIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(c)} aria-label={`${tc('actions.delete')}: ${c.name}`}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.category ? t('categories.renameTitle') : t('categories.addTitle')}</DialogTitle>
          </DialogHeader>
          <form id="category-form" onSubmit={submit} noValidate>
            <Field data-invalid={nameError ? true : undefined}>
              <FieldLabel htmlFor="category-name">{t('categories.name')}</FieldLabel>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                aria-invalid={nameError ? true : undefined}
                autoFocus
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })} disabled={save.isPending}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form="category-form" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {tc('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t('categories.deleteTitle')}
        description={t('categories.deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={tc('actions.delete')}
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}
