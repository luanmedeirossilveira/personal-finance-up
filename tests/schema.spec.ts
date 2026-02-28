import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('db schema', () => {
  it('exports futureBills in schema', () => {
    const src = readFileSync('./src/lib/db/schema.ts', 'utf8');
    expect(src).toContain('export const futureBills');
  });
});
