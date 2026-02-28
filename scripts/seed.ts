#!/usr/bin/env tsx
/**
 * Seed script - run with: npm run db:seed
 * Creates admin user and populates 2026 bills from your XLSX
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { schema } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "contas2026";

// Data parsed from XLSX - 2026
const BILLS_DATA: Array<{
  name: string;
  amount: number;
  month: number;
  year: number;
  installment?: string;
  category?: string;
}> = [
  // JANEIRO
  { name: "ALUGUEL", amount: 440.00, month: 1, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "CONDOMÍNIO", amount: 413.49, month: 1, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "INTERNET", amount: 99.90, month: 1, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "VIVO", amount: 130.00, month: 1, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "LUZ", amount: 191.00, month: 1, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "SOGRA", amount: 400.00, month: 1, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "NETFLIX", amount: 28.90, month: 1, year: 2026, installment: "SEMPRE", category: "lazer" },
  { name: "TÊNIS FRAN", amount: 65.00, month: 1, year: 2026, installment: "3/4", category: "outros" },
  { name: "BANCO INTER", amount: 219.00, month: 1, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "BANCO ITAÚ", amount: 2797.05, month: 1, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "PARCELAMENTO CARRO", amount: 1199.52, month: 1, year: 2026, installment: "28/48", category: "transporte" },
  { name: "CANTINA DO SEU CRISTIANO", amount: 80.00, month: 1, year: 2026, installment: "VARIAVEL", category: "alimentação" },
  { name: "SERASA NUBANK FRAN", amount: 72.47, month: 1, year: 2026, installment: "8/13", category: "outros" },
  { name: "SERASA INTER LUAN", amount: 78.00, month: 1, year: 2026, installment: "9/18", category: "outros" },
  { name: "INVESTIMENTOS", amount: 200.00, month: 1, year: 2026, installment: "VARIAVEL", category: "investimentos" },
  { name: "PRAIA (REDE ELÉTRICA)", amount: 95.00, month: 1, year: 2026, installment: "1/6", category: "moradia" },

  // FEVEREIRO
  { name: "ALUGUEL", amount: 440.00, month: 2, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "CONDOMÍNIO", amount: 400.00, month: 2, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "INTERNET", amount: 99.90, month: 2, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "VIVO", amount: 130.00, month: 2, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "LUZ", amount: 268.98, month: 2, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "SOGRA", amount: 400.00, month: 2, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "NETFLIX", amount: 28.90, month: 2, year: 2026, installment: "SEMPRE", category: "lazer" },
  { name: "TÊNIS FRAN", amount: 65.00, month: 2, year: 2026, installment: "4/4", category: "outros" },
  { name: "BANCO INTER", amount: 284.45, month: 2, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "BANCO ITAÚ", amount: 3228.38, month: 2, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "PARCELAMENTO CARRO", amount: 1224.52, month: 2, year: 2026, installment: "29/48", category: "transporte" },
  { name: "SERASA NUBANK FRAN", amount: 72.47, month: 2, year: 2026, installment: "9/13", category: "outros" },
  { name: "SERASA INTER LUAN", amount: 78.00, month: 2, year: 2026, installment: "10/18", category: "outros" },
  { name: "INVESTIMENTOS", amount: 200.00, month: 2, year: 2026, installment: "VARIAVEL", category: "investimentos" },
  { name: "PRAIA (REDE ELÉTRICA)", amount: 95.00, month: 2, year: 2026, installment: "2/6", category: "moradia" },
  { name: "LUZ E ÁGUA (PRAIA)", amount: 168.00, month: 2, year: 2026, installment: "VARIAVEL", category: "moradia" },

  // MARÇO
  { name: "ALUGUEL", amount: 440.00, month: 3, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "CONDOMÍNIO", amount: 400.00, month: 3, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "INTERNET", amount: 99.90, month: 3, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "VIVO", amount: 130.00, month: 3, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "LUZ", amount: 212.91, month: 3, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "SOGRA", amount: 400.00, month: 3, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "NETFLIX", amount: 28.90, month: 3, year: 2026, installment: "SEMPRE", category: "lazer" },
  { name: "BANCO INTER", amount: 479.29, month: 3, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "BANCO ITAÚ", amount: 2000.00, month: 3, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "PARCELAMENTO CARRO", amount: 1264.52, month: 3, year: 2026, installment: "30/48", category: "transporte" },
  { name: "CANTINA DO SEU CRISTIANO", amount: 80.00, month: 3, year: 2026, installment: "VARIAVEL", category: "alimentação" },
  { name: "SERASA NUBANK FRAN", amount: 72.47, month: 3, year: 2026, installment: "10/13", category: "outros" },
  { name: "SERASA INTER LUAN", amount: 78.00, month: 3, year: 2026, installment: "11/18", category: "outros" },
  { name: "INVESTIMENTOS", amount: 400.00, month: 3, year: 2026, installment: "VARIAVEL", category: "investimentos" },
  { name: "PRAIA (REDE ELÉTRICA)", amount: 95.00, month: 3, year: 2026, installment: "3/6", category: "moradia" },
  { name: "IPVA", amount: 404.24, month: 3, year: 2026, installment: "ÚNICO", category: "transporte" },
  { name: "POMPÉIA", amount: 154.97, month: 3, year: 2026, installment: "1/4", category: "outros" },
  { name: "SERASA CRED FRAN", amount: 188.00, month: 3, year: 2026, installment: "1/1", category: "outros" },

  // ABRIL
  { name: "ALUGUEL", amount: 440.00, month: 4, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "CONDOMÍNIO", amount: 410.00, month: 4, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "INTERNET", amount: 99.90, month: 4, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "VIVO", amount: 130.00, month: 4, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "LUZ", amount: 160.00, month: 4, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "SOGRA", amount: 400.00, month: 4, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "NETFLIX", amount: 28.90, month: 4, year: 2026, installment: "SEMPRE", category: "lazer" },
  { name: "BANCO INTER", amount: 340.00, month: 4, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "BANCO ITAÚ", amount: 2000.00, month: 4, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "PARCELAMENTO CARRO", amount: 1264.52, month: 4, year: 2026, installment: "31/48", category: "transporte" },
  { name: "CANTINA DO SEU CRISTIANO", amount: 80.00, month: 4, year: 2026, installment: "VARIAVEL", category: "alimentação" },
  { name: "SERASA NUBANK FRAN", amount: 72.47, month: 4, year: 2026, installment: "11/13", category: "outros" },
  { name: "SERASA INTER LUAN", amount: 78.00, month: 4, year: 2026, installment: "12/18", category: "outros" },
  { name: "INVESTIMENTOS", amount: 400.00, month: 4, year: 2026, installment: "VARIAVEL", category: "investimentos" },
  { name: "PRAIA (REDE ELÉTRICA)", amount: 95.00, month: 4, year: 2026, installment: "4/6", category: "moradia" },
  { name: "POMPÉIA", amount: 151.63, month: 4, year: 2026, installment: "2/4", category: "outros" },
  { name: "LICENCIAMENTO", amount: 109.27, month: 4, year: 2026, installment: "ÚNICO", category: "transporte" },

  // MAIO
  { name: "ALUGUEL", amount: 440.00, month: 5, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "CONDOMÍNIO", amount: 410.00, month: 5, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "INTERNET", amount: 99.90, month: 5, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "VIVO", amount: 130.00, month: 5, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "LUZ", amount: 160.00, month: 5, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "SOGRA", amount: 400.00, month: 5, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "NETFLIX", amount: 28.90, month: 5, year: 2026, installment: "SEMPRE", category: "lazer" },
  { name: "BANCO INTER", amount: 340.00, month: 5, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "BANCO ITAÚ", amount: 2000.00, month: 5, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "PARCELAMENTO CARRO", amount: 1264.52, month: 5, year: 2026, installment: "32/48", category: "transporte" },
  { name: "CANTINA DO SEU CRISTIANO", amount: 80.00, month: 5, year: 2026, installment: "VARIAVEL", category: "alimentação" },
  { name: "SERASA NUBANK FRAN", amount: 72.47, month: 5, year: 2026, installment: "12/13", category: "outros" },
  { name: "SERASA INTER LUAN", amount: 78.00, month: 5, year: 2026, installment: "13/18", category: "outros" },
  { name: "INVESTIMENTOS", amount: 400.00, month: 5, year: 2026, installment: "VARIAVEL", category: "investimentos" },
  { name: "PRAIA (REDE ELÉTRICA)", amount: 95.00, month: 5, year: 2026, installment: "5/6", category: "moradia" },
  { name: "POMPÉIA", amount: 147.82, month: 5, year: 2026, installment: "3/4", category: "outros" },

  // JUNHO
  { name: "ALUGUEL", amount: 440.00, month: 6, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "CONDOMÍNIO", amount: 410.00, month: 6, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "INTERNET", amount: 99.90, month: 6, year: 2026, installment: "SEMPRE", category: "moradia" },
  { name: "VIVO", amount: 130.00, month: 6, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "LUZ", amount: 160.00, month: 6, year: 2026, installment: "VARIAVEL", category: "moradia" },
  { name: "SOGRA", amount: 400.00, month: 6, year: 2026, installment: "SEMPRE", category: "outros" },
  { name: "NETFLIX", amount: 28.90, month: 6, year: 2026, installment: "SEMPRE", category: "lazer" },
  { name: "BANCO INTER", amount: 340.00, month: 6, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "BANCO ITAÚ", amount: 2000.00, month: 6, year: 2026, installment: "VARIAVEL", category: "outros" },
  { name: "PARCELAMENTO CARRO", amount: 1264.52, month: 6, year: 2026, installment: "33/48", category: "transporte" },
  { name: "CANTINA DO SEU CRISTIANO", amount: 80.00, month: 6, year: 2026, installment: "VARIAVEL", category: "alimentação" },
  { name: "SERASA NUBANK FRAN", amount: 72.47, month: 6, year: 2026, installment: "13/13", category: "outros" },
  { name: "SERASA INTER LUAN", amount: 78.00, month: 6, year: 2026, installment: "14/18", category: "outros" },
  { name: "INVESTIMENTOS", amount: 400.00, month: 6, year: 2026, installment: "VARIAVEL", category: "investimentos" },
  { name: "PRAIA (REDE ELÉTRICA)", amount: 95.00, month: 6, year: 2026, installment: "6/6", category: "moradia" },
  { name: "POMPÉIA", amount: 144.24, month: 6, year: 2026, installment: "4/4", category: "outros" },

  // JULHO - DEZEMBRO (recurring only)
  ...([7, 8, 9, 10, 11, 12] as const).flatMap((m) => [
    { name: "ALUGUEL", amount: 440.00, month: m, year: 2026, installment: "SEMPRE", category: "moradia" },
    { name: "CONDOMÍNIO", amount: 410.00, month: m, year: 2026, installment: "VARIAVEL", category: "moradia" },
    { name: "INTERNET", amount: 99.90, month: m, year: 2026, installment: "SEMPRE", category: "moradia" },
    { name: "VIVO", amount: 130.00, month: m, year: 2026, installment: "SEMPRE", category: "outros" },
    { name: "LUZ", amount: 160.00, month: m, year: 2026, installment: "VARIAVEL", category: "moradia" },
    { name: "SOGRA", amount: 400.00, month: m, year: 2026, installment: "SEMPRE", category: "outros" },
    { name: "NETFLIX", amount: 28.90, month: m, year: 2026, installment: "SEMPRE", category: "lazer" },
    { name: "BANCO INTER", amount: 340.00, month: m, year: 2026, installment: "VARIAVEL", category: "outros" },
    { name: "BANCO ITAÚ", amount: 2000.00, month: m, year: 2026, installment: "VARIAVEL", category: "outros" },
    { name: "PARCELAMENTO CARRO", amount: 1264.52, month: m, year: 2026, installment: `${29 + m}/48`, category: "transporte" },
    { name: "CANTINA DO SEU CRISTIANO", amount: 80.00, month: m, year: 2026, installment: "VARIAVEL", category: "alimentação" },
    { name: "INVESTIMENTOS", amount: 400.00, month: m, year: 2026, installment: "VARIAVEL", category: "investimentos" },
    ...(m <= 10 ? [{ name: "SERASA INTER LUAN", amount: 78.00, month: m, year: 2026, installment: `${14 + (m - 7)}/18`, category: "outros" }] : []),
    ...(m <= 10 ? [{ name: "PRAIA (REDE ELÉTRICA)", amount: 40.00, month: m, year: 2026, installment: `${m - 6}/4`, category: "moradia" }] : []),
  ] as typeof BILLS_DATA),
];

const SALARIES_DATA = Array.from({ length: 12 }, (_, i) => [
  { person: "Luan", amount: 4500.00, month: i + 1, year: 2026 },
  { person: "Franciele", amount: 1800.00, month: i + 1, year: 2026 },
]).flat();

async function main() {
  console.log("🌱 Starting seed...");

  // Create admin user
  let user = await db.query.users.findFirst({
    where: eq(schema.users.email, ADMIN_EMAIL),
  });

  if (!user) {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const [created] = await db.insert(schema.users).values({
      email: ADMIN_EMAIL,
      passwordHash,
    }).returning();
    user = created;
    console.log(`✅ Created user: ${ADMIN_EMAIL}`);
  } else {
    console.log(`ℹ️  User already exists: ${ADMIN_EMAIL}`);
  }

  // Seed bills
  let billsInserted = 0;
  for (const bill of BILLS_DATA) {
    await db.insert(schema.bills).values({
      userId: user.id,
      ...bill,
      isPaid: false,
    }).onConflictDoNothing();
    billsInserted++;
  }
  console.log(`✅ Inserted ${billsInserted} bills`);

  // Seed salaries
  let salariesInserted = 0;
  for (const sal of SALARIES_DATA) {
    await db.insert(schema.salaries).values({
      userId: user.id,
      ...sal,
    }).onConflictDoNothing();
    salariesInserted++;
  }
  console.log(`✅ Inserted ${salariesInserted} salary records`);

  console.log("\n🎉 Seed complete!");
  console.log(`\n📧 Login: ${ADMIN_EMAIL}`);
  console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
  console.log(`\n⚠️  Change the password after first login!`);
}

main().catch(console.error).finally(() => process.exit(0));
