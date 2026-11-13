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
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  type: text("type").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const bills = sqliteTable("bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  installment: text("installment"),
  isPaid: integer("is_paid", { mode: "boolean" }).default(false),
  dueDay: integer("due_day"),
  category: text("category"),
  ownership: text("ownership", { enum: ["mine", "hers", "joint"] }).default("joint").notNull(),
  notes: text("notes"),
  barCode: text("bar_code"),
  qrCode: text("qr_code"),
  attachments: text("attachments"),
  type: text("type").default("NORMAL"),
  cardLast4: text("card_last4"),
  cardNickname: text("card_nickname"),
  date: text("date"),
  // v3: aporte vinculado a um investimento (categoria investimentos). FK na migration 0017.
  investmentId: integer("investment_id"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const cardTransactions = sqliteTable("card_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  billId: integer("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  installment: text("installment"),
  // Assinatura/recorrente: repetida na fatura do próximo mês ao migrar (sem parcela).
  recurring: integer("recurring", { mode: "boolean" }).notNull().default(false),
  category: text("category"),
  date: text("date"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// Itens (produtos) de uma compra no cartão de crédito — o "extrato" de uma nota/cupom.
// Mesmo modelo dos itens de cartão alimentação: preenchido manualmente ou via IA de visão.
export const cardTransactionItems = sqliteTable("card_transaction_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transactionId: integer("transaction_id").notNull().references(() => cardTransactions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price"),
  amount: real("amount").notNull(),
  category: text("category"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// Cartões de alimentação (vale-refeição/alimentação) — controle mensal isolado.
// Não interfere em renda/contas: guarda apenas o limite do mês e o extrato de compras.
export const mealCards = sqliteTable("meal_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  limitAmount: real("limit_amount").notNull().default(0),
  color: text("color").default("#5ab28d"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const mealCardTransactions = sqliteTable("meal_card_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mealCardId: integer("meal_card_id").notNull().references(() => mealCards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  category: text("category"),
  date: text("date"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// Itens (produtos) de uma compra — o "extrato" de uma nota/cupom.
// Preenchido manualmente ou pela leitura de imagem via IA de visão.
export const mealCardTransactionItems = sqliteTable("meal_card_transaction_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transactionId: integer("transaction_id").notNull().references(() => mealCardTransactions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price"),
  amount: real("amount").notNull(),
  category: text("category"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const salaries = sqliteTable("salaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  person: text("person").notNull(),
  amount: real("amount").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const futureBills = sqliteTable("future_bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount"),
  reminderDate: text("reminder_date"),
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

// v2: Comportamentos — Limites por categoria
export const categoryBudgets = sqliteTable("category_budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: real("amount").notNull().default(0),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// v2: Comportamentos — Alertas de risco
export const riskAlerts = sqliteTable("risk_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),      // 'installments_growth' | 'fixed_growth' | 'card_recurrence'
  severity: text("severity").notNull(), // 'warning' | 'danger'
  title: text("title").notNull(),
  message: text("message").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  dismissedAt: text("dismissed_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// v2: Comportamentos — Check-in semanal e fechamento mensal
export const weeklyCheckins = sqliteTable("weekly_checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(), // semana ISO (1–53)
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  type: text("type").notNull().default("weekly"), // 'weekly' | 'monthly'
  // JSON: { answers:[{question,answer}], decision?, highlight?, improvement? }
  data: text("data").notNull().default("{}"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// v3 / Fase 2: Patrimônio — conexões Pluggy, contas, investimentos e retratos
export const pluggyItems = sqliteTable("pluggy_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().unique(),
  connectorName: text("connector_name"),
  status: text("status"),
  lastSyncAt: text("last_sync_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["checking", "savings", "credit", "meal", "investment"] }).notNull().default("checking"),
  institution: text("institution"),
  number: text("number"),
  balance: real("balance").notNull().default(0),
  ownership: text("ownership", { enum: ["mine", "hers", "joint"] }).notNull().default("mine"),
  source: text("source", { enum: ["manual", "pluggy"] }).notNull().default("manual"),
  pluggyAccountId: text("pluggy_account_id").unique(),
  pluggyItemId: text("pluggy_item_id"),
  billClosingDate: text("bill_closing_date"),
  billDueDate: text("bill_due_date"),
  // Cartões: fatura em aberto (o balance da Pluggy é o limite usado, com parcelas futuras).
  openBillAmount: real("open_bill_amount"),
  lastSyncAt: text("last_sync_at"),
  lastImportAt: text("last_import_at"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const investments = sqliteTable("investments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("outro"),
  appliedAmount: real("applied_amount").notNull().default(0),
  balance: real("balance").notNull().default(0),
  dueDate: text("due_date"),
  source: text("source", { enum: ["manual", "pluggy"] }).notNull().default("manual"),
  pluggyInvestmentId: text("pluggy_investment_id").unique(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const netWorthSnapshots = sqliteTable("net_worth_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  accountsTotal: real("accounts_total").notNull().default(0),
  investmentsTotal: real("investments_total").notNull().default(0),
  debtsTotal: real("debts_total").notNull().default(0),
  netWorth: real("net_worth").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// v3 / Fase 2: transações bancárias (Pluggy ou importação) — conciliação com contas
export const bankTransactions = sqliteTable("bank_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["pluggy", "import"] }).notNull(),
  externalId: text("external_id").notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category"),
  ownership: text("ownership", { enum: ["mine", "hers", "joint"] }).notNull().default("mine"),
  status: text("status", { enum: ["pending", "suggested", "matched", "categorized", "ignored"] })
    .notNull()
    .default("pending"),
  billId: integer("bill_id").references(() => bills.id, { onDelete: "set null" }),
  cardTransactionId: integer("card_transaction_id").references(() => cardTransactions.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// v3 / Fase 3: insights da semana
export const insights = sqliteTable("insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  type: text("type").notNull(),
  tone: text("tone", { enum: ["positive", "warning", "negative"] }).notNull().default("warning"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  action: text("action"),
  facts: text("facts").notNull().default("{}"),
  source: text("source", { enum: ["rules", "ai"] }).notNull().default("rules"),
  rank: integer("rank").notNull().default(0),
  vote: integer("vote"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// v3: cartões como limite planejado (fora do patrimônio líquido)
export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ownership: text("ownership", { enum: ["mine", "hers", "joint"] }).notNull().default("mine"),
  monthlyLimit: real("monthly_limit").notNull().default(0),
  matchTerms: text("match_terms").notNull().default(""),
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// v3: fechamento do mês ("Fechar conta")
export const monthClosings = sqliteTable("month_closings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  summary: text("summary").notNull().default("{}"),
  closedAt: text("closed_at").default(sql`(datetime('now'))`),
});

// Relations
export const historyDebtsRelations = relations(historyDebts, ({ one, many }) => ({
  user: one(users, { fields: [historyDebts.userId], references: [users.id] }),
  debt: one(debts, { fields: [historyDebts.debtId], references: [debts.id] }),
  billLinks: many(debtBillLinks),
}));

export const debtBillLinksRelations = relations(debtBillLinks, ({ one }) => ({
  user: one(users, { fields: [debtBillLinks.userId], references: [users.id] }),
  debt: one(debts, { fields: [debtBillLinks.debtId], references: [debts.id] }),
  bill: one(bills, { fields: [debtBillLinks.billId], references: [bills.id] }),
  historyDebt: one(historyDebts, { fields: [debtBillLinks.historyDebtId], references: [historyDebts.id] }),
}));

export const investmentsRelations = relations(investments, ({ one }) => ({
  account: one(accounts, { fields: [investments.accountId], references: [accounts.id] }),
}));

// Types
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
export type CardTransactionItem = typeof cardTransactionItems.$inferSelect;
export type NewCardTransactionItem = typeof cardTransactionItems.$inferInsert;
export type MealCard = typeof mealCards.$inferSelect;
export type NewMealCard = typeof mealCards.$inferInsert;
export type MealCardTransaction = typeof mealCardTransactions.$inferSelect;
export type NewMealCardTransaction = typeof mealCardTransactions.$inferInsert;
export type MealCardTransactionItem = typeof mealCardTransactionItems.$inferSelect;
export type NewMealCardTransactionItem = typeof mealCardTransactionItems.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type HistoryDebt = typeof historyDebts.$inferSelect;
export type NewHistoryDebt = typeof historyDebts.$inferInsert;
export type DebtBillLink = typeof debtBillLinks.$inferSelect;
export type NewDebtBillLink = typeof debtBillLinks.$inferInsert;
export type CategoryBudget = typeof categoryBudgets.$inferSelect;
export type NewCategoryBudget = typeof categoryBudgets.$inferInsert;
export type RiskAlert = typeof riskAlerts.$inferSelect;
export type NewRiskAlert = typeof riskAlerts.$inferInsert;
export type WeeklyCheckin = typeof weeklyCheckins.$inferSelect;
export type NewWeeklyCheckin = typeof weeklyCheckins.$inferInsert;
// v2 helpers
export type BillOwnership = "mine" | "hers" | "joint";
export type RiskAlertType = "installments_growth" | "fixed_growth" | "card_recurrence";
export type RiskSeverity = "warning" | "danger";
export type CheckinType = "weekly" | "monthly";
export type PluggyItem = typeof pluggyItems.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountType = Account["type"];
export type Investment = typeof investments.$inferSelect;
export type NewInvestment = typeof investments.$inferInsert;
export type NetWorthSnapshot = typeof netWorthSnapshots.$inferSelect;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;
export type BankTransactionStatus = BankTransaction["status"];
export type Insight = typeof insights.$inferSelect;
export type MonthClosing = typeof monthClosings.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;

export const INVESTMENT_TYPES = ["cdb", "tesouro", "lci_lca", "fundo", "acao", "previdencia", "outro"] as const;

// Lista única de categorias (contas, cartão de crédito, limites) — ver lib/categories.ts.
export { SPENDING_CATEGORIES as BILL_CATEGORIES, type SpendingCategory as BillCategory } from "@/lib/categories";