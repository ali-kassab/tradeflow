import 'dotenv/config';

// Point the app at the disposable test database before any module is imported.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set (see .env.example)');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
