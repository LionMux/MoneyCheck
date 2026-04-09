# Bank Notification Import — документация

## Обзор

Пайплайн позволяет автоматически создавать транзакции в MoneyCheck по тексту push-уведомлений от **Т-Банка** и **Сбербанка** через iOS Shortcuts.

```
iOS Shortcuts (триггер на уведомление)
   ↓  POST /api/import/bank-notification  (Bearer PAT)
сервер
  ├── 1. parsers.ts       — парсинг текста → BankEvent (сумма, мерчант, карта)
  ├── 2. twogis.ts        — 2GIS API → normalizedName + externalCategory
  ├── 3. category-matcher.ts — сопоставление с категориями пользователя
  └── 4. pipeline.ts      — создание транзакции через pg.addTransaction
```

---

## Эндпоинт

```
POST /api/import/bank-notification
Authorization: Bearer finwise_pat_XXXX
Content-Type: application/json
```

### Тело запроса

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `message` | string | ✅ | Текст уведомления из банка |
| `bank` | `"tbank"` \| `"sber"` | нет | Подсказка банка (автодетект если не указано) |
| `cardLast4` | string (4 цифры) | нет | Последние 4 цифры карты для привязки к счёту |

### Пример запроса

```json
{
  "message": "Покупка 450.00 руб. MAGNIT 1234. Карта *5678.",
  "bank": "tbank",
  "cardLast4": "5678"
}
```

### Пример ответа

```json
{
  "ok": true,
  "transactionId": 42,
  "matched": {
    "merchantName": "Магнит",
    "externalCategory": "Продукты",
    "categoryId": 3,
    "categoryName": "Еда",
    "accountId": 1,
    "gisFound": true
  }
}
```

---

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `TWOGIS_API_KEY` | API ключ 2GIS (https://dev.2gis.ru/). Если не задан — энричмент 2GIS пропускается, название мерчанта берётся из текста уведомления. |

---

## Логика сопоставления категорий

1. **Прямое совпадение** — название категории пользователя встречается в строке из 2GIS или в имени мерчанта (регистронезависимо).
2. **Словарь синонимов** — `category-matcher.ts` содержит карту `SYNONYM_MAP`: ключи — возможные слова из 2GIS («Продукты», «Кафе», «АЗС»…), значения — ключевые слова, которые ищутся в названиях категорий пользователя.
3. **Fallback** — если ни одно совпадение не найдено, берётся **последняя** категория из списка расходных категорий пользователя.

### Как расширить словарь

Откройте `server/bank-import/category-matcher.ts` и добавьте новые записи в `SYNONYM_MAP`:

```typescript
"название из 2GIS": ["слово1", "слово2"],
```

---

## Привязка к счёту по карте

Чтобы транзакция автоматически привязывалась к нужному счёту, добавьте поле `cardLast4` (последние 4 цифры карты) в объект счёта через PATCH `/api/accounts/:id`:

```json
{ "cardLast4": "5678" }
```

Пайплайн ищет счёт пользователя с совпадающим `cardLast4` и подставляет его `id` в транзакцию.

---

## Настройка iOS Shortcuts

1. Создайте **Автоматизацию** → «Уведомление получено» → выберите Т-Банк / Сбер.
2. Добавьте действие **«Получить содержимое URL»**:
   - URL: `https://your-backend.com/api/import/bank-notification`
   - Метод: POST
   - Тело: JSON
     ```json
     {
       "message": "[Текст уведомления]",
       "bank": "tbank"
     }
     }
     ```
   - Заголовки: `Authorization: Bearer finwise_pat_XXXX`
3. Получите PAT в веб-интерфейсе FinWise → Настройки → API токены → **Создать токен**.

---

## Структура файлов

```
server/bank-import/
├── parsers.ts          — регулярки для Т-Банка и Сбера → BankEvent
├── twogis.ts           — запрос к 2GIS Catalog API
├── category-matcher.ts — словарь синонимов + логика поиска
├── pipeline.ts         — оркестратор всех шагов
└── route.ts            — Express router для /api/import/bank-notification
```
