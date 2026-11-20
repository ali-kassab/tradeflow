// Smoke test against a running stack: signs in as each demo user and exercises the
// main read endpoints, checking role-dependent shapes. Usage: node scripts/smoke.mjs [baseUrl]
const base = process.argv[2] ?? 'http://localhost:5173/api';
const PASSWORD = 'Demo@12345'; // public demo credentials from prisma/seed.ts

async function call(path, token, init = {}) {
  const res = await fetch(base + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = res.status === 204 ? null : await res.json();
  return { status: res.status, body };
}

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

for (const who of ['owner', 'manager', 'staff']) {
  const login = await call('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email: `${who}@demo.tradeflow.local`, password: PASSWORD }),
  });
  check(`${who}: login`, login.status === 200);
  const token = login.body.accessToken;

  const me = await call('/auth/me', token);
  check(`${who}: me`, me.status === 200 && me.body.user.role === who.toUpperCase(), me.body.tenant?.name);

  const dash = await call('/dashboard', token);
  const hasCosts = 'inventoryValue' in dash.body;
  check(
    `${who}: dashboard`,
    dash.status === 200 && dash.body.salesLast30Days.length === 30 && hasCosts === (who !== 'staff'),
    `month=${dash.body.salesThisMonth} receivables=${dash.body.receivables} costs=${hasCosts}`,
  );

  const products = await call('/products', token);
  const costHidden = products.body.data.every((p) => !('costPrice' in p));
  check(`${who}: products`, products.status === 200 && products.body.data.length > 0 && costHidden === (who === 'staff'));

  for (const path of ['/reports/sales', '/reports/inventory', '/reports/balances', '/reports/activity']) {
    const r = await call(path, token);
    check(`${who}: ${path}`, r.status === (who === 'staff' ? 403 : 200), `status ${r.status}`);
  }
}

const owner = (await call('/auth/login', null, {
  method: 'POST',
  body: JSON.stringify({ email: 'owner@demo.tradeflow.local', password: PASSWORD }),
})).body.accessToken;
const customers = await call('/customers', owner);
const statement = await call(`/customers/${customers.body.data[0].id}/statement`, owner);
check('owner: customer statement', statement.status === 200, `${statement.body.entries?.length ?? '?'} entries`);
const activity = await call('/reports/activity', owner);
check('owner: activity metadata parsed as JSON', typeof activity.body[0]?.metadata !== 'string');

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
