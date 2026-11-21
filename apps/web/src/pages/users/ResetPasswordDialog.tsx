import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { toastError } from '@/lib/notify';
import type { UserAccount } from '@/lib/types';
import { PasswordField } from './PasswordField';
import { type ResetPasswordValues, resetPasswordSchema } from './user-schemas';

function ResetForm({ user, onDone }: { user: UserAccount; onDone: () => void }) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const resolver = useMemo(() => zodResolver(resetPasswordSchema(t)), [t]);
  const form = useForm<ResetPasswordValues>({ resolver, defaultValues: { password: '' } });

  const reset = useMutation({
    mutationFn: (v: ResetPasswordValues) => api.post(`/users/${user.id}/reset-password`, v),
    onSuccess: () => {
      toast.success(t('reset.done', { name: user.name }));
      onDone();
    },
    onError: toastError,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('reset.title', { name: user.name })}</DialogTitle>
        <DialogDescription>{t('reset.description')}</DialogDescription>
      </DialogHeader>
      <form id="reset-form" noValidate onSubmit={form.handleSubmit((v) => reset.mutate(v))}>
        <PasswordField form={form} name="password" label={t('fields.tempPassword')} />
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={reset.isPending}>
          {tc('actions.cancel')}
        </Button>
        <Button type="submit" form="reset-form" disabled={reset.isPending}>
          {reset.isPending ? <Spinner /> : null}
          {t('reset.submit')}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Sets a new temporary password for another user and signs them out everywhere (owner only). */
export function ResetPasswordDialog({ user, onOpenChange }: { user: UserAccount | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{user ? <ResetForm user={user} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}
