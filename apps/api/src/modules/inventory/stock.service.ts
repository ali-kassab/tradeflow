import { Injectable } from '@nestjs/common';
import type { Prisma, StockMovementType } from '../../generated/prisma/client.js';
import { ErrorCode, badRequest, notFound } from '../../common/errors.js';

export interface StockChange {
  tenantId: number;
  productId: number;
  /** Signed: negative removes stock. */
  delta: number;
  type: StockMovementType;
  userId: number;
  refType?: string;
  refId?: number;
  note?: string;
}

/**
 * The only code path that changes `Product.stockQty`. Every change writes a
 * StockMovement in the same transaction, so the ledger always explains the
 * current quantity.
 */
@Injectable()
export class StockService {
  async apply(tx: Prisma.TransactionClient, c: StockChange): Promise<number> {
    if (!Number.isInteger(c.delta) || c.delta === 0) {
      throw badRequest(ErrorCode.VALIDATION_ERROR, 'Quantity change must be a non-zero integer');
    }

    // Conditional atomic update: a decrement only succeeds if enough stock is
    // available at that instant. Concurrent orders cannot oversell.
    const { count } = await tx.product.updateMany({
      where: {
        id: c.productId,
        tenantId: c.tenantId,
        ...(c.delta < 0 ? { stockQty: { gte: -c.delta } } : {}),
      },
      data: { stockQty: { increment: c.delta } },
    });

    const product = await tx.product.findFirst({
      where: { id: c.productId, tenantId: c.tenantId },
      select: { id: true, name: true, sku: true, stockQty: true },
    });
    if (!product) throw notFound('Product');
    if (count === 0) {
      throw badRequest(ErrorCode.INSUFFICIENT_STOCK, 'Insufficient stock', {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        available: product.stockQty,
        requested: -c.delta,
      });
    }

    await tx.stockMovement.create({
      data: {
        tenantId: c.tenantId,
        productId: c.productId,
        type: c.type,
        quantity: c.delta,
        balanceAfter: product.stockQty,
        refType: c.refType,
        refId: c.refId,
        note: c.note,
        userId: c.userId,
      },
    });
    return product.stockQty;
  }
}
