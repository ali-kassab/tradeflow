import { HttpException } from '@nestjs/common';
import { localDayKey, parseDay } from '../modules/reports/reports.module.js';
import { MAX_ID, ParseIdPipe } from './validation.js';

const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as HttpException).getStatus();
  }
  return 200;
};

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe();

  it('accepts ids in the INT range', () => {
    expect(pipe.transform('1')).toBe(1);
    expect(pipe.transform(String(MAX_ID))).toBe(MAX_ID);
  });

  it('answers 400 for non-numeric ids, like ParseIntPipe', () => {
    expect(status(() => pipe.transform('abc'))).toBe(400);
    expect(status(() => pipe.transform('1.5'))).toBe(400);
  });

  it('answers 404 (not 500) for ids that cannot exist', () => {
    expect(status(() => pipe.transform('0'))).toBe(404);
    expect(status(() => pipe.transform('-1'))).toBe(404);
    expect(status(() => pipe.transform(String(MAX_ID + 1)))).toBe(404);
    expect(status(() => pipe.transform('100000000000000000000'))).toBe(404);
  });
});

describe('report day parsing', () => {
  it('reads YYYY-MM-DD as local midnight, not UTC midnight', () => {
    const d = parseDay('2026-01-31');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 0, 31, 0, 0]);
  });

  it('keys days by the local calendar', () => {
    expect(localDayKey(new Date(2026, 10, 21, 0, 30))).toBe('2026-11-21');
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
