import { sql } from "drizzle-orm";
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
  category: text("category"), // 'moradia', 'transporte', 'saude', 'lazer', 'investimentos', 'outros'
  notes: text("notes"),
  barCode: text("bar_code"),
  qrCode: text("qr_code"),
  attachments: text("attachments"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
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

export type User = typeof users.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Salary = typeof salaries.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type NewSalary = typeof salaries.$inferInsert;
export type FutureBill = typeof futureBills.$inferSelect;
export type NewFutureBill = typeof futureBills.$inferInsert;
