import arAuth from './locales/ar/auth.json';
import arCommon from './locales/ar/common.json';
import arDashboard from './locales/ar/dashboard.json';
import arErrors from './locales/ar/errors.json';
import arProducts from './locales/ar/products.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enErrors from './locales/en/errors.json';
import enProducts from './locales/en/products.json';

export const resources = {
  ar: { common: arCommon, auth: arAuth, errors: arErrors, dashboard: arDashboard, products: arProducts },
  en: { common: enCommon, auth: enAuth, errors: enErrors, dashboard: enDashboard, products: enProducts },
} as const;
