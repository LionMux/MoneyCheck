import {
  transactions, Transaction, InsertTransaction,
  budgets, Budget, InsertBudget,
  lessons, Lesson, InsertLesson,
  userProgress, UserProgress, InsertUserProgress,
  savingsGoals, SavingsGoal, InsertSavingsGoal
} from "@shared/schema";
import { format } from "date-fns";

export interface IStorage {
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  addTransaction(tx: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;

  // Budgets
  getBudgets(): Promise<Budget[]>;
  addBudget(b: InsertBudget): Promise<Budget>;
  updateBudget(id: number, b: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number): Promise<void>;

  // Lessons
  getLessons(): Promise<Lesson[]>;
  completeLesson(id: number): Promise<Lesson>;

  // User Progress
  getUserProgress(): Promise<UserProgress>;
  addXp(amount: number): Promise<UserProgress>;

  // Savings Goals
  getSavingsGoals(): Promise<SavingsGoal[]>;
  addSavingsGoal(g: InsertSavingsGoal): Promise<SavingsGoal>;
  updateSavingsGoal(id: number, amount: number): Promise<SavingsGoal>;
  deleteSavingsGoal(id: number): Promise<void>;
}

function levelFromXp(xp: number): number {
  return Math.floor(xp / 200) + 1;
}

const today = format(new Date(), "yyyy-MM-dd");

class MemStorage implements IStorage {
  private transactions: Map<number, Transaction> = new Map();
  private budgets: Map<number, Budget> = new Map();
  private lessons: Map<number, Lesson> = new Map();
  private progress: UserProgress = { id: 1, userId: 1, totalXp: 120, level: 1, streak: 3, lastActiveDate: today };
  private savingsGoals: Map<number, SavingsGoal> = new Map();
  private txCounter = 1;
  private budgetCounter = 1;
  private goalCounter = 1;

  constructor() {
    this.seedData();
  }

  private seedData() {
    const now = new Date();
    const fmt = (d: Date) => format(d, "yyyy-MM-dd");
    const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return fmt(d); };

    const txData = [
      { title: "Зарплата", amount: 85000, category: "Доход", type: "income", date: daysAgo(1) },
      { title: "Продукты (Перекрёсток)", amount: -3200, category: "Еда", type: "expense", date: daysAgo(2) },
      { title: "Spotify Premium", amount: -299, category: "Подписки", type: "expense", date: daysAgo(3) },
      { title: "Фитнес DDX", amount: -3500, category: "Спорт", type: "expense", date: daysAgo(4) },
      { title: "Кофе (Кофемания)", amount: -480, category: "Еда", type: "expense", date: daysAgo(5) },
      { title: "Транспорт (метро)", amount: -1200, category: "Транспорт", type: "expense", date: daysAgo(6) },
      { title: "Ozon — книги", amount: -1500, category: "Образование", type: "expense", date: daysAgo(8) },
      { title: "Фриланс-проект", amount: 15000, category: "Доход", type: "income", date: daysAgo(10) },
      { title: "Коммунальные услуги", amount: -4800, category: "ЖКХ", type: "expense", date: daysAgo(11) },
      { title: "Кино", amount: -900, category: "Развлечения", type: "expense", date: daysAgo(12) },
      { title: "Продукты (ВкусВилл)", amount: -2100, category: "Еда", type: "expense", date: daysAgo(14) },
      { title: "Такси (Яндекс Go)", amount: -750, category: "Транспорт", type: "expense", date: daysAgo(15) },
    ];
    txData.forEach(tx => {
      const id = this.txCounter++;
      this.transactions.set(id, { ...tx, id, userId: 1, note: null, createdAt: today, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false } as Transaction);
    });

    const budgetData = [
      { category: "Еда", limit: 15000, color: "#20808D" },
      { category: "Транспорт", limit: 5000, color: "#A84B2F" },
      { category: "Развлечения", limit: 6000, color: "#7A39BB" },
      { category: "Подписки", limit: 2000, color: "#D19900" },
      { category: "Спорт", limit: 4000, color: "#437A22" },
      { category: "ЖКХ", limit: 8000, color: "#006494" },
    ];
    budgetData.forEach(b => {
      const id = this.budgetCounter++;
      this.budgets.set(id, { ...b, id, userId: 1, period: "month" } as Budget);
    });

    const lessonData = [
      {
        title: "Правило 50/30/20",
        description: "Базовый метод распределения бюджета для начинающих",
        content: "Правило 50/30/20 — это простой способ управлять деньгами. **50%** дохода — на обязательные расходы (жильё, еда, транспорт). **30%** — на желания (развлечения, кафе, хобби). **20%** — на сбережения и инвестиции.\n\nЭто правило помогает не думать долго над каждой тратой. Просто следи за тем, в какую из трёх корзин попадает каждый рубль.",
        category: "Бюджет",
        difficulty: "beginner",
        xpReward: 50,
        icon: "PieChart",
        quizQuestion: "Сколько процентов дохода по правилу 50/30/20 должно идти на сбережения?",
        quizOptions: ["10%", "20%", "30%", "50%"],
        quizAnswer: 1,
      },
      {
        title: "Экстренный фонд",
        description: "Зачем нужна финансовая подушка и как её создать",
        content: "Экстренный фонд — это деньги на «чёрный день». Рекомендуется иметь запас на **3–6 месяцев** расходов.\n\nПочему это важно? Потеря работы, ремонт машины, медицинские расходы — всё это случается внезапно. Без подушки безопасности люди берут кредиты под высокие проценты.\n\n**Как начать:** открой отдельный счёт и переводи туда 10% от каждой зарплаты. Через год у тебя будет минимальная подушка.",
        category: "Сбережения",
        difficulty: "beginner",
        xpReward: 60,
        icon: "Shield",
        quizQuestion: "На сколько месяцев расходов рекомендуется создавать экстренный фонд?",
        quizOptions: ["1 месяц", "2 месяца", "3–6 месяцев", "12 месяцев"],
        quizAnswer: 2,
      },
      {
        title: "Сложный процент",
        description: "Восьмое чудо света — как деньги делают деньги",
        content: "Альберт Эйнштейн называл сложный процент «восьмым чудом света».\n\n**Пример:** вложил 100 000 ₽ под 12% годовых.\n- Через 10 лет: **310 585 ₽**\n- Через 20 лет: **964 629 ₽**\n- Через 30 лет: **2 995 992 ₽**\n\nВажно начать как можно раньше. Даже небольшие суммы со временем превращаются в значительный капитал. Это работает и в обратную сторону — именно поэтому кредиты так дорого обходятся.",
        category: "Инвестиции",
        difficulty: "beginner",
        xpReward: 70,
        icon: "TrendingUp",
        quizQuestion: "Что такое сложный процент?",
        quizOptions: [
          "Начисление процентов только на основной долг",
          "Начисление процентов на сумму с учётом накопленных процентов",
          "Процент, который сложно посчитать",
          "Вид банковского кредита"
        ],
        quizAnswer: 1,
      },
      {
        title: "Индексные фонды (ETF)",
        description: "Простое и диверсифицированное вложение в рынок",
        content: "Индексный фонд (ETF) — это корзина акций, которая повторяет состав биржевого индекса (например, S&P 500 или Московской биржи).\n\n**Преимущества:**\n- Диверсификация: одна покупка = акции сотен компаний\n- Низкие комиссии (0.1–0.5% в год)\n- Не нужно выбирать отдельные акции\n\n**Исследования показывают:** большинство активно управляемых фондов проигрывают индексам на длинном горизонте. Именно поэтому Уоррен Баффет рекомендует обычным людям покупать индексные фонды.",
        category: "Инвестиции",
        difficulty: "intermediate",
        xpReward: 100,
        icon: "BarChart3",
        quizQuestion: "Что такое ETF?",
        quizOptions: [
          "Электронный перевод средств",
          "Биржевой фонд, отслеживающий индекс",
          "Тип банковского вклада",
          "Форма налоговой декларации"
        ],
        quizAnswer: 1,
      },
      {
        title: "Инфляция и покупательная способность",
        description: "Почему деньги 'тают' и что с этим делать",
        content: "Инфляция — это снижение покупательной способности денег. При инфляции 10% в год на те же деньги через год можно купить на 10% меньше товаров.\n\n**Что это значит для тебя:**\n- Деньги «под матрасом» теряют ценность\n- Вклад в банке должен быть выше инфляции\n- Реальная доходность = доходность минус инфляция\n\n**Пример:** вклад под 8% при инфляции 12% = реальный убыток 4% в год.",
        category: "Основы",
        difficulty: "beginner",
        xpReward: 55,
        icon: "Activity",
        quizQuestion: "Если инфляция 10%, а вклад приносит 8%, какова реальная доходность?",
        quizOptions: ["+8%", "+18%", "-2%", "0%"],
        quizAnswer: 2,
      },
      {
        title: "Налоговый вычет (ИИС)",
        description: "Как получить 52 000 ₽ от государства ежегодно",
        content: "Индивидуальный инвестиционный счёт (ИИС) — это брокерский счёт с налоговыми льготами.\n\n**Тип А:** налоговый вычет 13% от суммы взноса (максимум 52 000 ₽ в год при взносе 400 000 ₽).\n**Тип Б:** освобождение от НДФЛ на прибыль.\n\n**Условия:** счёт должен быть открыт не менее 3 лет. Можно инвестировать в акции, облигации, ETF.\n\nДля большинства людей с официальной зарплатой **Тип А** выгоднее — это гарантированные 13% годовых с первого рубля.",
        category: "Инвестиции",
        difficulty: "intermediate",
        xpReward: 120,
        icon: "Receipt",
        quizQuestion: "Какой максимальный налоговый вычет по ИИС Тип А можно получить в год?",
        quizOptions: ["26 000 ₽", "52 000 ₽", "100 000 ₽", "400 000 ₽"],
        quizAnswer: 1,
      },
    ];
    lessonData.forEach((l, i) => {
      this.lessons.set(i + 1, { ...l, id: i + 1, completed: false } as any);
    });

    const goalData = [
      { title: "Подушка безопасности", targetAmount: 250000, currentAmount: 120000, deadline: "2026-12-31", icon: "Shield", color: "#437A22" },
      { title: "Отпуск в Японии", targetAmount: 150000, currentAmount: 45000, deadline: "2026-08-01", icon: "Plane", color: "#20808D" },
      { title: "Новый ноутбук", targetAmount: 80000, currentAmount: 32000, deadline: "2026-06-01", icon: "Laptop", color: "#7A39BB" },
    ];
    goalData.forEach(g => {
      const id = this.goalCounter++;
      this.savingsGoals.set(id, { ...g, id, userId: 1 } as SavingsGoal);
    });
  }

  async getTransactions() { return Array.from(this.transactions.values()).sort((a, b) => b.date.localeCompare(a.date)); }
  async addTransaction(tx: InsertTransaction) {
    const id = this.txCounter++;
    const item = { ...tx, id, userId: 1, note: tx.note ?? null, createdAt: today, currency: tx.currency ?? "RUB", accountId: tx.accountId ?? null, categoryId: tx.categoryId ?? null, counterparty: tx.counterparty ?? null, linkedTransactionId: tx.linkedTransactionId ?? null, isPlanned: tx.isPlanned ?? false } as Transaction;
    this.transactions.set(id, item);
    return item;
  }
  async deleteTransaction(id: number) { this.transactions.delete(id); }

  async getBudgets() { return Array.from(this.budgets.values()); }
  async addBudget(b: InsertBudget) {
    const id = this.budgetCounter++;
    const item = { ...b, id, userId: 1, color: b.color ?? "#20808D", period: b.period ?? "month" } as Budget;
    this.budgets.set(id, item);
    return item;
  }
  async updateBudget(id: number, b: Partial<InsertBudget>) {
    const existing = this.budgets.get(id);
    if (!existing) throw new Error("Budget not found");
    const updated = { ...existing, ...b };
    this.budgets.set(id, updated);
    return updated;
  }
  async deleteBudget(id: number) { this.budgets.delete(id); }

  async getLessons() { return Array.from(this.lessons.values()); }
  async completeLesson(id: number) {
    const lesson = this.lessons.get(id);
    if (!lesson) throw new Error("Lesson not found");
    const updated = { ...lesson, completed: true };
    this.lessons.set(id, updated);
    await this.addXp(lesson.xpReward);
    return updated;
  }

  async getUserProgress() { return this.progress; }
  async addXp(amount: number) {
    this.progress.totalXp += amount;
    this.progress.level = levelFromXp(this.progress.totalXp);
    this.progress.lastActiveDate = today;
    return this.progress;
  }

  async getSavingsGoals() { return Array.from(this.savingsGoals.values()); }
  async addSavingsGoal(g: InsertSavingsGoal) {
    const id = this.goalCounter++;
    const item = { ...g, id, userId: 1, currentAmount: g.currentAmount ?? 0, icon: g.icon ?? "Target", color: g.color ?? "#20808D", deadline: g.deadline ?? null } as SavingsGoal;
    this.savingsGoals.set(id, item);
    return item;
  }
  async updateSavingsGoal(id: number, amount: number) {
    const existing = this.savingsGoals.get(id);
    if (!existing) throw new Error("Goal not found");
    const updated = { ...existing, currentAmount: Math.min(existing.currentAmount + amount, existing.targetAmount) };
    this.savingsGoals.set(id, updated);
    return updated;
  }
  async deleteSavingsGoal(id: number) { this.savingsGoals.delete(id); }
}

export const storage = new MemStorage();
