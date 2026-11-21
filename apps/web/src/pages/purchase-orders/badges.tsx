import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { PurchaseOrderStatus } from '@/lib/types';
import { STATUS_BADGE } from '@/lib/status-badge';
import { cn } from '@/lib/utils';

// Same colour logic as sales orders: drafts are quiet, ordered is in progress (blue),
// received (billed) orders use the ledger green, cancelled ones fade out.
const STATUS_CLASS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'border-border text-muted-foreground bg-transparent',
  ORDERED: 'bg-info/10 text-info border-transparent',
  RECEIVED: 'bg-primary/12 text-primary border-transparent',
  CANCELLED: 'bg-muted text-muted-foreground border-transparent line-through before:hidden',
};

export function PurchaseStatusBadge({ status, className }: { status: PurchaseOrderStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(STATUS_BADGE, STATUS_CLASS[status], className)}>
      {t(`purchaseStatus.${status}`)}
    </Badge>
  );
}
