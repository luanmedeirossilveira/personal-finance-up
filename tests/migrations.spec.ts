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

describe('migrations v3', () => {
  it('contains accounts/investments migration', () => {
    const sql = readFileSync('./drizzle/0017_add_accounts_and_investments.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS pluggy_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS accounts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS investments');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS net_worth_snapshots');
    expect(sql).toContain('ALTER TABLE bills ADD COLUMN investment_id INTEGER');
  });

  it('contains bank_transactions migration with idempotency key', () => {
    const sql = readFileSync('./drizzle/0018_add_bank_transactions.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS bank_transactions');
    expect(sql).toContain('UNIQUE(user_id, source, external_id)');
  });

  it('contains insights migration', () => {
    const sql = readFileSync('./drizzle/0019_add_insights.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS insights');
  });
});

describe('migrations v3 — fechamento do mês', () => {
  it('contains month_closings migration', () => {
    const sql = readFileSync('./drizzle/0020_add_month_closings.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS month_closings');
    expect(sql).toContain('UNIQUE(user_id, month, year)');
  });
});

describe('migrations v3 — cartões planejados', () => {
  it('contains cards migration and open bill column', () => {
    const sql = readFileSync('./drizzle/0021_add_cards_and_open_bill.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cards');
    expect(sql).toContain('ALTER TABLE accounts ADD COLUMN open_bill_amount REAL');
  });
});

describe('migrations v3 — transações recorrentes', () => {
  it('contains recurring column on card_transactions', () => {
    const sql = readFileSync('./drizzle/0022_add_recurring_to_card_transactions.sql', 'utf8');
    expect(sql).toContain('ALTER TABLE card_transactions ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0');
  });
});
