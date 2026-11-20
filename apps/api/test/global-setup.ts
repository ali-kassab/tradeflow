import { execSync } from 'node:child_process';
import 'dotenv/config';
import { databaseName } from '../src/prisma/prisma.service.js';

/** Drops and re-creates the test database schema from the committed migrations. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set (see .env.example)');
  const db = databaseName(url);
  if (!db || !/test/i.test(db)) {
    throw new Error('Refusing to reset a database whose name does not contain "test"');
  }
  execSync('npx prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
