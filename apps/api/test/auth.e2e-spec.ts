import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, uniqueEmail } from './helpers.js';

const cookieFrom = (res: request.Response) => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('tf_refresh='))?.split(';')[0];
};

describe('Auth', () => {
  let app: INestApplication<App>;
  beforeAll(async () => ({ app } = await createTestApp()));
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('registers a business, returns an access token and sets an httpOnly refresh cookie', async () => {
    const email = uniqueEmail('reg');
    const res = await http()
      .post('/api/auth/register')
      .send({ businessName: 'Acme Wholesale', name: 'Sara', email, password: 'Password#123' })
      .expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(setCookie).toMatch(/tf_refresh=.+HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);

    const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
    expect(me.body.user).toMatchObject({ email, role: 'OWNER' });
    expect(me.body.user.passwordHash).toBeUndefined();
    expect(me.body.tenant).toMatchObject({ name: 'Acme Wholesale', currency: 'EGP' });
  });

  it('rejects duplicate emails and invalid input with stable error codes', async () => {
    const email = uniqueEmail('dup');
    const body = { businessName: 'A', name: 'B', email, password: 'Password#123' };
    await http().post('/api/auth/register').send({ ...body, businessName: 'Biz' }).expect(201);
    const dup = await http().post('/api/auth/register').send({ ...body, businessName: 'Biz 2' }).expect(409);
    expect(dup.body.code).toBe('EMAIL_TAKEN');

    const bad = await http()
      .post('/api/auth/register')
      .send({ businessName: 'X', name: 'Y', email: 'not-an-email', password: 'short', extra: 1 })
      .expect(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
    expect(bad.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'email' })]));
  });

  it('does not reveal whether an email exists on failed login', async () => {
    const a = await http().post('/api/auth/login').send({ email: uniqueEmail('nobody'), password: 'x' }).expect(401);
    expect(a.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const email = uniqueEmail('rot');
    const reg = await http()
      .post('/api/auth/register')
      .send({ businessName: 'Rotate Co', name: 'R', email, password: 'Password#123' })
      .expect(201);
    const first = cookieFrom(reg)!;

    const r1 = await http().post('/api/auth/refresh').set('Cookie', first).expect(200);
    const second = cookieFrom(r1)!;
    expect(second).not.toEqual(first);

    // Replaying the already-rotated token is treated as theft…
    const replay = await http().post('/api/auth/refresh').set('Cookie', first).expect(401);
    expect(replay.body.code).toBe('INVALID_REFRESH_TOKEN');
    // …so even the newest token in that family is now revoked.
    await http().post('/api/auth/refresh').set('Cookie', second).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const email = uniqueEmail('out');
    const reg = await http()
      .post('/api/auth/register')
      .send({ businessName: 'Out Co', name: 'O', email, password: 'Password#123' })
      .expect(201);
    const cookie = cookieFrom(reg)!;
    await http().post('/api/auth/logout').set('Cookie', cookie).expect(204);
    await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('changes password only with the correct current password', async () => {
    const email = uniqueEmail('pw');
    const reg = await http()
      .post('/api/auth/register')
      .send({ businessName: 'PW Co', name: 'P', email, password: 'Password#123' })
      .expect(201);
    const token = reg.body.accessToken;
    const wrong = await http()
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'nope', newPassword: 'NewPassword#456' })
      .expect(400);
    expect(wrong.body.code).toBe('WRONG_CURRENT_PASSWORD');
    await http()
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password#123', newPassword: 'NewPassword#456' })
      .expect(204);
    // Old refresh sessions are signed out.
    await http().post('/api/auth/refresh').set('Cookie', cookieFrom(reg)!).expect(401);
    await http().post('/api/auth/login').send({ email, password: 'NewPassword#456' }).expect(200);
  });

  it('rejects requests without a valid token', async () => {
    const res = await http().get('/api/products').expect(401);
    expect(res.body).toEqual({ statusCode: 401, code: 'UNAUTHORIZED', message: expect.any(String) });
    await http().get('/api/products').set('Authorization', 'Bearer garbage').expect(401);
  });
});
