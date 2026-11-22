import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Http, addUser, basicSetup, createTestApp, registerBusiness } from './helpers.js';

/**
 * Regression tests for defects found in the release-readiness audit (2026-11-21).
 * Each of these inputs used to crash with 500 INTERNAL_ERROR, or (reports) put
 * orders on the wrong day.
 */
describe('Audit regressions', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: Http;
  let product: { id: number };
  let customer: { id: number };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ http: owner } = await registerBusiness(app, 'Regression Co'));
    ({ product, customer } = await basicSetup(owner, { stock: 50 }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects null for NOT NULL fields with 400 instead of a database error', async () => {
    const supplier = (await owner.post('/suppliers', { name: 'Sup' }).expect(201)).body;
    await addUser(app, owner, 'STAFF');
    const staffUser = (await owner.get('/users').expect(200)).body.find((u: { role: string }) => u.role === 'STAFF');

    const cases: [string, object][] = [
      [`/products/${product.id}`, { name: null }],
      [`/products/${product.id}`, { sku: null }],
      [`/products/${product.id}`, { salePrice: null }],
      [`/products/${product.id}`, { costPrice: null }],
      [`/products/${product.id}`, { isActive: null }],
      [`/customers/${customer.id}`, { name: null }],
      [`/customers/${customer.id}`, { isActive: null }],
      [`/suppliers/${supplier.id}`, { name: null }],
      [`/suppliers/${supplier.id}`, { isActive: null }],
      ['/tenant', { name: null }],
      ['/tenant', { currency: null }],
      ['/tenant', { defaultTaxRate: null }],
      [`/users/${staffUser.id}`, { name: null }],
      [`/users/${staffUser.id}`, { role: null }],
    ];
    for (const [url, body] of cases) {
      const res = await owner.patch(url, body);
      expect({ url, body, status: res.status, code: res.body.code }).toEqual({
        url, body, status: 400, code: 'VALIDATION_ERROR',
      });
    }
    await owner
      .post('/products', { sku: 'NULL-UNIT', name: 'x', salePrice: 1, unit: null })
      .expect(400);
  });

  it('still lets nullable fields be cleared with null', async () => {
    const cat = (await owner.post('/categories', { name: 'Clearable' }).expect(201)).body;
    await owner.patch(`/products/${product.id}`, { categoryId: cat.id }).expect(200);
    const p = (await owner.patch(`/products/${product.id}`, { categoryId: null }).expect(200)).body;
    expect(p.categoryId).toBeNull();
    const c = (
      await owner
        .patch(`/customers/${customer.id}`, { phone: null, email: null, address: null, taxNumber: null, notes: null, creditLimit: null })
        .expect(200)
    ).body;
    expect([c.phone, c.email, c.creditLimit]).toEqual([null, null, null]);
    // The partial update still works for normal values.
    expect((await owner.patch(`/customers/${customer.id}`, { name: 'Renamed' }).expect(200)).body.name).toBe('Renamed');
  });

  it('rejects out-of-range numbers with 400 instead of an SQL overflow', async () => {
    const supplier = (await owner.post('/suppliers', { name: 'Big' }).expect(201)).body;
    const cases: [string, string, object][] = [
      ['post', '/inventory/adjustments', { productId: product.id, quantity: 2 ** 31, note: 'overflow' }],
      ['post', '/products', { sku: 'BIG-REORDER', name: 'x', salePrice: 1, reorderLevel: 1e12 }],
      ['post', '/payments/customer', { customerId: customer.id, amount: 1e15, method: 'CASH' }],
      ['post', '/customers', { name: 'Big', creditLimit: 1e15 }],
      ['put', `/customers/${customer.id}/prices`, { prices: [{ productId: product.id, price: 1e15 }] }],
      ['post', '/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1, unitPrice: 1e13 }] }],
      ['post', '/purchase-orders', { supplierId: supplier.id, items: [{ productId: product.id, quantity: 1, unitCost: 1e15 }] }],
    ];
    for (const [method, url, body] of cases) {
      const res = await (method === 'put' ? owner.put(url, body) : owner.post(url, body));
      expect({ url, status: res.status, code: res.body.code }).toEqual({ url, status: 400, code: 'VALIDATION_ERROR' });
    }

    // Individually valid values whose product overflows DECIMAL(14,2).
    const pricey = (await owner.post('/products', { sku: 'PRICEY', name: 'p', salePrice: 999_999_999_999.99 }).expect(201)).body;
    const res = await owner.post('/sales-orders', { customerId: customer.id, items: [{ productId: pricey.id, quantity: 1_000_000 }] });
    expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('answers 404 for ids beyond the INT range instead of 500', async () => {
    for (const url of ['/products/100000000000000000000', '/customers/9223372036854775808', '/sales-orders/2147483648']) {
      const res = await owner.get(url);
      expect({ url, status: res.status, code: res.body.code }).toEqual({ url, status: 404, code: 'NOT_FOUND' });
    }
    await owner.get('/products/abc').expect(400);
  });

  it('rejects impossible calendar dates and blank audit reasons', async () => {
    await owner
      .post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }], orderDate: '2026-02-30' })
      .expect(400);
    await owner.get('/reports/sales?from=2026-02-30').expect(400);
    await owner.post('/inventory/adjustments', { productId: product.id, quantity: 1, note: '   ' }).expect(400);
    const pay = (await owner.post('/payments/customer', { customerId: customer.id, amount: 1, method: 'CASH' }).expect(201)).body;
    await owner.post(`/payments/customer/${pay.id}/void`, { reason: '  ' }).expect(400);
  });

  it('puts orders confirmed just after local midnight on the local day in charts and reports', async () => {
    const { http } = await registerBusiness(app, 'Midnight Co');
    const setup = await basicSetup(http, { stock: 10 });
    const order = (await http.post('/sales-orders', { customerId: setup.customer.id, items: [{ productId: setup.product.id, quantity: 1 }] }).expect(201)).body;
    await http.post(`/sales-orders/${order.id}/confirm`).expect(201);

    const now = new Date();
    const halfPastMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 30);
    await prisma.salesOrder.update({ where: { id: order.id }, data: { confirmedAt: halfPastMidnight } });
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const dash = (await http.get('/dashboard').expect(200)).body;
    expect(dash.ordersToday).toBe(1);
    expect(dash.salesLast30Days.find((d: { date: string }) => d.date === today)).toEqual({ date: today, orders: 1, revenue: '100.00' });

    const rep = (await http.get(`/reports/sales?from=${today}&to=${today}`).expect(200)).body;
    expect(rep.summary.orders).toBe(1);
    expect(rep.summary.total).toBe('100.00');
    expect(rep.byDay).toEqual([{ date: today, orders: 1, revenue: '100.00' }]);
  });
});
