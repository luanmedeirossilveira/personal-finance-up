import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('migrations', () => {
  it('contains future_bills migration', () => {
    const sql = readFileSync('./drizzle/0001_add_future_bills.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS future_bills');
  });

  it('contains meal_cards migration', () => {
    const sql = readFileSync('./drizzle/0013_add_meal_cards.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS meal_cards');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS meal_card_transactions');
  });

  it('contains meal_card_transaction_items migration', () => {
    const sql = readFileSync('./drizzle/0014_add_meal_card_transaction_items.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS meal_card_transaction_items');
  });

  it('contains card_transaction_items migration', () => {
    const sql = readFileSync('./drizzle/0015_add_card_transaction_items.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS card_transaction_items');
    expect(sql).toContain('REFERENCES card_transactions(id) ON DELETE CASCADE');
  });

  it('contains date_to_bills migration', () => {
    const sql = readFileSync('./drizzle/0016_add_date_to_bills.sql', 'utf8');
    expect(sql).toContain('ALTER TABLE bills ADD COLUMN date TEXT');
  });
});
