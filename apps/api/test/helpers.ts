import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export type Http = ReturnType<typeof client>;

/** A tiny authenticated HTTP client bound to one access token. */
export function client(app: INestApplication<App>, token: string) {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const server = app.getHttpServer();
  return {
    token,
    get: (url: string) => auth(request(server).get(`/api${url}`)),
    post: (url: string, body?: object) => auth(request(server).post(`/api${url}`)).send(body ?? {}),
    patch: (url: string, body?: object) => auth(request(server).patch(`/api${url}`)).send(body ?? {}),
    put: (url: string, body?: object) => auth(request(server).put(`/api${url}`)).send(body ?? {}),
    delete: (url: string) => auth(request(server).delete(`/api${url}`)),
  };
}

export const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@test.local`;

/** Registers a fresh business and returns an authenticated client for its owner. */
export async function registerBusiness(app: INestApplication<App>, name = 'Test Wholesale') {
  const email = uniqueEmail('owner');
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ businessName: name, name: 'Owner', email, password: 'Password#123' })
    .expect(201);
  return { http: client(app, res.body.accessToken), email };
}

/** Adds a user with the given role to the owner's business and signs them in. */
export async function addUser(app: INestApplication<App>, owner: Http, role: 'MANAGER' | 'STAFF') {
  const email = uniqueEmail(role.toLowerCase());
  await owner.post('/users', { name: role, email, password: 'Password#123', role }).expect(201);
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'Password#123' })
    .expect(200);
  return client(app, res.body.accessToken);
}

/** Creates the minimum data most workflow tests need. */
export async function basicSetup(http: Http, opts: { stock?: number; price?: number; cost?: number } = {}) {
  const product = (
    await http
      .post('/products', {
        sku: `SKU-${randomUUID().slice(0, 6)}`,
        name: 'Rice 5kg',
        costPrice: opts.cost ?? 80,
        salePrice: opts.price ?? 100,
        openingStock: opts.stock ?? 100,
      })
      .expect(201)
  ).body;
  const customer = (await http.post('/customers', { name: 'Corner Shop' }).expect(201)).body;
  return { product, customer };
}
