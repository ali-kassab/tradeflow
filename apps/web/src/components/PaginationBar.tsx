import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import type { Paginated } from '@/lib/types';

/** Previous / next pager for the API's `{ data, meta }` lists. Chevrons mirror in RTL. */
export function PaginationBar({ meta, onPage }: { meta: Paginated<unknown>['meta']; onPage: (page: number) => void }) {
  const { t, i18n } = useTranslation();
  if (meta.pageCount <= 1) return null;
  const n = (v: number) => formatNumber(v, i18n.language);
  return (
    <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label={t('pagination.label')}>
      <p className="text-muted-foreground">
        {t('pagination.summary', { page: n(meta.page), pageCount: n(meta.pageCount), total: n(meta.total) })}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          <ChevronLeftIcon className="rtl:rotate-180" aria-hidden="true" />
          {t('pagination.previous')}
        </Button>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.pageCount} onClick={() => onPage(meta.page + 1)}>
          {t('pagination.next')}
          <ChevronRightIcon className="rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
