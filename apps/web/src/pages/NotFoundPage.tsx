import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="py-20 text-center">
      <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight">{t('notFound.title')}</h1>
      <p className="text-muted-foreground mt-2">{t('notFound.body')}</p>
      <Button asChild className="mt-6">
        <Link to="/">{t('notFound.back')}</Link>
      </Button>
    </div>
  );
}
