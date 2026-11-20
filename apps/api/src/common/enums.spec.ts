import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENUM_COLUMNS } from './enums.js';

const migration = readFileSync(
  new URL('../../prisma/migrations/20261120000000_init/migration.sql', import.meta.url),
  'utf8',
);

describe('enum CHECK constraints', () => {
  for (const [column, values] of Object.entries(ENUM_COLUMNS)) {
    it(`${column} allows exactly the TypeScript values`, () => {
      const [table, field] = column.split('.');
      const re = new RegExp(`ALTER TABLE \\[dbo\\]\\.\\[${table}\\] ADD CONSTRAINT \\[\\w+\\] CHECK \\(\\[${field}\\] IN \\(([^)]*)\\)\\)`);
      const match = re.exec(migration);
      expect(match, `no CHECK for ${column}`).not.toBeNull();
      const inDb = [...match![1].matchAll(/N'([A-Z_]+)'/g)].map((m) => m[1]).sort();
      expect(inDb).toEqual(Object.values(values).sort());
    });
  }
});
