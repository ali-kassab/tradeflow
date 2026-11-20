import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` does not need a database, so it must work on a fresh clone
// without a .env file. Migration commands fail loudly if the URL is missing.
const placeholder = 'mysql://unset:unset@localhost:3306/unset';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? placeholder,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
