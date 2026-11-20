import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/auth/context';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { errorCode } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { type LoginValues, loginSchema } from './schemas';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(() => loginSchema(t), [t]);
  const form = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') ? from : '/', { replace: true });
    } catch (e) {
      setServerError(errorCode(e));
    }
  });

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {serverError ? <Alert>{te(serverError as 'INTERNAL_ERROR', { defaultValue: te('INTERNAL_ERROR') })}</Alert> : null}
        <FormField form={form} name="email" label={t('fields.email')} type="email" autoComplete="email" dir="ltr" />
        <FormField
          form={form}
          name="password"
          label={t('fields.password')}
          type="password"
          autoComplete="current-password"
          dir="ltr"
        />
        <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          {t('login.submit')}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-sm">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="text-primary font-medium underline-offset-4 hover:underline">
          {t('login.toRegister')}
        </Link>
      </p>
      <p className="text-muted-foreground mt-8 rounded-md border border-dashed p-3 text-xs leading-relaxed">
        {t('login.demoHint')}
      </p>
    </AuthLayout>
  );
}
