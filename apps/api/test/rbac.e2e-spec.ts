import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { type Http, addUser, basicSetup, createTestApp, registerBusiness, uniqueEmail } from './helpers.js';

describe('Role-based access control', () => {
  let app: INestApplication<App>;
  let owner: Http;
  let manager: Http;
  let staff: Http;
  let product: { id: number };
  let customer: { id: number };

  beforeAll(async () => {
    ({ app } = await createTestApp());
    owner = (await registerBusiness(app)).http;
    manager = await addUser(app, owner, 'MANAGER');
    staff = await addUser(app, owner, 'STAFF');
    ({ product, customer } = await basicSetup(owner, { cost: 70, price: 100 }));
  });
  afterAll(() => app.close());

  it('never sends cost prices to STAFF', async () => {
    const list = (await staff.get('/products').expect(200)).body.data;
    expect(list[0]).not.toHaveProperty('costPrice');
    expect((await staff.get(`/products/${product.id}`).expect(200)).body).not.toHaveProperty('costPrice');
    expect((await manager.get(`/products/${product.id}`).expect(200)).body.costPrice).toBe('70');
  });

  it('never sends order line costs or profit to STAFF', async () => {
    const order = (await staff.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }).expect(201)).body;
    const confirmed = (await staff.post(`/sales-orders/${order.id}/confirm`).expect(201)).body;
    expect(confirmed.items[0]).not.toHaveProperty('unitCost');
    expect((await owner.get(`/sales-orders/${order.id}`)).body.items[0].unitCost).toBe('70');

    const dash = (await staff.get('/dashboard').expect(200)).body;
    for (const key of ['grossProfitThisMonth', 'inventoryValue', 'payables']) {
      expect(dash).not.toHaveProperty(key);
    }
    expect(dash).toHaveProperty('salesToday');
  });

  it('blocks STAFF from restricted reports, suppliers, purchasing and admin', async () => {
    for (const url of ['/reports/sales', '/reports/inventory', '/reports/balances', '/reports/activity', '/suppliers', '/purchase-orders', '/payments/supplier', '/users']) {
      const res = await staff.get(url);
      expect([url, res.status]).toEqual([url, 403]);
      expect(res.body.code).toBe('FORBIDDEN');
    }
    await staff.post('/products', { sku: 'S1', name: 'S', salePrice: 1 }).expect(403);
    await staff.post('/inventory/adjustments', { productId: product.id, quantity: 5, note: 'more' }).expect(403);
    await staff.patch('/tenant', { name: 'x' }).expect(403);
  });

  it('lets STAFF sell and collect, but not cancel confirmed orders, override prices or void payments', async () => {
    const order = (await staff.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }).expect(201)).body;
    await staff.post(`/sales-orders/${order.id}/confirm`).expect(201);
    const pay = (await staff.post('/payments/customer', { customerId: customer.id, amount: 10, method: 'CASH' }).expect(201)).body;

    await staff.post(`/sales-orders/${order.id}/cancel`).expect(403);
    await staff.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1, unitPrice: 1 }] }).expect(403);
    await staff.post(`/payments/customer/${pay.id}/void`, { reason: 'mistake' }).expect(403);

    // Managers can do all three.
    await manager.post(`/sales-orders/${order.id}/cancel`).expect(201);
    await manager.post(`/payments/customer/${pay.id}/void`, { reason: 'mistake' }).expect(201);
    const priced = (await manager.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1, unitPrice: 95 }] }).expect(201)).body;
    expect(priced.items[0].unitPrice).toBe('95');

    // Staff may cancel their own draft.
    const draft = (await staff.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }).expect(201)).body;
    await staff.post(`/sales-orders/${draft.id}/cancel`).expect(201);
  });

  it('reserves user management and business settings for the OWNER', async () => {
    await manager.get('/users').expect(403);
    await manager.patch('/tenant', { name: 'x' }).expect(403);
    await manager.get('/reports/sales').expect(200);
    await owner.patch('/tenant', { name: 'Renamed Co' }).expect(200);
  });

  it('protects the last owner and applies deactivation immediately', async () => {
    const users = (await owner.get('/users').expect(200)).body as { id: number; role: string; email: string }[];
    const ownerRow = users.find((u) => u.role === 'OWNER')!;
    expect((await owner.patch(`/users/${ownerRow.id}`, { role: 'STAFF' }).expect(400)).body.code).toBe('CANNOT_MODIFY_SELF');

    const email = uniqueEmail('temp');
    const created = (await owner.post('/users', { name: 'Temp', email, password: 'Password#123', role: 'STAFF' }).expect(201)).body;
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'Password#123' }).expect(200);
    const token = login.body.accessToken as string;
    await request(app.getHttpServer()).get('/api/products').set('Authorization', `Bearer ${token}`).expect(200);

    await owner.patch(`/users/${created.id}`, { isActive: false }).expect(200);
    // The still-valid JWT is rejected on the very next request.
    const res = await request(app.getHttpServer()).get('/api/products').set('Authorization', `Bearer ${token}`).expect(401);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
    await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'Password#123' }).expect(401);
  });
});
