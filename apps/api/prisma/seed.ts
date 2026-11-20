/**
 * Demo data for TradeFlow — a fictional Egyptian food & household wholesaler.
 * All names, phones and emails are invented. Amounts are in EGP.
 *
 * The seed calls the real services (not raw inserts) so stock movements,
 * order totals and balances obey exactly the same rules as the running app.
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PaymentMethod, Role } from '../src/common/enums.js';
import type { AuthUser } from '../src/common/auth.js';
import { StockService } from '../src/modules/inventory/stock.service.js';
import { CatalogService } from '../src/modules/catalog/catalog.service.js';
import { PaymentsService } from '../src/modules/payments/payments.module.js';
import { PurchaseOrdersService } from '../src/modules/purchase-orders/purchase-orders.module.js';
import { SalesOrdersService } from '../src/modules/sales-orders/sales-orders.module.js';
import { type PrismaService, createPrismaClient } from '../src/prisma/prisma.service.js';

export const DEMO_PASSWORD = 'Demo@12345';
export const DEMO_EMAILS = {
  owner: 'owner@demo.tradeflow.local',
  manager: 'manager@demo.tradeflow.local',
  staff: 'staff@demo.tradeflow.local',
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = createPrismaClient(url) as unknown as PrismaService;

const daysAgo = (n: number, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d;
};

async function main() {
  if (await prisma.user.findUnique({ where: { email: DEMO_EMAILS.owner } })) {
    console.log('Demo data already present — run `npm run db:reset` to recreate it.');
    return;
  }

  const stock = new StockService();
  const catalog = new CatalogService(prisma, stock);
  const sales = new SalesOrdersService(prisma, stock);
  const purchases = new PurchaseOrdersService(prisma, stock);
  const payments = new PaymentsService(prisma);

  const tenant = await prisma.tenant.create({
    data: { name: 'شركة النيل للتجارة والتوزيع', currency: 'EGP', defaultTaxRate: 14 },
  });
  const hash = await argon2.hash(DEMO_PASSWORD);
  const mkUser = (name: string, email: string, role: Role) =>
    prisma.user.create({ data: { tenantId: tenant.id, name, email, role, passwordHash: hash } });
  const ownerRow = await mkUser('أحمد حسن', DEMO_EMAILS.owner, Role.OWNER);
  await mkUser('منى سامي', DEMO_EMAILS.manager, Role.MANAGER);
  await mkUser('كريم عادل', DEMO_EMAILS.staff, Role.STAFF);
  const owner: AuthUser = { id: ownerRow.id, tenantId: tenant.id, role: Role.OWNER, name: ownerRow.name, email: ownerRow.email };

  // ---- catalog ----
  const cats: Record<string, number> = {};
  for (const name of ['بقالة', 'مشروبات', 'منظفات', 'ألبان']) {
    cats[name] = (await catalog.createCategory(owner, { name })).id;
  }
  const productSpecs = [
    ['RICE-5KG', 'أرز مصري فاخر 5 كجم', 'كيس', 'بقالة', 145, 175, 120, 40],
    ['SUGAR-1KG', 'سكر أبيض 1 كجم', 'كيس', 'بقالة', 28, 34, 400, 100],
    ['OIL-1.8L', 'زيت عباد الشمس 1.8 لتر', 'زجاجة', 'بقالة', 92, 110, 90, 30],
    ['PASTA-400', 'مكرونة 400 جم', 'كيس', 'بقالة', 11, 14, 600, 150],
    ['TEA-250', 'شاي أسود 250 جم', 'علبة', 'مشروبات', 48, 58, 150, 40],
    ['WATER-24', 'مياه معدنية 600 مل (24 عبوة)', 'كرتونة', 'مشروبات', 75, 92, 70, 25],
    ['JUICE-1L', 'عصير برتقال 1 لتر', 'كرتونة', 'مشروبات', 160, 195, 12, 15],
    ['DET-3KG', 'مسحوق غسيل 3 كجم', 'كيس', 'منظفات', 118, 142, 60, 20],
    ['DISH-1L', 'سائل غسيل أطباق 1 لتر', 'زجاجة', 'منظفات', 32, 40, 8, 20],
    ['MILK-1L', 'لبن كامل الدسم 1 لتر', 'كرتونة', 'ألبان', 210, 248, 45, 15],
    ['CHEESE-500', 'جبنة بيضاء 500 جم', 'علبة', 'ألبان', 55, 68, 0, 10],
  ] as const;
  const products: Record<string, number> = {};
  for (const [sku, name, unit, cat, cost, price, qty, reorder] of productSpecs) {
    const p = await catalog.createProduct(owner, {
      sku, name, unit, categoryId: cats[cat], costPrice: cost, salePrice: price, openingStock: qty, reorderLevel: reorder,
    });
    products[sku] = p.id;
  }

  // ---- parties ----
  const customerSpecs = [
    ['سوبر ماركت الأمل', '01001234567', 'شارع التحرير، الدقي، الجيزة', 50000],
    ['بقالة الحاج سيد', '01112345678', 'شارع فيصل، الجيزة', 15000],
    ['ماركت السعادة', '01223456789', 'مدينة نصر، القاهرة', 30000],
    ['هايبر النور', '01534567890', 'المعادي، القاهرة', 80000],
    ['ميني ماركت الريحان', '01045678901', 'شبرا، القاهرة', null],
  ] as const;
  const customers: number[] = [];
  for (const [name, phone, address, creditLimit] of customerSpecs) {
    customers.push((await prisma.customer.create({ data: { tenantId: tenant.id, name, phone, address, creditLimit } })).id);
  }
  // Negotiated price for the biggest customer.
  await prisma.customerPrice.createMany({
    data: [
      { tenantId: tenant.id, customerId: customers[3], productId: products['RICE-5KG'], price: 168 },
      { tenantId: tenant.id, customerId: customers[3], productId: products['OIL-1.8L'], price: 105 },
    ],
  });

  const supplierA = await prisma.supplier.create({
    data: { tenantId: tenant.id, name: 'المصرية للأغذية', phone: '0223456789', address: 'المنطقة الصناعية، العاشر من رمضان' },
  });
  const supplierB = await prisma.supplier.create({
    data: { tenantId: tenant.id, name: 'الدلتا للمنظفات', phone: '0402345678', address: 'طنطا، الغربية' },
  });

  // ---- purchasing ----
  const po1 = await purchases.create(owner, {
    supplierId: supplierA.id,
    items: [
      { productId: products['RICE-5KG'], quantity: 60, unitCost: 143 },
      { productId: products['SUGAR-1KG'], quantity: 200, unitCost: 27.5 },
    ],
  });
  await purchases.receive(owner, po1.id);
  await payments.recordSupplier(owner, {
    supplierId: supplierA.id, purchaseOrderId: po1.id, amount: 8000, method: PaymentMethod.BANK_TRANSFER, reference: 'TRX-55102',
  });
  const po2 = await purchases.create(owner, {
    supplierId: supplierB.id,
    items: [{ productId: products['DISH-1L'], quantity: 100, unitCost: 31 }],
  });
  await purchases.markOrdered(owner, po2.id);

  // ---- sales over the last ~4 weeks ----
  const plan: { c: number; d: number; items: [string, number][]; pay?: number | 'full'; deliver?: boolean }[] = [
    { c: 0, d: 26, items: [['RICE-5KG', 10], ['SUGAR-1KG', 40]], pay: 'full', deliver: true },
    { c: 3, d: 24, items: [['OIL-1.8L', 20], ['RICE-5KG', 15], ['TEA-250', 10]], pay: 'full', deliver: true },
    { c: 1, d: 21, items: [['PASTA-400', 80], ['SUGAR-1KG', 30]], pay: 1500, deliver: true },
    { c: 2, d: 18, items: [['WATER-24', 15], ['DET-3KG', 6]], pay: 'full', deliver: true },
    { c: 0, d: 15, items: [['MILK-1L', 8], ['TEA-250', 12], ['OIL-1.8L', 10]], pay: 2000, deliver: true },
    { c: 3, d: 12, items: [['RICE-5KG', 25], ['PASTA-400', 120], ['SUGAR-1KG', 60]], pay: 5000, deliver: true },
    { c: 4, d: 9, items: [['DET-3KG', 10], ['WATER-24', 8]], deliver: true },
    { c: 2, d: 6, items: [['OIL-1.8L', 12], ['MILK-1L', 6]], pay: 'full' },
    { c: 1, d: 3, items: [['TEA-250', 15], ['SUGAR-1KG', 25]] },
    { c: 3, d: 1, items: [['RICE-5KG', 12], ['OIL-1.8L', 15]], pay: 3000 },
  ];
  for (const step of plan) {
    const draft = await sales.create(owner, {
      customerId: customers[step.c],
      items: step.items.map(([sku, quantity]) => ({ productId: products[sku], quantity })),
    });
    const confirmed = await sales.confirm(owner, draft.id);
    if (step.deliver) await sales.deliver(owner, draft.id);
    if (step.pay) {
      await payments.recordCustomer(owner, {
        customerId: customers[step.c],
        salesOrderId: draft.id,
        amount: step.pay === 'full' ? Number(confirmed.total) : step.pay,
        method: step.pay === 'full' ? PaymentMethod.CASH : PaymentMethod.BANK_TRANSFER,
      });
    }
    // Backdate so the dashboard chart shows a realistic history.
    const when = daysAgo(step.d);
    await prisma.salesOrder.update({
      where: { id: draft.id },
      data: { orderDate: when, createdAt: when, confirmedAt: when, ...(step.deliver ? { deliveredAt: daysAgo(step.d - 1) } : {}) },
    });
    await prisma.customerPayment.updateMany({ where: { salesOrderId: draft.id }, data: { paidAt: daysAgo(step.d, 16) } });
  }

  // A confirmed-then-cancelled order whose payment stays as customer credit.
  const cancelled = await sales.create(owner, {
    customerId: customers[2],
    items: [{ productId: products['JUICE-1L'], quantity: 4 }],
  });
  await sales.confirm(owner, cancelled.id);
  await payments.recordCustomer(owner, { customerId: customers[2], salesOrderId: cancelled.id, amount: 500, method: PaymentMethod.CASH });
  await sales.cancel(owner, cancelled.id);

  // A draft waiting for confirmation.
  await sales.create(owner, {
    customerId: customers[4],
    items: [{ productId: products['WATER-24'], quantity: 5 }, { productId: products['PASTA-400'], quantity: 40 }],
    notes: 'التسليم صباح السبت',
  });

  console.log(`Seeded demo business "${tenant.name}".`);
  console.log(`Sign in with ${DEMO_EMAILS.owner} / ${DEMO_PASSWORD} (also manager@ and staff@).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
