import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Http, basicSetup, createTestApp, registerBusiness } from './helpers.js';

describe('Business workflows & financial consistency', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  beforeAll(async () => ({ app, prisma } = await createTestApp()));
  afterAll(() => app.close());

  const stockOf = async (http: Http, productId: number) =>
    (await http.get(`/products/${productId}`).expect(200)).body.stockQty as number;
  const balanceOf = async (http: Http, customerId: number) =>
    (await http.get(`/customers/${customerId}`).expect(200)).body.balance as string;

  it('sell → confirm → partial payment → deliver: stock, totals and balance stay consistent', async () => {
    const { http } = await registerBusiness(app);
    await http.patch('/tenant', { defaultTaxRate: 14 }).expect(200);
    const { product, customer } = await basicSetup(http, { stock: 100, price: 100, cost: 80 });

    const draft = (
      await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 30 }], discount: 50 }).expect(201)
    ).body;
    expect(draft.number).toBe('SO-00001');
    expect(draft.status).toBe('DRAFT');
    // 30 × 100 = 3000; −50 = 2950; VAT 14% = 413.00; total 3363.00
    expect(draft).toMatchObject({ subtotal: '3000', discount: '50', taxAmount: '413', total: '3363' });
    // A draft reserves nothing and bills nothing.
    expect(await stockOf(http, product.id)).toBe(100);
    expect(await balanceOf(http, customer.id)).toBe('0.00');

    const confirmed = (await http.post(`/sales-orders/${draft.id}/confirm`).expect(201)).body;
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.paymentStatus).toBe('UNPAID');
    expect(confirmed.items[0].unitCost).toBe('80');
    expect(await stockOf(http, product.id)).toBe(70);
    expect(await balanceOf(http, customer.id)).toBe('3363.00');

    await http.post('/payments/customer', { customerId: customer.id, salesOrderId: draft.id, amount: 1000, method: 'CASH' }).expect(201);
    const afterPay = (await http.get(`/sales-orders/${draft.id}`).expect(200)).body;
    expect(afterPay).toMatchObject({ paidAmount: '1000.00', outstanding: '2363.00', paymentStatus: 'PARTIAL' });
    expect(await balanceOf(http, customer.id)).toBe('2363.00');

    await http.post(`/sales-orders/${draft.id}/deliver`).expect(201);
    // Delivering changes nothing financially.
    expect(await balanceOf(http, customer.id)).toBe('2363.00');

    const movements = (await http.get(`/inventory/movements?productId=${product.id}`).expect(200)).body.data;
    expect(movements.map((m: { type: string; quantity: number; balanceAfter: number }) => [m.type, m.quantity, m.balanceAfter])).toEqual([
      ['SALE', -30, 70],
      ['OPENING', 100, 100],
    ]);
  });

  it('cancelling a paid confirmed order restocks and keeps the payment as customer credit', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http, { stock: 10, price: 50 });
    const order = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 4 }] }).expect(201)).body;
    await http.post(`/sales-orders/${order.id}/confirm`).expect(201);
    await http.post('/payments/customer', { customerId: customer.id, salesOrderId: order.id, amount: 200, method: 'CASH' }).expect(201);
    expect(await balanceOf(http, customer.id)).toBe('0.00');

    const cancelled = (await http.post(`/sales-orders/${order.id}/cancel`).expect(201)).body;
    expect(cancelled.status).toBe('CANCELLED');
    expect(await stockOf(http, product.id)).toBe(10);
    // The 200 paid is now credit in the customer's favour.
    expect(await balanceOf(http, customer.id)).toBe('-200.00');

    // The credit offsets the next order.
    const next = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }).expect(201)).body;
    await http.post(`/sales-orders/${next.id}/confirm`).expect(201);
    expect(await balanceOf(http, customer.id)).toBe('-150.00');

    // New payments cannot target a cancelled order.
    const res = await http.post('/payments/customer', { customerId: customer.id, salesOrderId: order.id, amount: 10, method: 'CASH' }).expect(409);
    expect(res.body.code).toBe('INVALID_STATUS');

    // Statement replays every event and ends at the same balance.
    const st = (await http.get(`/customers/${customer.id}/statement`).expect(200)).body;
    expect(st.entries.map((e: { type: string }) => e.type)).toEqual(['ORDER_CONFIRMED', 'PAYMENT', 'ORDER_CANCELLED', 'ORDER_CONFIRMED']);
    expect(st.balance).toBe('-150.00');
  });

  it('voided payments never affect balances and are never deleted', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http, { price: 100 });
    const order = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 2 }] }).expect(201)).body;
    await http.post(`/sales-orders/${order.id}/confirm`).expect(201);
    const pay = (await http.post('/payments/customer', { customerId: customer.id, amount: 150, method: 'CHEQUE' }).expect(201)).body;
    expect(await balanceOf(http, customer.id)).toBe('50.00');

    const voided = (await http.post(`/payments/customer/${pay.id}/void`, { reason: 'Cheque bounced' }).expect(201)).body;
    expect(voided.voidedAt).not.toBeNull();
    expect(await balanceOf(http, customer.id)).toBe('200.00');
    const again = await http.post(`/payments/customer/${pay.id}/void`, { reason: 'twice' }).expect(409);
    expect(again.body.code).toBe('ALREADY_VOIDED');

    // Still in the database and in the statement (as payment + reversal).
    expect(await prisma.customerPayment.count({ where: { id: pay.id } })).toBe(1);
    const st = (await http.get(`/customers/${customer.id}/statement`).expect(200)).body;
    expect(st.entries.map((e: { type: string }) => e.type)).toEqual(['ORDER_CONFIRMED', 'PAYMENT', 'PAYMENT_VOIDED']);
    expect(st.balance).toBe('200.00');

    // There is no endpoint that deletes a payment.
    await http.delete(`/payments/customer/${pay.id}`).expect(404);
  });

  it('rejects payments larger than the order outstanding amount', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http, { price: 100 });
    const order = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }).expect(201)).body;
    await http.post(`/sales-orders/${order.id}/confirm`).expect(201);
    await http.post('/payments/customer', { customerId: customer.id, salesOrderId: order.id, amount: 60, method: 'CASH' }).expect(201);
    const res = await http.post('/payments/customer', { customerId: customer.id, salesOrderId: order.id, amount: 41, method: 'CASH' }).expect(400);
    expect(res.body).toMatchObject({ code: 'AMOUNT_EXCEEDS_OUTSTANDING', details: { outstanding: '40.00' } });
    await http.post('/payments/customer', { customerId: customer.id, salesOrderId: order.id, amount: 40, method: 'CASH' }).expect(201);
    expect((await http.get(`/sales-orders/${order.id}`)).body.paymentStatus).toBe('PAID');
  });

  it('prevents overselling, including two concurrent confirmations for the last units', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http, { stock: 5 });

    const tooMuch = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 6 }] }).expect(201)).body;
    const err = await http.post(`/sales-orders/${tooMuch.id}/confirm`).expect(400);
    expect(err.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: 5, requested: 6 } });
    expect((await http.get(`/sales-orders/${tooMuch.id}`)).body.status).toBe('DRAFT');

    const a = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 4 }] }).expect(201)).body;
    const b = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 4 }] }).expect(201)).body;
    const results = await Promise.all([
      http.post(`/sales-orders/${a.id}/confirm`),
      http.post(`/sales-orders/${b.id}/confirm`),
    ]);
    expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 400]);
    expect(await stockOf(http, product.id)).toBe(1);
    // Exactly one order was billed.
    expect(await balanceOf(http, customer.id)).toBe('400.00');
  });

  it('rolls back a multi-line confirmation entirely when one line lacks stock', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http, { stock: 50 });
    const scarce = (await http.post('/products', { sku: 'SCARCE', name: 'Scarce', salePrice: 10, openingStock: 1 }).expect(201)).body;
    const order = (
      await http.post('/sales-orders', {
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 10 }, { productId: scarce.id, quantity: 2 }],
      }).expect(201)
    ).body;
    await http.post(`/sales-orders/${order.id}/confirm`).expect(400);
    expect(await stockOf(http, product.id)).toBe(50);
    expect(await stockOf(http, scarce.id)).toBe(1);
  });

  it('applies customer-specific prices and validates discount', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http, { price: 100 });
    await http.put(`/customers/${customer.id}/prices`, { prices: [{ productId: product.id, price: 90 }] }).expect(200);
    const order = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 2 }] }).expect(201)).body;
    expect(order.items[0].unitPrice).toBe('90');
    expect(order.total).toBe('180');
    const err = await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }], discount: 91 }).expect(400);
    expect(err.body.code).toBe('DISCOUNT_EXCEEDS_SUBTOTAL');
  });

  it('enforces the order state machine', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http);
    const order = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }).expect(201)).body;
    expect((await http.post(`/sales-orders/${order.id}/deliver`).expect(409)).body.code).toBe('INVALID_STATUS');
    await http.post(`/sales-orders/${order.id}/confirm`).expect(201);
    await http.post(`/sales-orders/${order.id}/confirm`).expect(409);
    await http.patch(`/sales-orders/${order.id}`, { customerId: customer.id, items: [{ productId: product.id, quantity: 5 }] }).expect(409);
    await http.post(`/sales-orders/${order.id}/deliver`).expect(201);
    await http.post(`/sales-orders/${order.id}/cancel`).expect(409);
  });

  it('purchase → receive adds stock, updates cost and creates a supplier payable', async () => {
    const { http } = await registerBusiness(app);
    const { product } = await basicSetup(http, { stock: 10, cost: 80 });
    const supplier = (await http.post('/suppliers', { name: 'Mill Co' }).expect(201)).body;
    const po = (await http.post('/purchase-orders', { supplierId: supplier.id, items: [{ productId: product.id, quantity: 40, unitCost: 75.5 }] }).expect(201)).body;
    expect(po).toMatchObject({ number: 'PO-00001', total: '3020' });

    // Unreceived orders are not payable and cannot take linked payments.
    expect((await http.get(`/suppliers/${supplier.id}`)).body.balance).toBe('0.00');
    await http.post('/payments/supplier', { supplierId: supplier.id, purchaseOrderId: po.id, amount: 100, method: 'CASH' }).expect(409);

    await http.post(`/purchase-orders/${po.id}/order`).expect(201);
    await http.post(`/purchase-orders/${po.id}/receive`).expect(201);
    expect(await stockOf(http, product.id)).toBe(50);
    expect((await http.get(`/products/${product.id}`)).body.costPrice).toBe('75.5');
    expect((await http.get(`/suppliers/${supplier.id}`)).body.balance).toBe('3020.00');

    await http.post('/payments/supplier', { supplierId: supplier.id, purchaseOrderId: po.id, amount: 1020, method: 'BANK_TRANSFER' }).expect(201);
    expect((await http.get(`/suppliers/${supplier.id}`)).body.balance).toBe('2000.00');
    await http.post(`/purchase-orders/${po.id}/cancel`).expect(409);

    const st = (await http.get(`/suppliers/${supplier.id}/statement`)).body;
    expect(st.balance).toBe('2000.00');
  });

  it('dashboard and reports agree with the underlying records', async () => {
    const { http } = await registerBusiness(app);
    const { product, customer } = await basicSetup(http, { stock: 20, price: 100, cost: 60 });
    const o = (await http.post('/sales-orders', { customerId: customer.id, items: [{ productId: product.id, quantity: 3 }] }).expect(201)).body;
    await http.post(`/sales-orders/${o.id}/confirm`).expect(201);
    await http.post('/payments/customer', { customerId: customer.id, amount: 100, method: 'CASH' }).expect(201);

    const dash = (await http.get('/dashboard').expect(200)).body;
    expect(dash).toMatchObject({
      salesToday: '300.00',
      ordersToday: 1,
      receivables: '200.00',
      inventoryValue: '1020.00', // 17 × 60
      grossProfitThisMonth: '120.00', // 300 − 3 × 60
    });
    expect(dash.salesLast30Days).toHaveLength(30);

    const sales = (await http.get('/reports/sales').expect(200)).body;
    expect(sales.summary).toMatchObject({ orders: 1, total: '300.00', cost: '180.00', grossProfit: '120.00' });
    expect(sales.byProduct[0]).toMatchObject({ quantity: 3, revenue: '300.00' });

    const balances = (await http.get('/reports/balances').expect(200)).body;
    expect(balances.customers).toEqual([expect.objectContaining({ id: customer.id, balance: '200.00' })]);
  });
});
