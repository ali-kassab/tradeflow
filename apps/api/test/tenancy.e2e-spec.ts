import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Http, basicSetup, createTestApp, registerBusiness } from './helpers.js';

/**
 * Business A owns data; business B tries to read it, change it, and — more
 * subtly — reference it from B's own records. Every attempt must fail as if the
 * record did not exist.
 */
describe('Tenant isolation', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let a: Http;
  let b: Http;
  const A = {} as Record<
    'product' | 'customer' | 'supplier' | 'category' | 'order' | 'po' | 'payment' | 'supplierPayment',
    { id: number }
  >;
  let bCustomer: { id: number };
  let bProduct: { id: number };
  let bSupplier: { id: number };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    a = (await registerBusiness(app, 'Business A')).http;
    b = (await registerBusiness(app, 'Business B')).http;

    const setupA = await basicSetup(a, { stock: 50 });
    A.product = setupA.product;
    A.customer = setupA.customer;
    A.category = (await a.post('/categories', { name: 'A-cat' }).expect(201)).body;
    A.supplier = (await a.post('/suppliers', { name: 'A supplier' }).expect(201)).body;
    A.order = (await a.post('/sales-orders', { customerId: A.customer.id, items: [{ productId: A.product.id, quantity: 1 }] }).expect(201)).body;
    await a.post(`/sales-orders/${A.order.id}/confirm`).expect(201);
    A.payment = (await a.post('/payments/customer', { customerId: A.customer.id, amount: 10, method: 'CASH' }).expect(201)).body;
    A.po = (await a.post('/purchase-orders', { supplierId: A.supplier.id, items: [{ productId: A.product.id, quantity: 1 }] }).expect(201)).body;
    await a.post(`/purchase-orders/${A.po.id}/receive`).expect(201);
    A.supplierPayment = (await a.post('/payments/supplier', { supplierId: A.supplier.id, amount: 5, method: 'CASH' }).expect(201)).body;

    const setupB = await basicSetup(b);
    bCustomer = setupB.customer;
    bProduct = setupB.product;
    bSupplier = (await b.post('/suppliers', { name: 'B supplier' }).expect(201)).body;
  });
  afterAll(() => app.close());

  it('cannot read another business’s records', async () => {
    await b.get(`/products/${A.product.id}`).expect(404);
    await b.get(`/customers/${A.customer.id}`).expect(404);
    await b.get(`/customers/${A.customer.id}/statement`).expect(404);
    await b.get(`/customers/${A.customer.id}/prices`).expect(404);
    await b.get(`/suppliers/${A.supplier.id}`).expect(404);
    await b.get(`/sales-orders/${A.order.id}`).expect(404);
    await b.get(`/purchase-orders/${A.po.id}`).expect(404);

    // Each list is checked against A's id for the *same* entity (ids are per table).
    const checks: [string, number][] = [
      ['/products', A.product.id],
      ['/customers', A.customer.id],
      ['/sales-orders', A.order.id],
      ['/payments/customer', A.payment.id],
      ['/payments/supplier', A.supplierPayment.id],
      ['/purchase-orders', A.po.id],
    ];
    for (const [url, aId] of checks) {
      const ids = (await b.get(url).expect(200)).body.data.map((r: { id: number }) => r.id);
      expect(ids, url).not.toContain(aId);
    }
    const movements = await b.get(`/inventory/movements?productId=${A.product.id}`).expect(200);
    expect(movements.body.data).toHaveLength(0);
    const cats = (await b.get('/categories').expect(200)).body;
    expect(cats.map((c: { id: number }) => c.id)).not.toContain(A.category.id);
  });

  it('cannot modify another business’s records', async () => {
    await b.patch(`/products/${A.product.id}`, { name: 'hacked' }).expect(404);
    await b.delete(`/products/${A.product.id}`).expect(404);
    await b.patch(`/customers/${A.customer.id}`, { name: 'hacked' }).expect(404);
    await b.patch(`/categories/${A.category.id}`, { name: 'hacked' }).expect(404);
    await b.post(`/sales-orders/${A.order.id}/cancel`).expect(404);
    await b.post(`/purchase-orders/${A.po.id}/cancel`).expect(404);
    await b.post(`/payments/customer/${A.payment.id}/void`, { reason: 'x x' }).expect(404);
    await b.post(`/payments/supplier/${A.supplierPayment.id}/void`, { reason: 'x x' }).expect(404);
    await b.post('/inventory/adjustments', { productId: A.product.id, quantity: -1, note: 'steal' }).expect(404);

    const product = (await a.get(`/products/${A.product.id}`)).body;
    expect(product.name).toBe('Rice 5kg');
    expect((await a.get(`/sales-orders/${A.order.id}`)).body.status).toBe('CONFIRMED');
  });

  it('cannot reference another business’s records from its own data', async () => {
    // Orders with A's customer or A's product.
    await b.post('/sales-orders', { customerId: A.customer.id, items: [{ productId: bProduct.id, quantity: 1 }] }).expect(404);
    await b.post('/sales-orders', { customerId: bCustomer.id, items: [{ productId: A.product.id, quantity: 1 }] }).expect(404);
    // Purchase orders with A's supplier or product.
    await b.post('/purchase-orders', { supplierId: A.supplier.id, items: [{ productId: bProduct.id, quantity: 1 }] }).expect(404);
    await b.post('/purchase-orders', { supplierId: bSupplier.id, items: [{ productId: A.product.id, quantity: 1 }] }).expect(404);
    // Payments against A's customer, supplier or orders.
    await b.post('/payments/customer', { customerId: A.customer.id, amount: 1, method: 'CASH' }).expect(404);
    await b.post('/payments/customer', { customerId: bCustomer.id, salesOrderId: A.order.id, amount: 1, method: 'CASH' }).expect(404);
    await b.post('/payments/supplier', { supplierId: A.supplier.id, amount: 1, method: 'CASH' }).expect(404);
    await b.post('/payments/supplier', { supplierId: bSupplier.id, purchaseOrderId: A.po.id, amount: 1, method: 'CASH' }).expect(404);
    // A product in A's category; customer price for A's product.
    await b.post('/products', { sku: 'X1', name: 'X', salePrice: 1, categoryId: A.category.id }).expect(404);
    await b.patch(`/products/${bProduct.id}`, { categoryId: A.category.id }).expect(404);
    await b.put(`/customers/${bCustomer.id}/prices`, { prices: [{ productId: A.product.id, price: 1 }] }).expect(404);

    // Nothing leaked into A's balances.
    expect((await a.get(`/customers/${A.customer.id}`)).body.balance).toBe('90.00');
  });

  it('the database itself rejects cross-tenant links (composite foreign keys)', async () => {
    const bOrder = (await b.post('/sales-orders', { customerId: bCustomer.id, items: [{ productId: bProduct.id, quantity: 1 }] }).expect(201)).body;
    const bTenantId = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: bOrder.id } })).tenantId;

    // B's order line pointing at A's product: blocked by FK (tenantId, productId).
    await expect(
      prisma.salesOrderItem.create({
        data: {
          tenantId: bTenantId, salesOrderId: bOrder.id, productId: A.product.id,
          productName: 'x', sku: 'x', quantity: 1, unitPrice: 1, lineTotal: 1,
        },
      }),
    ).rejects.toThrow();

    // B's order for A's customer: blocked by FK (tenantId, customerId).
    await expect(
      prisma.salesOrder.create({
        data: { tenantId: bTenantId, number: 'SO-X', customerId: A.customer.id, createdById: 1 },
      }),
    ).rejects.toThrow();

    // And stock can never go negative (CHECK constraint).
    await expect(
      prisma.product.update({ where: { id: bProduct.id }, data: { stockQty: -1 } }),
    ).rejects.toThrow();
  });
});
