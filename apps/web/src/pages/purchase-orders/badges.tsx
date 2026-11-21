import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { PurchaseOrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

// Same colour logic as sales orders: drafts are quiet, received (billed) orders use the
// ledger green, cancelled ones fade out.
const STATUS_CLASS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'border-border text-muted-foreground bg-transparent',
  ORDERED: 'bg-primary/10 text-primary border-transparent',
  RECEIVED: 'bg-primary text-primary-foreground border-transparent',
  CANCELLED: 'bg-muted text-muted-foreground border-transparent line-through',
};

export function PurchaseStatusBadge({ status, className }: { status: PurchaseOrderStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status], className)}>
      {t(`purchaseStatus.${status}`)}
    </Badge>
  );
}
