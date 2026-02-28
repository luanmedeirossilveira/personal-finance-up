import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('migrations', () => {
  it('contains future_bills migration', () => {
    const sql = readFileSync('./drizzle/0001_add_future_bills.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS future_bills');
  });
});
