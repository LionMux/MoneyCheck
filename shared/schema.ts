import { pgTable, text, integer, real, boolean, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ─── USERS ─────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id:               serial("id").primaryKey(),
  email:            text("email").notNull().unique(),
  name:             text("name").notNull().default(""),
  hashedPassword:   text("hashed_password").notNull(),
  preferredCurrency: text("preferred_currency").notNull().default("RUB"),
  notifyBudget:     boolean("notify_budget").notNull().default(true),
  notifyCredit:     boolean("notify_credit").notNull().default(true),
  notifyInactivity: boolean("notify_inactivity").notNull().default(true),
  notifyEmail:      boolean("notify_email").notNull().default(false),
  notifyPush:       boolean("notify_push").notNull().default(false),
  pushSubscription: text("push_subscription"),          // JSON: PushSubscription
  createdAt:        text("created_at").notNull().default(""),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── WIDGET AUTH CODES ───────────────────────────────────────────────────────

export const widgetAuthCodes = pgTable("widget_auth_codes", {
  id:        serial("id").primaryKey(),
  code:      text("code").notNull().unique(),
  userId:    integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  usedAt:    text("used_at"),
});

export type WidgetAuthCode = typeof widgetAuthCodes.$inferSelect;


// ─── ACCOUNTS (debit / credit / cash / other) ──────────────────────────────

export const accounts = pgTable("accounts", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  type:           text("type").notNull().default("debit"), // debit | credit | cash | other
  currency:       text("currency").notNull().default("RUB"),
  initialBalance: real("initial_balance").notNull().default(0),
  color:          text("color").notNull().default("#20808D"),
  icon:           text("icon").notNull().default("Wallet"),
  isArchived:     boolean("is_archived").notNull().default(false),
  // credit-specific (only when type='credit')
  creditLimit:    real("credit_limit"),
  billingDay:     integer("billing_day"),
  dueDay:         integer("due_day"),
  interestRate:   real("interest_rate"),
  gracePeriodDays: integer("grace_period_days"),
  createdAt:      text("created_at").notNull().default(""),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// ─── CATEGORIES ────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  type:      text("type").notNull().default("expense"), // income | expense
  icon:      text("icon").notNull().default("Tag"),
  color:     text("color").notNull().default("#20808D"),
  isDefault: boolean("is_default").notNull().default(false),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// ─── TRANSACTIONS ───────────────────────────────────────────────────────────

export const transactions = pgTable("transactions", {
  id:                 serial("id").primaryKey(),
  userId:             integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId:          integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
  title:              text("title").notNull(),
  amount:             real("amount").notNull(),
  currency:           text("currency").notNull().default("RUB"),
  category:           text("category").notNull(),
  categoryId:         integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  type:               text("type").notNull(), // income | expense | transfer | creditPurchase | creditPayment
  date:               text("date").notNull(),
  note:               text("note"),
  counterparty:       text("counterparty"),
  linkedTransactionId: integer("linked_transaction_id"),
  isPlanned:          boolean("is_planned").notNull().default(false),
  createdAt:          text("created_at").notNull().default(""),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// ─── BUDGETS ────────────────────────────────────────────────────────────────

export const budgets = pgTable("budgets", {
  id:       serial("id").primaryKey(),
  userId:   integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  limit:    real("limit").notNull(),
  color:    text("color").notNull().default("#20808D"),
  period:   text("period").notNull().default("month"),  // month | week
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true }).partial({ userId: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

// ─── SAVINGS GOALS ──────────────────────────────────────────────────────────

export const savingsGoals = pgTable("savings_goals", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId:     integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
  title:         text("title").notNull(),
  targetAmount:  real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadline:      text("deadline"),
  icon:          text("icon").notNull().default("Target"),
  color:         text("color").notNull().default("#20808D"),
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({ id: true }).partial({ userId: true });
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;

// ─── LESSONS ────────────────────────────────────────────────────────────────

export const lessons = pgTable("lessons", {
  id:             serial("id").primaryKey(),
  slug:           text("slug").notNull().unique(),
  title:          text("title").notNull(),
  description:    text("description").notNull(),
  content:        text("content").notNull(),
  category:       text("category").notNull(),
  difficulty:     text("difficulty").notNull(), // beginner | intermediate | advanced
  xpReward:       integer("xp_reward").notNull().default(50),
  icon:           text("icon").notNull().default("BookOpen"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(5),
  sourceBooks:    text("source_books").notNull().default(""),
  quizQuestion:   text("quiz_question"),
  quizOptions:    text("quiz_options").array(),
  quizAnswer:     integer("quiz_answer"),
});

export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

// ─── USER PROGRESS (per-user) ───────────────────────────────────────────────

export const userProgress = pgTable("user_progress", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  totalXp:        integer("total_xp").notNull().default(0),
  level:          integer("level").notNull().default(1),
  streak:         integer("streak").notNull().default(0),
  lastActiveDate: text("last_active_date"),
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgress.$inferSelect;

// ─── COMPLETED LESSONS (per-user) ───────────────────────────────────────────

export const completedLessons = pgTable("completed_lessons", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId:   integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  completedAt: text("completed_at").notNull().default(""),
});

export const insertCompletedLessonSchema = createInsertSchema(completedLessons).omit({ id: true });
export type InsertCompletedLesson = z.infer<typeof insertCompletedLessonSchema>;
export type CompletedLesson = typeof completedLessons.$inferSelect;

// ─── NOTIFICATION LOG ────────────────────────────────────────────────────────

export const notificationLog = pgTable("notification_log", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type:      text("type").notNull(), // budget_alert | credit_due | inactivity
  channel:   text("channel").notNull(), // push | email
  message:   text("message").notNull(),
  sentAt:    text("sent_at").notNull().default(""),
  isRead:    boolean("is_read").notNull().default(false),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLog).omit({ id: true });
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLog.$inferSelect;

// ─── RELATIONS ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  transactions: many(transactions),
  budgets: many(budgets),
  savingsGoals: many(savingsGoals),
  progress: one(userProgress, { fields: [users.id], references: [userProgress.userId] }),
  completedLessons: many(completedLessons),
  notifications: many(notificationLog),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  savingsGoals: many(savingsGoals),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one }) => ({
  user: one(users, { fields: [savingsGoals.userId], references: [users.id] }),
  account: one(accounts, { fields: [savingsGoals.accountId], references: [accounts.id] }),
}));
