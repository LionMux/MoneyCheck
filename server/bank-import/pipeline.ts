/**
 * bank-import/pipeline.ts
 *
 * Основной pipeline обработки банковского уведомления:
 * parse → 2GIS enrich → category match → create transaction
 */

import type { PgStorage } from "../storage-pg";
import { parseMessage, type BankEvent } from "./parsers";
import { searchMerchant } from "./twogis";
import { matchCategory } from "./category-matcher";

export type ImportResult = {
  ok: true;
  transaction: Record<string, unknown>;
  matched: {
    merchantName: string;
    externalCategory: string | null;
    categoryId: number;
    categoryName: string;
    accountId: number | null;
    gisFound: boolean;
  };
} | {
  ok: false;
  error: string;
};

/**
 * Запускает полный pipeline для одного банковского уведомления.
 *
 * @param pg        - инстанс хранилища
 * @param userId    - id пользователя
 * @param rawText   - текст уведомления
 * @param bank      - опциональная подсказка банка ("tbank" | "sber")
 * @param cardLast4Override - переопределение последних 4 цифр карты (если пришло явно)
 */
export async function processNotification(
  pg: PgStorage,
  userId: number,
  rawText: string,
  bank?: string,
  cardLast4Override?: string,
): Promise<ImportResult> {
  // ── 1. Парсинг ─────────────────────────────────────────────────────────────
  const event: BankEvent = parseMessage(rawText, bank);
  if (cardLast4Override) event.cardLast4 = cardLast4Override;

  // Пропускаем зачисления (income) — они не трата, хотим только расходы
  // Если нужно добавить и доходы — уберите эту проверку
  const transactionType = event.operationType === "income" ? "income" : "expense";

  // ── 2. Категории пользователя ───────────────────────────────────────────
  const userCategories = await pg.getCategories(userId);
  if (userCategories.length === 0) {
    return { ok: false, error: "У пользователя нет категорий. Создайте хотя бы одну категорию в FinWise." };
  }

  // ── 3. Поиск мерчанта в 2GIS ───────────────────────────────────────────
  const gis = await searchMerchant(event.merchantRaw);

  // ── 4. Матчинг категории ────────────────────────────────────────────────
  const matchedCategory = matchCategory(
    gis.externalCategory,
    gis.normalizedName,
    userCategories,
  );

  // ── 5. Матчинг счёта по last4 ───────────────────────────────────────────
  let accountId: number | null = null;
  if (event.cardLast4) {
    const accounts = await pg.getAccounts(userId);
    const matched = accounts.find(
      (a) => !a.isArchived && (a as any).cardLast4 === event.cardLast4
    );
    if (matched) accountId = matched.id;
  }

  // ── 6. Создание транзакции ──────────────────────────────────────────────
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const amount = transactionType === "expense"
    ? -Math.abs(event.amount)
    : Math.abs(event.amount);

  const tx = await pg.addTransaction(userId, {
    userId,
    accountId,
    title: gis.found ? gis.normalizedName : event.merchantRaw,
    amount,
    currency: event.currency,
    category: matchedCategory.name,
    categoryId: matchedCategory.id,
    type: transactionType,
    date: dateStr,
    note: `Импорт из ${event.bank}: ${event.rawText.slice(0, 120)}`,
    counterparty: event.merchantRaw,
    isPlanned: false,
    createdAt: now.toISOString(),
    linkedTransactionId: null,
  } as any);

  return {
    ok: true,
    transaction: tx as any,
    matched: {
      merchantName: gis.found ? gis.normalizedName : event.merchantRaw,
      externalCategory: gis.externalCategory,
      categoryId: matchedCategory.id,
      categoryName: matchedCategory.name,
      accountId,
      gisFound: gis.found,
    },
  };
}
