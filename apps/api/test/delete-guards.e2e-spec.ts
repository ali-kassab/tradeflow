import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Http, addUser, basicSetup, createTestApp, registerBusiness } from './helpers.js';

/**
 * Records with history are kept: deleting a supplier, customer or product that is
 * referenced by orders or payments answers 409 IN_USE and leaves the row in place.
 */
describe('Delete guards (IN_USE)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: Http;
  let product: { id: number };
  let customer: { id: number };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ http: owner } = await registerBusiness(app, 'Delete Guards Co'));
    ({ product, customer } = await basicSetup(owner, { stock: 20 }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses to delete a supplier with a purchase order', async () => {
    const supplier = (await owner.post('/suppliers', { name: 'Has PO' }).expect(201)).body;
    await owner
      .post('/purchase-orders', { supplierId: supplier.id, items: [{ productId: product.id, quantity: 1, unitCost: 10 }] })
      .expect(201);
    const res = await owner.delete(`/suppliers/${supplier.id}`).expect(409);
    expect(res.body.code).toBe('IN_USE');
    expect(await prisma.supplier.count({ where: { id: supplier.id } })).toBe(1);
  });

  it('refuses to delete a supplier with only an on-account payment', async () => {
    const supplier = (await owner.post('/suppliers', { name: 'Has payment' }).expect(201)).body;
    await owner.post('/payments/supplier', { supplierId: supplier.id, amount: 50, method: 'CASH' }).expect(201);
    expect((await owner.delete(`/suppliers/${supplier.id}`).expect(409)).body.code).toBe('IN_USE');
    expect(await prisma.supplier.count({ where: { id: supplier.id } })).toBe(1);
  });

  it('deletes an unused supplier', async () => {
    const supplier = (await owner.post('/suppliers', { name: 'Unused' }).expect(201)).body;
    await owner.delete(`/suppliers/${supplier.id}`).expect(204);
    await owner.get(`/suppliers/${supplier.id}`).expect(404);
  });

  it('refuses to delete a customer with an order, and a product on an order', async () => {
    await owner
      .post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    expect((await owner.delete(`/customers/${customer.id}`).expect(409)).body.code).toBe('IN_USE');
    expect((await owner.delete(`/products/${product.id}`).expect(409)).body.code).toBe('IN_USE');
    expect(await prisma.customer.count({ where: { id: customer.id } })).toBe(1);
    expect(await prisma.product.count({ where: { id: product.id } })).toBe(1);
  });

  it('deleting a category keeps its products and clears their category', async () => {
    const category = (await owner.post('/categories', { name: 'Temporary' }).expect(201)).body;
    await owner.patch(`/products/${product.id}`, { categoryId: category.id }).expect(200);
    await owner.delete(`/categories/${category.id}`).expect(204);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.categoryId).toBeNull();
  });

  it('STAFF cannot delete customers or suppliers', async () => {
    const staff = await addUser(app, owner, 'STAFF');
    const unused = (await owner.post('/customers', { name: 'Unused customer' }).expect(201)).body;
    const supplier = (await owner.post('/suppliers', { name: 'Unused 2' }).expect(201)).body;
    await staff.delete(`/customers/${unused.id}`).expect(403);
    await staff.delete(`/suppliers/${supplier.id}`).expect(403);
    expect(await prisma.customer.count({ where: { id: unused.id } })).toBe(1);
  });
});
