import { execSync } from 'node:child_process';
import 'dotenv/config';

/** Drops and re-creates the test database schema from the committed migrations. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set (see .env.example)');
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error('Refusing to reset a database whose name does not contain "test"');
  }
  execSync('npx prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
