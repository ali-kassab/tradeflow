import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth, useSession } from '@/auth/context';
import { isOwner } from '@/auth/types';
import { Alert } from '@/components/Alert';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { toastError } from '@/lib/notify';
import type { TenantSettings } from '@/lib/types';
import { type PasswordValues, type TenantValues, passwordSchema, tenantSchema } from './settings-schemas';

/** Business name, currency and default VAT. Everyone can read them; only the owner can change them. */
function BusinessSection() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation();
  const { user } = useSession();
  const { reloadSession } = useAuth();
  const canEdit = isOwner(user.role);

  const tenant = useQuery({
    queryKey: ['tenant'],
    queryFn: async () => (await api.get<TenantSettings>('/tenant')).data,
  });

  return (
    <section aria-labelledby="set-business" className="panel p-4 sm:p-6">
      <h2 id="set-business" className="font-semibold">
        {t('business.title')}
      </h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{canEdit ? t('business.description') : t('business.readOnly')}</p>
      {tenant.isError ? <Alert>{tc('status.loadError')}</Alert> : null}
      {tenant.isPending ? <Skeleton className="h-40" /> : null}
      {tenant.data && canEdit ? <BusinessForm tenant={tenant.data} onSaved={reloadSession} /> : null}
      {tenant.data && !canEdit ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t('business.name')}</dt>
            <dd className="font-medium">{tenant.data.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('business.currency')}</dt>
            <dd className="font-medium" dir="ltr">
              {tenant.data.currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('business.taxRate')}</dt>
            <dd className="tabular font-medium">{t('business.taxRateValue', { value: plainRate(tenant.data.defaultTaxRate) })}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

// Decimal strings from the API ("14.00") are shown without trailing zeros ("14").
const plainRate = (v: string) => String(Number(v));

function BusinessForm({ tenant, onSaved }: { tenant: TenantSettings; onSaved: () => Promise<void> }) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation();
  const resolver = useMemo(() => zodResolver(tenantSchema(t)), [t]);
  const form = useForm<TenantValues>({
    resolver,
    defaultValues: { name: tenant.name, currency: tenant.currency, defaultTaxRate: plainRate(tenant.defaultTaxRate) },
  });

  const save = useMutation({
    mutationFn: async (v: TenantValues) =>
      (await api.patch<TenantSettings>('/tenant', { name: v.name.trim(), currency: v.currency.trim().toUpperCase(), defaultTaxRate: Number(v.defaultTaxRate) })).data,
    onSuccess: async (saved) => {
      form.reset({ name: saved.name, currency: saved.currency, defaultTaxRate: plainRate(saved.defaultTaxRate) });
      toast.success(tc('status.saved'));
      // The header, money formatting and new orders read the business from the session.
      await onSaved();
    },
    onError: toastError,
  });

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-3">
      <div className="sm:col-span-3">
        <FormField form={form} name="name" label={t('business.name')} autoComplete="organization" />
      </div>
      <div>
        <FormField form={form} name="currency" label={t('business.currency')} dir="ltr" className="text-start uppercase" maxLength={3} autoComplete="off" />
        <p className="text-muted-foreground mt-1 text-xs">{t('business.currencyHint')}</p>
      </div>
      <div>
        <FormField form={form} name="defaultTaxRate" label={t('business.taxRate')} inputMode="decimal" dir="ltr" className="tabular text-start" />
        <p className="text-muted-foreground mt-1 text-xs">{t('business.taxRateHint')}</p>
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
          {save.isPending ? <Spinner /> : null}
          {t('business.save')}
        </Button>
      </div>
    </form>
  );
}

/** Any user can change their own password; the API then signs out every session, this one included. */
function PasswordSection() {
  const { t } = useTranslation('settings');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const resolver = useMemo(() => zodResolver(passwordSchema(t)), [t]);
  const form = useForm<PasswordValues>({ resolver, defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });

  const change = useMutation({
    mutationFn: (v: PasswordValues) => api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: async () => {
      toast.success(t('password.changed'));
      await logout();
      void navigate('/login', { replace: true });
    },
    onError: toastError,
  });

  return (
    <section aria-labelledby="set-password" className="panel p-4 sm:p-6">
      <h2 id="set-password" className="font-semibold">
        {t('password.title')}
      </h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{t('password.description')}</p>
      <form noValidate onSubmit={form.handleSubmit((v) => change.mutate(v))} className="grid gap-4 sm:grid-cols-3">
        <FormField form={form} name="currentPassword" label={t('password.current')} type="password" autoComplete="current-password" />
        <FormField form={form} name="newPassword" label={t('password.new')} type="password" autoComplete="new-password" />
        <FormField form={form} name="confirmPassword" label={t('password.confirm')} type="password" autoComplete="new-password" />
        <div className="sm:col-span-3">
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? <Spinner /> : null}
            {t('password.submit')}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const { user } = useSession();
  const { t: tc } = useTranslation();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('title')} description={t('description', { name: user.name, role: tc(`roles.${user.role}`) })} />
      <BusinessSection />
      <PasswordSection />
    </div>
  );
}
