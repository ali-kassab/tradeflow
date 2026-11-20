import type { DocumentType, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { notFound } from './errors.js';

/** Either the root client or an interactive-transaction client. */
export type Db = PrismaClient | Prisma.TransactionClient;

type OwnedModel =
  | 'category'
  | 'product'
  | 'customer'
  | 'supplier'
  | 'salesOrder'
  | 'purchaseOrder';

/**
 * Asserts that `id` exists *inside the caller's tenant*. Used before writing any
 * reference (e.g. product.categoryId, payment.salesOrderId) so that another
 * business's record can never be linked, only "not found".
 */
export async function assertOwned(
  db: Db,
  model: OwnedModel,
  tenantId: number,
  id: number,
  label: string,
): Promise<void> {
  const delegate = db[model] as unknown as {
    count(args: { where: { id: number; tenantId: number } }): Promise<number>;
  };
  const found = await delegate.count({ where: { id, tenantId } });
  if (found === 0) throw notFound(label);
}

const prefixes: Record<DocumentType, string> = {
  SALES_ORDER: 'SO',
  PURCHASE_ORDER: 'PO',
};

/**
 * Gap-free per-tenant document numbers (SO-00001, PO-00001). The upsert takes a
 * row lock that is held until the surrounding transaction commits, so two
 * concurrent orders can never receive the same number.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  docType: DocumentType,
): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO DocumentSequence (tenantId, docType, nextValue)
    VALUES (${tenantId}, ${docType}, 1)
    ON DUPLICATE KEY UPDATE nextValue = nextValue + 1`;
  const row = await tx.documentSequence.findUniqueOrThrow({
    where: { tenantId_docType: { tenantId, docType } },
  });
  return `${prefixes[docType]}-${String(row.nextValue).padStart(5, '0')}`;
}

export async function logActivity(
  db: Db,
  entry: {
    tenantId: number;
    userId: number;
    action: string;
    entityType: string;
    entityId: number;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.activityLog.create({ data: entry });
}
