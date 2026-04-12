import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const authTokens = sqliteTable("auth_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  type: text("type").notNull(), // 'email_verify' | 'session'
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const bills = sqliteTable("bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull(), // positive = expense
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  installment: text("installment"), // '3/4', 'SEMPRE', 'VARIAVEL', 'ÚNICO'
  isPaid: integer("is_paid", { mode: "boolean" }).default(false),
  dueDay: integer("due_day"), // day of month
  category: text("category"), // 'moradia', 'transporte', 'saude', 'lazer', 'investimentos', 'cartão', 'outros'
  // v2: Método 3C — Governança do casal
  ownership: text("ownership", { enum: ["mine", "hers", "joint"] })
    .default("joint")
    .notNull(), // 'mine' = Luan | 'hers' = Franciele | 'joint' = Conjunta
  notes: text("notes"),
  barCode: text("bar_code"),
  qrCode: text("qr_code"),
  attachments: text("attachments"),
  type: text("type").default("NORMAL"), // 'NORMAL' | 'CARD'
  cardLast4: text("card_last4"), // últimos 4 dígitos (quando type='CARD')
  cardNickname: text("card_nickname"), // apelido do cartão (ex: "Nubank Luan")
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const cardTransactions = sqliteTable("card_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  billId: integer("bill_id")
    .notNull()
    .references(() => bills.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  installment: text("installment"), // '3/12', etc
  category: text("category"),
  date: text("date"), // data da transação (opcional)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const salaries = sqliteTable("salaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  person: text("person").notNull(), // 'Luan', 'Franciele'
  amount: real("amount").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const futureBills = sqliteTable("future_bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount"),
  reminderDate: text("reminder_date"), // ISO date string for when to remind
  notifyDaysBefore: integer("notify_days_before").default(3),
  notified: integer("notified", { mode: "boolean" }).default(false),
  notes: text("notes"),
  attachments: text("attachments"),
  priority: text("priority"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull().default(0),
  paidAmount: real("paid_amount").notNull().default(0),
  isPaid: integer("is_paid", { mode: "boolean" }).default(false),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const historyDebts = sqliteTable("history_debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  debtId: integer("debt_id").notNull().references(() => debts.id, { onDelete: "cascade" }),
  previousAmount: real("previous_amount").notNull(),
  newAmount: real("new_amount").notNull(),
  reason: text("reason"),
  changedAt: text("changed_at").default(sql`(datetime('now'))`),
});

export const debtBillLinks = sqliteTable("debt_bill_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  debtId: integer("debt_id").notNull().references(() => debts.id, { onDelete: "cascade" }),
  billId: integer("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  historyDebtId: integer("history_debt_id").references(() => historyDebts.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const historyDebtsRelations = relations(historyDebts, ({ one, many }) => ({
  user: one(users, {
    fields: [historyDebts.userId],
    references: [users.id],
  }),
  debt: one(debts, {
    fields: [historyDebts.debtId],
    references: [debts.id],
  }),
  billLinks: many(debtBillLinks),
}));

export const debtBillLinksRelations = relations(debtBillLinks, ({ one }) => ({
  user: one(users, {
    fields: [debtBillLinks.userId],
    references: [users.id],
  }),
  debt: one(debts, {
    fields: [debtBillLinks.debtId],
    references: [debts.id],
  }),
  bill: one(bills, {
    fields: [debtBillLinks.billId],
    references: [bills.id],
  }),
  historyDebt: one(historyDebts, {
    fields: [debtBillLinks.historyDebtId],
    references: [historyDebts.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Salary = typeof salaries.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type NewSalary = typeof salaries.$inferInsert;
export type FutureBill = typeof futureBills.$inferSelect;
export type NewFutureBill = typeof futureBills.$inferInsert;
export type CardTransaction = typeof cardTransactions.$inferSelect;
export type NewCardTransaction = typeof cardTransactions.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type HistoryDebt = typeof historyDebts.$inferSelect;
export type NewHistoryDebt = typeof historyDebts.$inferInsert;
export type DebtBillLink = typeof debtBillLinks.$inferSelect;
export type NewDebtBillLink = typeof debtBillLinks.$inferInsert;

// v2 helpers
export type BillOwnership = "mine" | "hers" | "joint";