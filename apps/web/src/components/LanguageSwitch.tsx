import { LanguagesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'ar' ? 'en' : 'ar';
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(className)}
      lang={next}
      onClick={() => void i18n.changeLanguage(next)}
      aria-label={`${t('language.label')}: ${t('language.switchTo')}`}
    >
      <LanguagesIcon aria-hidden="true" />
      {t('language.switchTo')}
    </Button>
  );
}
