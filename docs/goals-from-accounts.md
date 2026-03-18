# Реализация переводов на цели из определенной карты

## 📋 Анализ текущей архитектуры

### Текущее состояние
- **Goals.tsx**: Page компонент отвечает за управление целями (создание, пополнение, удаление)
- **Accounts.tsx**: Управление счетами (дебетовые, кредитные, наличные)
- **Схема БД**: 
  - `savingsGoals` таблица НЕ содержит поле `accountId`
  - `accounts` таблица содержит все счета пользователя
- **API routes**: 
  - `PATCH /api/goals/:id/deposit` - пополнение цели (текущий механизм просто добавляет сумму)
  - Нет связи между целью и счетом

### Проблема
Сейчас при пополнении цели просто увеличивается `currentAmount`. Нужно:
1. Привязать цель к счету (карте)
2. При пополнении цели **автоматически создать транзакцию** на счете
3. Убедиться, что на счете достаточно средств

---

## 🔧 Пошаговая реализация

### Шаг 1: Обновить схему БД (Drizzle ORM)

**Файл:** `shared/schema.ts`

Добавить поле `accountId` в таблицу `savingsGoals`:

```typescript
export const savingsGoals = pgTable("savings_goals", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId:     integer("account_id").references(() => accounts.id, { onDelete: "set null" }), // ← НОВОЕ
  title:         text("title").notNull(),
  targetAmount:  real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadline:      text("deadline"),
  icon:          text("icon").notNull().default("Target"),
  color:         text("color").notNull().default("#20808D"),
});
```

**Миграция БД:**
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Шаг 2: Обновить типы и Zod схему

**Файл:** `shared/schema.ts`

```typescript
// Обновить Zod схему
export const insertSavingsGoalSchema = createInsertSchema(savingsGoals)
  .omit({ id: true })
  .partial({ userId: true });  // accountId теперь optional
  
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
```

### Шаг 3: Обновить серверную логику (storage-pg.ts)

**Файл:** `server/storage-pg.ts`

```typescript
// Обновить существующий метод:
async addSavingsGoal(userId: number, data: Omit<S.InsertSavingsGoal, "userId">): Promise<S.SavingsGoal> {
  const [g] = await db.insert(S.savingsGoals)
    .values({ 
      ...data, 
      userId,
      accountId: data.accountId ?? null // Может быть null, если счет не выбран
    })
    .returning();
  return g;
}

// Обновить метод пополнения цели
async updateSavingsGoalAmount(
  id: number, 
  userId: number, 
  amount: number
): Promise<S.SavingsGoal> {
  // 1. Получить цель
  const [existing] = await db.select().from(S.savingsGoals)
    .where(and(eq(S.savingsGoals.id, id), eq(S.savingsGoals.userId, userId)));
  
  if (!existing) throw new Error("Goal not found");
  
  // 2. Если цель привязана к счету, проверить баланс и создать транзакцию
  if (existing.accountId) {
    const accountBalance = await this.getAccountBalance(existing.accountId);
    
    if (accountBalance < amount) {
      throw new Error(`Недостаточно средств. На счете: ${accountBalance}, требуется: ${amount}`);
    }

    // 3. Создать транзакцию "вывод" со счета на цель
    await db.insert(S.transactions).values({
      userId,
      accountId: existing.accountId,
      title: `Пополнение цели: ${existing.title}`,
      amount: -amount, // Отрицательное значение = вывод со счета
      currency: "RUB",
      category: "Сбережения",
      type: "expense",
      date: format(new Date(), "yyyy-MM-dd"),
      note: `Перевод на цель #${id}`,
      createdAt: now(),
    });
  }

  // 4. Обновить сумму цели
  const newAmount = Math.min(existing.currentAmount + amount, existing.targetAmount);
  const [g] = await db.update(S.savingsGoals)
    .set({ currentAmount: newAmount })
    .where(eq(S.savingsGoals.id, id))
    .returning();
  
  return g;
}
```

### Шаг 4: Обновить API маршруты (routes.ts)

**Файл:** `server/routes.ts`

Маршруты остаются теми же, но теперь поддерживают `accountId`:

```typescript
// POST /api/goals — создание цели с выбранным счетом
app.post("/api/goals", guard, async (req: AuthRequest, res) => {
  if (pg) {
    const userId = getUserId(req);
    // req.body теперь может содержать accountId
    const parsed = insertSavingsGoalSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    return res.json(await pg.addSavingsGoal(userId, parsed.data));
  }
  // ... rest
});

// PATCH /api/goals/:id/deposit — пополнение из счета
app.patch("/api/goals/:id/deposit", guard, async (req: AuthRequest, res) => {
  try {
    const { amount } = z.object({ amount: z.number() }).parse(req.body);
    if (pg) {
      const result = await pg.updateSavingsGoalAmount(Number(req.params.id), getUserId(req), amount);
      return res.json(result);
    }
    // ... mem storage fallback
  } catch (err: any) {
    // Вернуть ошибку если недостаточно средств
    return res.status(400).json({ error: err.message });
  }
});
```

### Шаг 5: Обновить фронтенд (Goals.tsx)

**Файл:** `client/src/pages/Goals.tsx`

```typescript
import { useQuery } from "@tanstack/react-query";
import type { Account } from "@shared/schema";

export default function Goals() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [form, setForm] = useState<Partial<InsertSavingsGoal>>({ 
    color: PRESET_COLORS[0], 
    icon: "Target",
    accountId: undefined  // ← НОВОЕ
  });

  const { data: goals = [] } = useQuery<SavingsGoal[]>({ 
    queryKey: ["/api/goals"] 
  });
  
  // ← НОВОЕ: получить список счетов
  const { data: accounts = [] } = useQuery<Account[]>({ 
    queryKey: ["/api/accounts"] 
  });

  // ... остальной код ...

  const depositMut = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      apiRequest("PATCH", `/api/goals/${id}/deposit`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      // Обновить баланс счетов если цель привязана к счету
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setDepositOpen(null);
      setDepositAmount("");
      toast({ title: "Сумма добавлена к цели" });
    },
    onError: (error: any) => {
      // Показать ошибку если недостаточно средств
      toast({ 
        title: "Ошибка", 
        description: error.message || "Не удалось пополнить цель",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = () => {
    if (!form.title || !form.targetAmount) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    addMut.mutate({ 
      title: form.title, 
      targetAmount: Number(form.targetAmount), 
      currentAmount: 0, 
      deadline: form.deadline ?? null, 
      icon: form.icon ?? "Target", 
      color: form.color ?? PRESET_COLORS[0],
      accountId: form.accountId ?? undefined  // ← НОВОЕ
    });
  };

  // В диалоге создания цели добавить селект счета:
  return (
    // ... существующий JSX ...
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Новая цель</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Существующие поля */}
          <div>
            <Label>Название цели</Label>
            <Input 
              placeholder="Например, Отпуск" 
              value={form.title ?? ""} 
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
              className="mt-1" 
            />
          </div>

          <div>
            <Label>Целевая сумма (₽)</Label>
            <Input 
              type="number" 
              placeholder="100000" 
              value={form.targetAmount ?? ""} 
              onChange={e => setForm(f => ({ ...f, targetAmount: Number(e.target.value) }))} 
              className="mt-1" 
            />
          </div>

          {/* ← НОВОЕ: Выбор счета для пополнения */}
          <div>
            <Label>Счет для пополнения (опционально)</Label>
            <Select 
              value={form.accountId?.toString() ?? ""} 
              onValueChange={(value) => setForm(f => ({ 
                ...f, 
                accountId: value ? Number(value) : undefined 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите счет (опционально)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Без счета (ручное пополнение)</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              При выборе счета пополнение цели будет автоматически переводить средства со счета
            </p>
          </div>

          <div>
            <Label>Срок (необязательно)</Label>
            <Input 
              type="date" 
              value={form.deadline ?? ""} 
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} 
              className="mt-1" 
            />
          </div>

          <div>
            <Label>Иконка</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {Object.entries(ICONS).map(([key, icon]) => (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, icon: key }))}
                  className={cn(
                    "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                    form.icon === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Цвет</Label>
            <div className="flex gap-2 mt-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all",
                    form.color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={addMut.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Шаг 6: Показать информацию о привязанном счете на карточке цели

В компоненте отображения цели добавить информацию о счете:

```typescript
{/* В карточке цели, после иконки и названия */}
{goal.accountId && (
  <Badge variant="secondary" className="text-xs">
    {accounts.find(a => a.id === goal.accountId)?.name || "Счет удален"}
  </Badge>
)}
```

---

## 📊 Диаграмма потока данных

```
┌─────────────────────────────────────────┐
│  Пользователь выбирает счет при        │
│  создании цели                          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Goals.tsx отправляет:                  │
│  { title, targetAmount, accountId: 5 }  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  POST /api/goals                        │
│  → Сохраняет goal с accountId           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Пользователь нажимает "Пополнить"     │
│  и указывает сумму (1000 ₽)             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  PATCH /api/goals/:id/deposit           │
│  { amount: 1000 }                       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│  Storage.updateSavingsGoalAmount()       │
│  1. Получить цель (вместе с accountId)  │
│  2. Проверить баланс счета              │
└──────────┬───────────────────────────────┘
           │
           ▼
       ┌─────────────┐
       │ Достаточно? │
       └──┬──────┬──┘
          │      │
     ДА   │      │   НЕТ
     ┌────┘      └────┐
     ▼                ▼
┌─────────────────┐  ┌──────────────┐
│ Создать         │  │ Throw Error  │
│ transaction:    │  │ "Insufficient
│ • type: expense │  │  funds"
│ • amount: -1000 │  └──────────────┘
│ • accountId: 5  │
│ • title: "Поп.  │
│   цели: ..."    │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│ Обновить currentAmount цели  │
│ = currentAmount + 1000       │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Вернуть обновленную цель     │
└──────────────────────────────┘
```

---

## ✅ Преимущества решения

1. **Полная отчетность**: Каждый перевод на цель видно в истории транзакций
2. **Контроль баланса**: Невозможно пополнить цель если нет средств на счете
3. **Гибкость**: Цель может быть без привязки к счету (ручное пополнение)
4. **Уже знакомый механизм**: Использует существующую структуру транзакций
5. **Безопасность**: Все проверки баланса на серверной стороне

---

## 🚀 Альтернативные подходы

### Вариант 2: Без создания транзакции (проще)
Просто сохранить `accountId` в цели, но не создавать транзакцию:
- ✅ Проще реализация
- ❌ Нет истории переводов
- ❌ Сложнее отследить куда делись деньги

### Вариант 3: Категория "Цели"
Создать специальную категорию для целей:
- ✅ Улучшенная статистика по целям
- ❌ Смешивает разные типы данных
- ❌ Сложнее фильтровать

---

## 📝 Примеры использования

```typescript
// Создать цель с привязкой к счету
POST /api/goals
{
  "title": "Отпуск в Таиланд",
  "targetAmount": 150000,
  "deadline": "2026-08-01",
  "accountId": 5  // ← ID счета "Сбербанк Дебетовая"
}

// Пополнить цель (автоматически создает транзакцию)
PATCH /api/goals/3/deposit
{ "amount": 10000 }

// Результат:
// 1. currentAmount цели +10000
// 2. Balance счета #5 -10000
// 3. В истории транзакций появляется запись о переводе
```

---

## 🔍 Тестирование

```typescript
// Test: Успешное пополнение из счета
describe("Goal deposits from account", () => {
  it("should transfer money from account to goal", async () => {
    const goal = await pg.addSavingsGoal(userId, {
      title: "Test Goal",
      targetAmount: 100000,
      accountId: 5
    });
    
    const result = await pg.updateSavingsGoalAmount(goal.id, userId, 10000);
    
    expect(result.currentAmount).toBe(10000);
    // Проверить что транзакция создана
    const txs = await pg.getTransactions(userId);
    expect(txs.some(t => t.title.includes("Test Goal"))).toBe(true);
  });

  it("should prevent deposit if insufficient funds", async () => {
    const goal = await pg.addSavingsGoal(userId, {
      title: "Test Goal",
      targetAmount: 100000,
      accountId: 5 // На счете 0 ₽
    });
    
    expect(async () => {
      await pg.updateSavingsGoalAmount(goal.id, userId, 10000);
    }).rejects.toThrow("Недостаточно средств");
  });
});
```

---

## ⚠️ Важные замечания

1. **Валидация на фронтенде**: Показывать доступный баланс при пополнении
2. **UX улучшения**: 
   - Подсказка о текущем балансе счета
   - Возможность пересчета сколько осталось накопить
   - Уведомление при достижении цели
3. **Будущие расширения**:
   - Автоматические переводы на цель (например, каждую зарплату)
   - Несколько счетов для одной цели
   - Распределение денег между целями
