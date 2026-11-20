import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { errorCode } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { type RegisterValues, registerSchema } from './schemas';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(() => registerSchema(t), [t]);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: { businessName: '', name: '', email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await register(values);
      navigate('/', { replace: true });
    } catch (e) {
      const code = errorCode(e);
      if (code === 'EMAIL_TAKEN') form.setError('email', { message: te('EMAIL_TAKEN') });
      else setServerError(code);
    }
  });

  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {serverError ? <Alert>{te(serverError as 'INTERNAL_ERROR', { defaultValue: te('INTERNAL_ERROR') })}</Alert> : null}
        <FormField form={form} name="businessName" label={t('fields.businessName')} autoComplete="organization" />
        <FormField form={form} name="name" label={t('fields.name')} autoComplete="name" />
        <FormField form={form} name="email" label={t('fields.email')} type="email" autoComplete="email" dir="ltr" />
        <FormField
          form={form}
          name="password"
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          dir="ltr"
        />
        <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          {t('register.submit')}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-sm">
        {t('register.haveAccount')}{' '}
        <Link to="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          {t('register.toLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
