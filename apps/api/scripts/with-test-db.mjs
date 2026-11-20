// Runs a command with DATABASE_URL pointed at TEST_DATABASE_URL (from .env),
// without echoing the connection string. Usage: node scripts/with-test-db.mjs <cmd> [args…]
import { spawnSync } from 'node:child_process';
import 'dotenv/config';

const url = process.env.TEST_DATABASE_URL;
if (!url || !/;\s*database\s*=\s*[^;]*test/i.test(url)) {
  console.error('TEST_DATABASE_URL must be set and name a database containing "test"');
  process.exit(1);
}
const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, DATABASE_URL: url } });
process.exit(r.status ?? 1);
