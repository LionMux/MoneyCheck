/**
 * PostgreSQL-backed storage implementation.
 * Drop-in replacement for MemStorage — implements the same IStorage interface,
 * plus extended methods for users, accounts, notifications, etc.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import * as S from "@shared/schema";
import { format } from "date-fns";
import { hashPassword } from "./auth";

const now = () => format(new Date(), "yyyy-MM-dd HH:mm:ss");
const today = () => format(new Date(), "yyyy-MM-dd");

// ─── SEED DEFAULT LESSONS ───────────────────────────────────────────────────

const DEFAULT_LESSONS: S.InsertLesson[] = [
  {
    slug: "rule-50-30-20",
    title: "Правило 50/30/20",
    description: "Базовый метод распределения бюджета для начинающих",
    content: `Правило 50/30/20 — это простой способ управлять деньгами. **50%** дохода — на обязательные расходы (жильё, еда, транспорт). **30%** — на желания (развлечения, кафе, хобби). **20%** — на сбережения и инвестиции.\n\nЭто правило помогает не думать долго над каждой тратой. Просто следи за тем, в какую из трёх корзин попадает каждый рубль.\n\n**Как начать применять:**\n- Посчитай свой чистый ежемесячный доход\n- Вычисли 50%, 30%, 20% от этой суммы\n- Сравни с реальными расходами за прошлый месяц\n- Найди категории для оптимизации`,
    category: "Бюджет",
    difficulty: "beginner",
    xpReward: 50,
    icon: "PieChart",
    estimatedMinutes: 5,
    sourceBooks: "Вдохновлено идеями из книг о личных финансах (Elizabeth Warren, Ramit Sethi)",
    quizQuestion: "Сколько процентов дохода по правилу 50/30/20 должно идти на сбережения?",
    quizOptions: ["10%", "20%", "30%", "50%"],
    quizAnswer: 1,
  },
  {
    slug: "emergency-fund",
    title: "Подушка безопасности",
    description: "Зачем нужна финансовая подушка и как её создать",
    content: `Финансовая подушка безопасности — это твой личный «страховой фонд», который защищает от неожиданных расходов: потери работы, болезни, срочного ремонта.\n\n**Сколько нужно накопить?**\nОптимально — расходы на 3–6 месяцев жизни. Если доход нестабильный (фриланс, сезонная работа) — лучше на 6–12 месяцев.\n\n**Где хранить:**\n- Отдельный накопительный счёт (не под рукой!)\n- Вклад с возможностью снятия без потери процентов\n- Никаких инвестиций — деньги должны быть доступны в любой момент\n\n**Как копить:**\nПереводи фиксированную сумму сразу после получения зарплаты, до того как потратишь на что-либо. Это принцип «заплати себе первым».`,
    category: "Сбережения",
    difficulty: "beginner",
    xpReward: 60,
    icon: "Shield",
    estimatedMinutes: 7,
    sourceBooks: "Принципы из книг Dave Ramsey и классической финансовой литературы",
    quizQuestion: "На сколько месяцев расходов рекомендуется создавать подушку безопасности?",
    quizOptions: ["1 месяц", "2 месяца", "3–6 месяцев", "12 месяцев"],
    quizAnswer: 2,
  },
  {
    slug: "compound-interest",
    title: "Сложный процент",
    description: "Восьмое чудо света — как деньги делают деньги",
    content: `Сложный процент — это механизм, при котором проценты начисляются не только на первоначальную сумму, но и на все ранее накопленные проценты.\n\n**Пример:** 100 000 ₽ под 12% годовых:\n- Через 10 лет: ~310 000 ₽\n- Через 20 лет: ~965 000 ₽\n- Через 30 лет: ~2 996 000 ₽\n\n**Главный урок:** начни как можно раньше. Каждый год промедления стоит значительно больше, чем кажется. Это работает и в обратную сторону — именно поэтому кредиты под высокий процент такие опасные.\n\n**Правило 72:** раздели 72 на процентную ставку — получишь количество лет, за которое деньги удвоятся. При 12% это 6 лет.`,
    category: "Инвестиции",
    difficulty: "beginner",
    xpReward: 70,
    icon: "TrendingUp",
    estimatedMinutes: 8,
    sourceBooks: "Концепции из книг «Богатый папа, бедный папа» (Kiyosaki) и классических книг по инвестированию",
    quizQuestion: "Что такое сложный процент?",
    quizOptions: [
      "Начисление процентов только на основной долг",
      "Начисление процентов на сумму с учётом накопленных процентов",
      "Процент, который сложно посчитать",
      "Вид банковского кредита",
    ],
    quizAnswer: 1,
  },
  {
    slug: "pay-yourself-first",
    title: "Заплати себе первым",
    description: "Принцип автоматических сбережений из лучших финансовых книг",
    content: `«Заплати себе первым» — один из самых мощных принципов управления деньгами. Суть проста: как только получил доход, сразу переводи часть на накопления — до того, как потратишь хоть что-то.\n\n**Почему это работает:**\nЧеловек тратит ровно столько, сколько есть на счёте. Если сначала отложить, то расходы автоматически адаптируются к оставшейся сумме.\n\n**Как внедрить:**\n1. Открой отдельный накопительный счёт\n2. Настрой автоматический перевод на день зарплаты\n3. Начни с 10% — это психологически комфортно\n4. Постепенно увеличивай до 20%\n\nЭтот принцип — основа системы автоматических финансов, которую описывает Ramit Sethi и другие финансовые авторы.`,
    category: "Сбережения",
    difficulty: "beginner",
    xpReward: 55,
    icon: "Zap",
    estimatedMinutes: 6,
    sourceBooks: "Вдохновлено идеями из книг Ramit Sethi «I Will Teach You to Be Rich» и George Clason «Богатейший человек Вавилона»",
    quizQuestion: "В чём суть принципа «заплати себе первым»?",
    quizOptions: [
      "Откладывать деньги в конце месяца из остатка",
      "Инвестировать весь доход",
      "Переводить часть дохода на накопления сразу после его получения",
      "Тратить деньги только на себя",
    ],
    quizAnswer: 2,
  },
  {
    slug: "credit-card-smart",
    title: "Умное использование кредитных карт",
    description: "Как кредитка может работать на тебя, а не против тебя",
    content: `Кредитная карта — это инструмент. Как любой инструмент, она может быть полезной или вредной в зависимости от того, как ты ею пользуешься.\n\n**Золотые правила:**\n1. **Всегда гасить в льготный период** — без процентов означает бесплатный кредит на 30–55 дней\n2. **Никогда не снимать наличные** — это дорого и льготный период не работает\n3. **Не тратить больше, чем есть на дебетовой карте** — психологически считай кредитку не кредитом, а способом оплаты\n4. **Кэшбэк — это бонус, а не повод тратить больше**\n5. **Настрой автоплатёж** на минимальный платёж, чтобы не пропустить срок\n\n**Опасные ловушки:**\n- Минимальный платёж при долге — растягивает его на годы под высокий процент\n- Лимит кредитки — это не твои деньги\n- «Акционные» рассрочки могут содержать скрытые комиссии`,
    category: "Кредит",
    difficulty: "intermediate",
    xpReward: 80,
    icon: "CreditCard",
    estimatedMinutes: 10,
    sourceBooks: "Практические советы, популярные в финансовых блогах и книгах по личным финансам",
    quizQuestion: "Что такое льготный период кредитной карты?",
    quizOptions: [
      "Период, когда банк не присылает выписку",
      "Период, в течение которого нет начисления процентов при полном погашении долга",
      "Период льготных процентных ставок",
      "Скидка на годовое обслуживание",
    ],
    quizAnswer: 1,
  },
  {
    slug: "index-funds",
    title: "Индексные фонды (ETF)",
    description: "Простое и диверсифицированное вложение в рынок",
    content: `Индексный фонд (ETF) — это корзина акций, которая повторяет состав биржевого индекса (S&P 500, Московская биржа, MSCI World и др.).\n\n**Почему это лучший выбор для большинства людей:**\n- Одна покупка = доля в сотнях компаний\n- Комиссии 0,1–0,5% в год (против 1–3% у активных фондов)\n- Не нужно анализировать отдельные акции\n- Исторически обгоняет большинство профессиональных управляющих на длинном горизонте\n\n**Простая стратегия:**\n1. Открой ИИС или брокерский счёт\n2. Каждый месяц покупай ETF на широкий индекс на фиксированную сумму\n3. Реинвестируй дивиденды\n4. Не паникуй при падениях рынка\n\nЭта стратегия называется «Dollar Cost Averaging» (усреднение по стоимости).`,
    category: "Инвестиции",
    difficulty: "intermediate",
    xpReward: 100,
    icon: "BarChart3",
    estimatedMinutes: 12,
    sourceBooks: "Идеи из книги John Bogle «Руководство разумного инвестора» и работ Уоррена Баффета",
    quizQuestion: "Что такое ETF?",
    quizOptions: [
      "Электронный перевод средств",
      "Биржевой фонд, отслеживающий индекс",
      "Тип банковского вклада",
      "Форма налоговой декларации",
    ],
    quizAnswer: 1,
  },
  {
    slug: "iis-tax-deduction",
    title: "Налоговый вычет (ИИС)",
    description: "Как получить до 52 000 ₽ от государства ежегодно",
    content: `Индивидуальный инвестиционный счёт (ИИС) — это брокерский счёт с государственными налоговыми льготами. Один из лучших инструментов для россиян.\n\n**Тип А — вычет на взнос:**\n- 13% от суммы взноса возвращается как налоговый вычет\n- Максимальный взнос для вычета: 400 000 ₽/год\n- Максимальный вычет: 52 000 ₽/год\n- Подходит тем, кто платит НДФЛ (официальная зарплата)\n\n**Тип Б — вычет на доход:**\n- Освобождение от НДФЛ на всю прибыль от инвестиций\n- Подходит тем, кто не платит НДФЛ или планирует высокую доходность\n\n**Условия:** счёт должен быть открыт не менее 3 лет. Можно инвестировать в акции, облигации, ETF.\n\n**Вывод:** Тип А = гарантированные 13% годовых с первого рубля + доходность от инвестиций.`,
    category: "Инвестиции",
    difficulty: "intermediate",
    xpReward: 120,
    icon: "Receipt",
    estimatedMinutes: 10,
    sourceBooks: "Российские налоговые льготы, описанные в финансовых изданиях",
    quizQuestion: "Какой максимальный налоговый вычет по ИИС Тип А можно получить в год?",
    quizOptions: ["26 000 ₽", "52 000 ₽", "100 000 ₽", "400 000 ₽"],
    quizAnswer: 1,
  },
  {
    slug: "debt-snowball",
    title: "Метод «снежный ком» для погашения долгов",
    description: "Психологически эффективная стратегия выхода из долгов",
    content: `Метод снежного кома — простая стратегия погашения нескольких долгов одновременно, которую популяризировал Дэйв Рэмзи.\n\n**Принцип:**\n1. Перечисли все долги от меньшего к большему (по сумме, не по ставке)\n2. Платы минимум по всем долгам\n3. Все лишние деньги — на самый маленький долг\n4. Когда маленький долг погашен — направляй его платёж на следующий\n5. «Ком» нарастает: каждое погашение освобождает больше денег\n\n**Почему это работает психологически:**\nБыстрое закрытие маленьких долгов даёт мощную мотивацию продолжать. Математически выгоднее сначала гасить долги с высокой ставкой (метод «лавины»), но снежный ком работает лучше для большинства людей эмоционально.\n\n**Альтернатива — «лавина»:** те же шаги, но сортируй по процентной ставке (сначала самая высокая).`,
    category: "Долги",
    difficulty: "beginner",
    xpReward: 65,
    icon: "TrendingDown",
    estimatedMinutes: 8,
    sourceBooks: "Адаптировано из идей Dave Ramsey «The Total Money Makeover»",
    quizQuestion: "В чём основной принцип метода 'снежного кома'?",
    quizOptions: [
      "Сначала гасить долги с самой высокой ставкой",
      "Сначала гасить самые маленькие долги для мотивации",
      "Рефинансировать все долги под один кредит",
      "Гасить все долги одновременно равными долями",
    ],
    quizAnswer: 1,
  },
];

// ─── DEFAULT CATEGORIES SEED ────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Зарплата", type: "income", icon: "Briefcase", color: "#437A22", isDefault: true },
  { name: "Фриланс", type: "income", icon: "Laptop", color: "#20808D", isDefault: true },
  { name: "Прочие доходы", type: "income", icon: "DollarSign", color: "#006494", isDefault: true },
  { name: "Еда", type: "expense", icon: "UtensilsCrossed", color: "#20808D", isDefault: true },
  { name: "Транспорт", type: "expense", icon: "Car", color: "#A84B2F", isDefault: true },
  { name: "Развлечения", type: "expense", icon: "Gamepad2", color: "#7A39BB", isDefault: true },
  { name: "Подписки", type: "expense", icon: "Tv", color: "#D19900", isDefault: true },
  { name: "Спорт", type: "expense", icon: "Dumbbell", color: "#437A22", isDefault: true },
  { name: "ЖКХ", type: "expense", icon: "Home", color: "#006494", isDefault: true },
  { name: "Образование", type: "expense", icon: "BookOpen", color: "#944454", isDefault: true },
  { name: "Здоровье", type: "expense", icon: "Heart", color: "#A84B2F", isDefault: true },
  { name: "Одежда", type: "expense", icon: "Shirt", color: "#848456", isDefault: true },
];

// ─── PG STORAGE CLASS ────────────────────────────────────────────────────────

export class PgStorage {
  // ── SEED ──────────────────────────────────────────────────────────────────

  async seedGlobalData() {
    // Lessons
    const existingLessons = await db.select().from(S.lessons);
    if (existingLessons.length === 0) {
      for (const lesson of DEFAULT_LESSONS) {
        await db.insert(S.lessons).values(lesson).onConflictDoNothing();
      }
    }
  }

  async seedUserData(userId: number) {
    // Default categories for new user
    const existing = await db.select().from(S.categories)
      .where(and(eq(S.categories.userId, userId), eq(S.categories.isDefault, true)));
    if (existing.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await db.insert(S.categories).values({ ...cat, userId });
      }
    }
    // User progress
    const progress = await db.select().from(S.userProgress).where(eq(S.userProgress.userId, userId));
    if (progress.length === 0) {
      await db.insert(S.userProgress).values({ userId, totalXp: 0, level: 1, streak: 0, lastActiveDate: today() });
    }
  }

  // ── AUTH / USERS ──────────────────────────────────────────────────────────

  async createUser(email: string, name: string, plainPassword: string): Promise<S.User> {
    const hashedPassword = await hashPassword(plainPassword);
    const [user] = await db.insert(S.users).values({
      email: email.toLowerCase().trim(),
      name,
      hashedPassword,
      createdAt: now(),
    }).returning();
    await this.seedUserData(user.id);
    return user;
  }

  async getUserById(id: number): Promise<S.User | null> {
    const [user] = await db.select().from(S.users).where(eq(S.users.id, id));
    return user ?? null;
  }

  async getUserByEmail(email: string): Promise<S.User | null> {
    const [user] = await db.select().from(S.users)
      .where(eq(S.users.email, email.toLowerCase().trim()));
    return user ?? null;
  }

  async updateUser(id: number, data: Partial<S.InsertUser>): Promise<S.User> {
    const [updated] = await db.update(S.users).set(data).where(eq(S.users.id, id)).returning();
    return updated;
  }

  // ── ACCOUNTS ─────────────────────────────────────────────────────────────

  async getAccounts(userId: number): Promise<S.Account[]> {
    return db.select().from(S.accounts)
      .where(and(eq(S.accounts.userId, userId), eq(S.accounts.isArchived, false)))
      .orderBy(S.accounts.id);
  }

  async getAccountById(id: number, userId: number): Promise<S.Account | null> {
    const [acc] = await db.select().from(S.accounts)
      .where(and(eq(S.accounts.id, id), eq(S.accounts.userId, userId)));
    return acc ?? null;
  }

  async createAccount(userId: number, data: Omit<S.InsertAccount, "userId">): Promise<S.Account> {
    const [acc] = await db.insert(S.accounts)
      .values({ ...data, userId, createdAt: now() }).returning();
    return acc;
  }

  async updateAccount(id: number, userId: number, data: Partial<S.InsertAccount>): Promise<S.Account> {
    const [updated] = await db.update(S.accounts)
      .set(data)
      .where(and(eq(S.accounts.id, id), eq(S.accounts.userId, userId)))
      .returning();
    return updated;
  }

  async archiveAccount(id: number, userId: number): Promise<void> {
    await db.update(S.accounts)
      .set({ isArchived: true })
      .where(and(eq(S.accounts.id, id), eq(S.accounts.userId, userId)));
  }

  /** Computes real-time balance = initialBalance + sum of all transactions */
  async getAccountBalance(accountId: number): Promise<number> {
    const [acc] = await db.select().from(S.accounts).where(eq(S.accounts.id, accountId));
    if (!acc) return 0;
    const txs = await db.select().from(S.transactions).where(eq(S.transactions.accountId, accountId));
    const delta = txs.reduce((sum, tx) => sum + tx.amount, 0);
    return acc.initialBalance + delta;
  }

  /** For credit card: debt = sum of creditPurchase - sum of creditPayment */
  async getCreditDebt(accountId: number): Promise<number> {
    const txs = await db.select().from(S.transactions).where(eq(S.transactions.accountId, accountId));
    return txs
      .filter(t => t.type === "creditPurchase" || t.type === "creditPayment")
      .reduce((sum, t) => sum + t.amount, 0); // creditPurchase = negative, creditPayment = positive
  }

  // ── TRANSACTIONS ──────────────────────────────────────────────────────────

  async getTransactions(userId: number): Promise<S.Transaction[]> {
    return db.select().from(S.transactions)
      .where(eq(S.transactions.userId, userId))
      .orderBy(desc(S.transactions.date), desc(S.transactions.id));
  }

  async getTransactionsByAccount(accountId: number, userId: number): Promise<S.Transaction[]> {
    return db.select().from(S.transactions)
      .where(and(eq(S.transactions.accountId, accountId), eq(S.transactions.userId, userId)))
      .orderBy(desc(S.transactions.date));
  }

  async addTransaction(userId: number, data: Omit<S.InsertTransaction, "userId">): Promise<S.Transaction> {
    const [tx] = await db.insert(S.transactions)
      .values({ ...data, userId, createdAt: now() }).returning();
    // update streak
    await this._updateStreak(userId);
    return tx;
  }

  async deleteTransaction(id: number, userId: number): Promise<void> {
    await db.delete(S.transactions)
      .where(and(eq(S.transactions.id, id), eq(S.transactions.userId, userId)));
  }

  // ── BUDGETS ───────────────────────────────────────────────────────────────

  async getBudgets(userId: number): Promise<S.Budget[]> {
    return db.select().from(S.budgets).where(eq(S.budgets.userId, userId));
  }

  async addBudget(userId: number, data: Omit<S.InsertBudget, "userId">): Promise<S.Budget> {
    const [b] = await db.insert(S.budgets).values({ ...data, userId }).returning();
    return b;
  }

  async updateBudget(id: number, userId: number, data: Partial<S.InsertBudget>): Promise<S.Budget> {
    const [b] = await db.update(S.budgets)
      .set(data)
      .where(and(eq(S.budgets.id, id), eq(S.budgets.userId, userId)))
      .returning();
    return b;
  }

  async deleteBudget(id: number, userId: number): Promise<void> {
    await db.delete(S.budgets)
      .where(and(eq(S.budgets.id, id), eq(S.budgets.userId, userId)));
  }

  // ── SAVINGS GOALS ─────────────────────────────────────────────────────────

  async getSavingsGoals(userId: number): Promise<S.SavingsGoal[]> {
    return db.select().from(S.savingsGoals).where(eq(S.savingsGoals.userId, userId));
  }

  async addSavingsGoal(userId: number, data: Omit<S.InsertSavingsGoal, "userId">): Promise<S.SavingsGoal> {
    const [g] = await db.insert(S.savingsGoals).values({ ...data, userId }).returning();
    return g;
  }

  async updateSavingsGoalAmount(id: number, userId: number, amount: number): Promise<S.SavingsGoal> {
    const [existing] = await db.select().from(S.savingsGoals)
      .where(and(eq(S.savingsGoals.id, id), eq(S.savingsGoals.userId, userId)));
    if (!existing) throw new Error("Goal not found");
    const newAmount = Math.min(existing.currentAmount + amount, existing.targetAmount);
    const [g] = await db.update(S.savingsGoals)
      .set({ currentAmount: newAmount })
      .where(eq(S.savingsGoals.id, id))
      .returning();
    return g;
  }

  async deleteSavingsGoal(id: number, userId: number): Promise<void> {
    await db.delete(S.savingsGoals)
      .where(and(eq(S.savingsGoals.id, id), eq(S.savingsGoals.userId, userId)));
  }

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  async getCategories(userId: number): Promise<S.Category[]> {
    return db.select().from(S.categories)
      .where(eq(S.categories.userId, userId));
  }

  async addCategory(userId: number, data: Omit<S.InsertCategory, "userId">): Promise<S.Category> {
    const [cat] = await db.insert(S.categories).values({ ...data, userId }).returning();
    return cat;
  }

  // ── LESSONS ───────────────────────────────────────────────────────────────

  async getLessons(): Promise<S.Lesson[]> {
    return db.select().from(S.lessons).orderBy(S.lessons.id);
  }

  async getLessonsWithProgress(userId: number): Promise<(S.Lesson & { completed: boolean })[]> {
    const allLessons = await db.select().from(S.lessons).orderBy(S.lessons.id);
    const completed = await db.select().from(S.completedLessons)
      .where(eq(S.completedLessons.userId, userId));
    const completedIds = new Set(completed.map(c => c.lessonId));
    return allLessons.map(l => ({ ...l, completed: completedIds.has(l.id) }));
  }

  async completeLesson(lessonId: number, userId: number): Promise<S.Lesson & { completed: boolean }> {
    const [lesson] = await db.select().from(S.lessons).where(eq(S.lessons.id, lessonId));
    if (!lesson) throw new Error("Lesson not found");

    const existing = await db.select().from(S.completedLessons)
      .where(and(eq(S.completedLessons.lessonId, lessonId), eq(S.completedLessons.userId, userId)));

    if (existing.length === 0) {
      await db.insert(S.completedLessons)
        .values({ userId, lessonId, completedAt: now() });
      await this.addXp(userId, lesson.xpReward);
    }

    return { ...lesson, completed: true };
  }

  // ── USER PROGRESS ─────────────────────────────────────────────────────────

  async getUserProgress(userId: number): Promise<S.UserProgress> {
    const [p] = await db.select().from(S.userProgress).where(eq(S.userProgress.userId, userId));
    if (!p) {
      const [created] = await db.insert(S.userProgress)
        .values({ userId, totalXp: 0, level: 1, streak: 0, lastActiveDate: today() })
        .returning();
      return created;
    }
    return p;
  }

  async addXp(userId: number, amount: number): Promise<S.UserProgress> {
    const current = await this.getUserProgress(userId);
    const newXp = current.totalXp + amount;
    const newLevel = Math.floor(newXp / 200) + 1;
    const [updated] = await db.update(S.userProgress)
      .set({ totalXp: newXp, level: newLevel, lastActiveDate: today() })
      .where(eq(S.userProgress.userId, userId))
      .returning();
    return updated;
  }

  private async _updateStreak(userId: number): Promise<void> {
    const p = await this.getUserProgress(userId);
    const todayStr = today();
    if (p.lastActiveDate === todayStr) return;
    const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
    const newStreak = p.lastActiveDate === yesterday ? p.streak + 1 : 1;
    await db.update(S.userProgress)
      .set({ streak: newStreak, lastActiveDate: todayStr })
      .where(eq(S.userProgress.userId, userId));
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

  async addNotification(userId: number, type: string, channel: string, message: string): Promise<S.NotificationLog> {
    const [n] = await db.insert(S.notificationLog)
      .values({ userId, type, channel, message, sentAt: now(), isRead: false })
      .returning();
    return n;
  }

  async getNotifications(userId: number): Promise<S.NotificationLog[]> {
    return db.select().from(S.notificationLog)
      .where(eq(S.notificationLog.userId, userId))
      .orderBy(desc(S.notificationLog.sentAt))
      .limit(50);
  }

  async markNotificationRead(id: number, userId: number): Promise<void> {
    await db.update(S.notificationLog)
      .set({ isRead: true })
      .where(and(eq(S.notificationLog.id, id), eq(S.notificationLog.userId, userId)));
  }

  // ── CRON HELPERS ──────────────────────────────────────────────────────────

  /** Returns all users with their notification settings — used by cron scheduler */
  async getAllUsersForCron(): Promise<S.User[]> {
    return db.select().from(S.users);
  }

  async getUserLastTransaction(userId: number): Promise<S.Transaction | null> {
    const [tx] = await db.select().from(S.transactions)
      .where(eq(S.transactions.userId, userId))
      .orderBy(desc(S.transactions.date))
      .limit(1);
    return tx ?? null;
  }
}

export const pgStorage = new PgStorage();
