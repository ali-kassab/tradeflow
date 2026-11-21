import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Controller, type UseFormReturn, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { toastError } from '@/lib/notify';
import type { UserAccount } from '@/lib/types';
import { PasswordField } from './PasswordField';
import { type CreateUserValues, type EditUserValues, ROLES, createUserSchema, editUserSchema } from './user-schemas';

function RoleSelect({ form, disabled }: { form: UseFormReturn<CreateUserValues> | UseFormReturn<EditUserValues>; disabled?: boolean }) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const f = form as UseFormReturn<EditUserValues>;
  return (
    <Field>
      <FieldLabel htmlFor="f-role">{t('fields.role')}</FieldLabel>
      <Controller
        control={f.control}
        name="role"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger id="f-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {tc(`roles.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <p className="text-muted-foreground text-xs">{t('fields.roleHint')}</p>
    </Field>
  );
}

/** The form lives inside DialogContent, so every opening starts fresh. */
function CreateForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const qc = useQueryClient();
  const resolver = useMemo(() => zodResolver(createUserSchema(t)), [t]);
  const form = useForm<CreateUserValues>({ resolver, defaultValues: { name: '', email: '', password: '', role: 'STAFF' } });

  const save = useMutation({
    mutationFn: async (v: CreateUserValues) => (await api.post<UserAccount>('/users', v)).data,
    onSuccess: (u) => {
      toast.success(t('created', { name: u.name }));
      void qc.invalidateQueries({ queryKey: ['users'] });
      onDone();
    },
    onError: toastError,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('addTitle')}</DialogTitle>
        <DialogDescription>{t('addDescription')}</DialogDescription>
      </DialogHeader>
      <form id="user-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
        <FormField form={form} name="name" label={t('fields.name')} autoComplete="off" />
        <FormField form={form} name="email" label={t('fields.email')} type="email" dir="ltr" className="text-start" autoComplete="off" />
        <PasswordField form={form} name="password" label={t('fields.tempPassword')} />
        <RoleSelect form={form} />
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          {tc('actions.cancel')}
        </Button>
        <Button type="submit" form="user-form" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {t('add')}
        </Button>
      </DialogFooter>
    </>
  );
}

function EditForm({ user, isSelf, onDone }: { user: UserAccount; isSelf: boolean; onDone: (saved: UserAccount) => void }) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const qc = useQueryClient();
  const resolver = useMemo(() => zodResolver(editUserSchema(t)), [t]);
  const form = useForm<EditUserValues>({ resolver, defaultValues: { name: user.name, role: user.role, isActive: user.isActive } });

  const save = useMutation({
    // The API refuses role/status changes on yourself (CANNOT_MODIFY_SELF), so only the name is sent then.
    mutationFn: async (v: EditUserValues) => (await api.patch<UserAccount>(`/users/${user.id}`, isSelf ? { name: v.name } : v)).data,
    onSuccess: (saved) => {
      toast.success(tc('status.saved'));
      void qc.invalidateQueries({ queryKey: ['users'] });
      onDone(saved);
    },
    onError: toastError,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('editTitle')}</DialogTitle>
        <DialogDescription dir="ltr" className="text-start">
          {user.email}
        </DialogDescription>
      </DialogHeader>
      <form id="user-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
        <FormField form={form} name="name" label={t('fields.name')} autoComplete="off" />
        <RoleSelect form={form} disabled={isSelf} />
        <Field orientation="horizontal" className="items-center">
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <Checkbox id="f-isActive" checked={field.value} disabled={isSelf} onCheckedChange={(v) => field.onChange(v === true)} />
            )}
          />
          <FieldLabel htmlFor="f-isActive">{t('fields.isActive')}</FieldLabel>
        </Field>
        <p className="text-muted-foreground -mt-2 text-xs">{isSelf ? t('fields.selfHint') : t('fields.isActiveHint')}</p>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone(user)} disabled={save.isPending}>
          {tc('actions.cancel')}
        </Button>
        <Button type="submit" form="user-form" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {tc('actions.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent: add a user. */
  user?: UserAccount;
  isSelf?: boolean;
  onSaved?: (saved: UserAccount) => void;
}

/** Add a user, or edit one's name, role and access (owner only; the API enforces it). */
export function UserFormDialog({ open, onOpenChange, user, isSelf = false, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        {user ? (
          <EditForm
            user={user}
            isSelf={isSelf}
            onDone={(saved) => {
              if (saved !== user) onSaved?.(saved);
              onOpenChange(false);
            }}
          />
        ) : (
          <CreateForm onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
