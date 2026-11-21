import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityReport } from './ActivityReport';
import { BalancesReport } from './BalancesReport';
import { InventoryReport } from './InventoryReport';
import { SalesReport } from './SalesReport';
import { REPORT_TABS, toReportTab } from './report-utils';

export default function ReportsPage() {
  const { t } = useTranslation('reports');
  // The tab lives in the URL (?tab=) so a report can be bookmarked or linked to.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = toReportTab(searchParams.get('tab'));

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />
      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === 'sales' ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          {REPORT_TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Radix mounts only the active tab's content, so each report fetches when opened. */}
        <TabsContent value="sales" className="mt-4">
          <SalesReport />
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <InventoryReport />
        </TabsContent>
        <TabsContent value="balances" className="mt-4">
          <BalancesReport />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
