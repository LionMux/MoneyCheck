/**
 * Demo data for static deployment (no backend).
 * Mirrors the shape returned by the real API endpoints.
 */
import { format, subDays } from "date-fns";

const today = format(new Date(), "yyyy-MM-dd");
const daysAgo = (n: number) => format(subDays(new Date(), n), "yyyy-MM-dd");

// ── Transactions ────────────────────────────────────────────────────────────
export const DEMO_TRANSACTIONS = [
  { id: 1,  userId: 1, title: "Зарплата",                amount: 85000,  category: "Доход",        type: "income",  date: daysAgo(1),  note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 2,  userId: 1, title: "Продукты (Перекрёсток)",  amount: -3200,  category: "Еда",           type: "expense", date: daysAgo(2),  note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 3,  userId: 1, title: "Spotify Premium",         amount: -299,   category: "Подписки",      type: "expense", date: daysAgo(3),  note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 4,  userId: 1, title: "Фитнес DDX",              amount: -3500,  category: "Спорт",         type: "expense", date: daysAgo(4),  note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 5,  userId: 1, title: "Кофе (Кофемания)",        amount: -480,   category: "Еда",           type: "expense", date: daysAgo(5),  note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 6,  userId: 1, title: "Транспорт (метро)",       amount: -1200,  category: "Транспорт",     type: "expense", date: daysAgo(6),  note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 7,  userId: 1, title: "Ozon — книги",            amount: -1500,  category: "Образование",   type: "expense", date: daysAgo(8),  note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 8,  userId: 1, title: "Фриланс-проект",          amount: 15000,  category: "Доход",         type: "income",  date: daysAgo(10), note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 9,  userId: 1, title: "Коммунальные услуги",     amount: -4800,  category: "ЖКХ",           type: "expense", date: daysAgo(11), note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 10, userId: 1, title: "Кино",                    amount: -900,   category: "Развлечения",   type: "expense", date: daysAgo(12), note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 11, userId: 1, title: "Продукты (ВкусВилл)",     amount: -2100,  category: "Еда",           type: "expense", date: daysAgo(14), note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
  { id: 12, userId: 1, title: "Такси (Яндекс Go)",       amount: -750,   category: "Транспорт",     type: "expense", date: daysAgo(15), note: null, currency: "RUB", accountId: null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false, createdAt: today },
];

// ── Budgets ─────────────────────────────────────────────────────────────────
export const DEMO_BUDGETS = [
  { id: 1, userId: 1, category: "Еда",          limit: 15000, color: "#20808D", period: "month" },
  { id: 2, userId: 1, category: "Транспорт",     limit: 5000,  color: "#A84B2F", period: "month" },
  { id: 3, userId: 1, category: "Развлечения",   limit: 6000,  color: "#7A39BB", period: "month" },
  { id: 4, userId: 1, category: "Подписки",      limit: 2000,  color: "#D19900", period: "month" },
  { id: 5, userId: 1, category: "Спорт",         limit: 4000,  color: "#437A22", period: "month" },
  { id: 6, userId: 1, category: "ЖКХ",           limit: 8000,  color: "#006494", period: "month" },
];

// ── Savings Goals ────────────────────────────────────────────────────────────
export const DEMO_GOALS = [
  { id: 1, userId: 1, title: "Подушка безопасности", targetAmount: 250000, currentAmount: 120000, deadline: "2026-12-31", icon: "Shield",  color: "#437A22" },
  { id: 2, userId: 1, title: "Отпуск в Японии",      targetAmount: 150000, currentAmount: 45000,  deadline: "2026-08-01", icon: "Plane",   color: "#20808D" },
  { id: 3, userId: 1, title: "Новый ноутбук",         targetAmount: 80000,  currentAmount: 32000,  deadline: "2026-06-01", icon: "Laptop",  color: "#7A39BB" },
];

// ── Progress ─────────────────────────────────────────────────────────────────
export const DEMO_PROGRESS = {
  id: 1, userId: 1, totalXp: 120, level: 1, streak: 3, lastActiveDate: today,
};

// ── Lessons ──────────────────────────────────────────────────────────────────
export const DEMO_LESSONS = [
  {
    id: 1, slug: "50-30-20", title: "Правило 50/30/20",
    description: "Базовый метод распределения бюджета для начинающих",
    content: "Правило 50/30/20 — это простой способ управлять деньгами.\n\n**50%** дохода — на обязательные расходы (жильё, еда, транспорт).\n**30%** — на желания (развлечения, кафе, хобби).\n**20%** — на сбережения и инвестиции.\n\nЭто правило помогает не думать долго над каждой тратой. Просто следи за тем, в какую из трёх корзин попадает каждый рубль.",
    category: "Бюджет", difficulty: "beginner", xpReward: 50, icon: "PieChart",
    estimatedMinutes: 4, sourceBooks: "Элизабет Уоррен «Всё, что стоит ваших денег»",
    quizQuestion: "Сколько процентов дохода по правилу 50/30/20 должно идти на сбережения?",
    quizOptions: ["10%", "20%", "30%", "50%"], quizAnswer: 1, completed: true,
  },
  {
    id: 2, slug: "emergency-fund", title: "Экстренный фонд",
    description: "Зачем нужна финансовая подушка и как её создать",
    content: "Экстренный фонд — это деньги на «чёрный день». Рекомендуется иметь запас на **3–6 месяцев** расходов.\n\nПочему это важно? Потеря работы, ремонт машины, медицинские расходы — всё это случается внезапно. Без подушки безопасности люди берут кредиты под высокие проценты.\n\n**Как начать:** открой отдельный счёт и переводи туда 10% от каждой зарплаты. Через год у тебя будет минимальная подушка.",
    category: "Сбережения", difficulty: "beginner", xpReward: 60, icon: "Shield",
    estimatedMinutes: 5, sourceBooks: "Девид Бах «Автоматический миллионер»",
    quizQuestion: "На сколько месяцев расходов рекомендуется создавать экстренный фонд?",
    quizOptions: ["1 месяц", "2 месяца", "3–6 месяцев", "12 месяцев"], quizAnswer: 2, completed: false,
  },
  {
    id: 3, slug: "compound-interest", title: "Сложный процент",
    description: "Восьмое чудо света — как деньги делают деньги",
    content: "Альберт Эйнштейн называл сложный процент «восьмым чудом света».\n\n**Пример:** вложил 100 000 ₽ под 12% годовых.\n- Через 10 лет: **310 585 ₽**\n- Через 20 лет: **964 629 ₽**\n- Через 30 лет: **2 995 992 ₽**\n\nВажно начать как можно раньше. Даже небольшие суммы со временем превращаются в значительный капитал.",
    category: "Инвестиции", difficulty: "beginner", xpReward: 70, icon: "TrendingUp",
    estimatedMinutes: 6, sourceBooks: "Роберт Кийосаки «Богатый папа, бедный папа»",
    quizQuestion: "Что такое сложный процент?",
    quizOptions: ["Начисление процентов только на основной долг", "Начисление процентов на сумму с учётом накопленных процентов", "Процент, который сложно посчитать", "Вид банковского кредита"],
    quizAnswer: 1, completed: false,
  },
  {
    id: 4, slug: "etf", title: "Индексные фонды (ETF)",
    description: "Как инвестировать без опыта и лишних затрат",
    content: "ETF (Exchange-Traded Fund) — биржевой фонд, который следует за индексом.\n\n**Преимущества ETF:**\n- Диверсификация: один ETF = сотни акций\n- Низкие комиссии (0.05–0.5% в год)\n- Доступность: можно купить от 1000 ₽\n- Пассивное управление — не нужно выбирать акции\n\nИндексное инвестирование обыгрывает 90% активных управляющих на горизонте 15+ лет.",
    category: "Инвестиции", difficulty: "intermediate", xpReward: 80, icon: "BarChart3",
    estimatedMinutes: 7, sourceBooks: "Джон Богл «Не верьте цифрам»",
    quizQuestion: "Что такое ETF?",
    quizOptions: ["Тип банковского вклада", "Биржевой фонд, следующий за индексом", "Вид кредита", "Страховой полис"],
    quizAnswer: 1, completed: false,
  },
  {
    id: 5, slug: "debt-snowball", title: "Метод снежного кома",
    description: "Как быстро погасить долги по методу Рэмси",
    content: "Метод снежного кома — стратегия погашения долгов.\n\n**Шаги:**\n1. Перечисли все долги от меньшего к большему\n2. Платишь минимум по всем, кроме самого маленького\n3. На самый маленький бросаешь все свободные деньги\n4. Когда маленький погашен — переходишь к следующему\n\nПсихологический эффект: каждое погашение мотивирует продолжать.",
    category: "Долги", difficulty: "beginner", xpReward: 65, icon: "Activity",
    estimatedMinutes: 5, sourceBooks: "Дэйв Рэмси «Полный финансовый ребут»",
    quizQuestion: "В каком порядке погашаются долги по методу снежного кома?",
    quizOptions: ["От большего к меньшему", "По процентной ставке", "От меньшего к большему", "В произвольном порядке"],
    quizAnswer: 2, completed: false,
  },
  {
    id: 6, slug: "behavioral-finance", title: "Поведенческие финансы",
    description: "Почему мы принимаем плохие финансовые решения",
    content: "Мы не рациональны в финансах. Психология влияет на каждое решение.\n\n**Основные когнитивные ошибки:**\n- **Неприятие потерь**: потеря 1000 ₽ болит сильнее, чем радует выигрыш 1000 ₽\n- **Якорение**: первая увиденная цена влияет на оценку\n- **Эффект стада**: «все покупают — и я куплю»\n- **Диверсификация 1/N**: поровну делим без анализа\n\nЗнание этих ошибок помогает принимать более взвешенные решения.",
    category: "Психология", difficulty: "intermediate", xpReward: 90, icon: "BookOpen",
    estimatedMinutes: 8, sourceBooks: "Даниэль Канеман «Думай медленно... решай быстро»",
    quizQuestion: "Что такое неприятие потерь?",
    quizOptions: ["Страх инвестировать", "Потери воспринимаются болезненнее, чем равнозначные приобретения", "Избегание рискованных активов", "Нежелание тратить деньги"],
    quizAnswer: 1, completed: false,
  },
  {
    id: 7, slug: "fire", title: "Стратегия FIRE",
    description: "Финансовая независимость и ранний выход на пенсию",
    content: "FIRE = Financial Independence, Retire Early.\n\n**Правило 4%:** если твои ежегодные расходы составляют 4% от портфеля, ты можешь жить с него бесконечно.\n\n**Пример:** расходы 600 000 ₽/год → нужен портфель 15 000 000 ₽.\n\n**Виды FIRE:**\n- **Lean FIRE** — минималистичный образ жизни\n- **Fat FIRE** — комфортная жизнь\n- **Barista FIRE** — частичная занятость + портфель\n\nПуть к FIRE: высокий доход + низкие расходы + инвестирование разницы.",
    category: "Инвестиции", difficulty: "advanced", xpReward: 100, icon: "TrendingUp",
    estimatedMinutes: 10, sourceBooks: "Г. Клейсон «Самый богатый человек в Вавилоне»",
    quizQuestion: "Что означает «правило 4%» в стратегии FIRE?",
    quizOptions: ["Вкладывать 4% зарплаты", "4% годовых гарантированы банком", "Расходы не более 4% от инвестиционного портфеля в год", "Комиссия за управление портфелем"],
    quizAnswer: 2, completed: false,
  },
  {
    id: 8, slug: "tax-optimization", title: "Налоговая оптимизация",
    description: "Законные способы платить меньше налогов в России",
    content: "В России есть легальные инструменты снижения налогов.\n\n**ИИС (Индивидуальный инвестиционный счёт):**\n- Тип А: вычет 13% с взносов до 400 000 ₽/год → до 52 000 ₽ возврата\n- Тип Б: освобождение прибыли от НДФЛ\n\n**Вычеты по НДФЛ:**\n- Медицинские расходы\n- Образование\n- Покупка жилья (до 260 000 ₽)\n- Проценты по ипотеке (до 390 000 ₽)\n\nИспользуй эти инструменты — это не уклонение, а право налогоплательщика.",
    category: "Налоги", difficulty: "advanced", xpReward: 95, icon: "Receipt",
    estimatedMinutes: 9, sourceBooks: "Наталья Смирнова «Личные финансы»",
    quizQuestion: "Какой максимальный налоговый вычет можно получить через ИИС типа А за год?",
    quizOptions: ["26 000 ₽", "52 000 ₽", "100 000 ₽", "400 000 ₽"],
    quizAnswer: 1, completed: false,
  },
];

// ── Accounts ─────────────────────────────────────────────────────────────────
export const DEMO_ACCOUNTS = [
  { id: 1, userId: 1, name: "Сбербанк Дебетовая", type: "debit",  currency: "RUB", initialBalance: 45200,  color: "#10b981", icon: "CreditCard", isArchived: false, creditLimit: null, billingDay: null, dueDay: null, interestRate: null, gracePeriodDays: null, createdAt: today },
  { id: 2, userId: 1, name: "Тинькофф Кредитная", type: "credit", currency: "RUB", initialBalance: -12400, color: "#f59e0b", icon: "CreditCard", isArchived: false, creditLimit: 100000, billingDay: 1, dueDay: 20, interestRate: 24.9, gracePeriodDays: 55, createdAt: today },
  { id: 3, userId: 1, name: "Наличные",            type: "cash",   currency: "RUB", initialBalance: 8500,   color: "#6366f1", icon: "Banknote",  isArchived: false, creditLimit: null, billingDay: null, dueDay: null, interestRate: null, gracePeriodDays: null, createdAt: today },
];

// ── Notifications ────────────────────────────────────────────────────────────
export const DEMO_NOTIFICATIONS = [
  { id: 1, userId: 1, type: "budget_exceeded", title: "Превышен бюджет «Еда»", body: "Ты потратил 5 780 ₽ при лимите 5 000 ₽ в этом месяце.", isRead: false, createdAt: subDays(new Date(), 1).toISOString() },
  { id: 2, userId: 1, type: "credit_due",      title: "Скоро платёж по кредитной карте", body: "Тинькофф: 12 400 ₽ нужно погасить до 20 марта.", isRead: false, createdAt: subDays(new Date(), 2).toISOString() },
  { id: 3, userId: 1, type: "inactivity",      title: "Давно не было новых операций", body: "Добавь последние расходы, чтобы бюджет был актуальным.", isRead: true,  createdAt: subDays(new Date(), 5).toISOString() },
];
