import arAuth from './locales/ar/auth.json';
import arCommon from './locales/ar/common.json';
import arCustomers from './locales/ar/customers.json';
import arDashboard from './locales/ar/dashboard.json';
import arErrors from './locales/ar/errors.json';
import arInventory from './locales/ar/inventory.json';
import arPayments from './locales/ar/payments.json';
import arSuppliers from './locales/ar/suppliers.json';
import arProducts from './locales/ar/products.json';
import arSalesOrders from './locales/ar/salesOrders.json';
import arPurchaseOrders from './locales/ar/purchaseOrders.json';
import arReports from './locales/ar/reports.json';
import arSettings from './locales/ar/settings.json';
import arUsers from './locales/ar/users.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enCustomers from './locales/en/customers.json';
import enDashboard from './locales/en/dashboard.json';
import enErrors from './locales/en/errors.json';
import enInventory from './locales/en/inventory.json';
import enPayments from './locales/en/payments.json';
import enSuppliers from './locales/en/suppliers.json';
import enProducts from './locales/en/products.json';
import enSalesOrders from './locales/en/salesOrders.json';
import enPurchaseOrders from './locales/en/purchaseOrders.json';
import enReports from './locales/en/reports.json';
import enSettings from './locales/en/settings.json';
import enUsers from './locales/en/users.json';

export const resources = {
  ar: { common: arCommon, auth: arAuth, errors: arErrors, dashboard: arDashboard, products: arProducts, inventory: arInventory, customers: arCustomers, salesOrders: arSalesOrders, payments: arPayments, suppliers: arSuppliers, purchaseOrders: arPurchaseOrders, reports: arReports, settings: arSettings, users: arUsers },
  en: { common: enCommon, auth: enAuth, errors: enErrors, dashboard: enDashboard, products: enProducts, inventory: enInventory, customers: enCustomers, salesOrders: enSalesOrders, payments: enPayments, suppliers: enSuppliers, purchaseOrders: enPurchaseOrders, reports: enReports, settings: enSettings, users: enUsers },
} as const;
