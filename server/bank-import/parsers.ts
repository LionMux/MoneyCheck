/**
 * bank-import/parsers.ts
 *
 * Парсеры SMS/push-уведомлений для Т-Банка и Сбербанка.
 * Возвращают единый объект BankEvent.
 */

export type BankEvent = {
  bank: "tbank" | "sber" | "unknown";
  operationType: "card_purchase" | "atm_withdrawal" | "transfer_out" | "income" | "unknown";
  amount: number;
  currency: string;
  merchantRaw: string;
  cardLast4: string | null;
  timestamp: string; // ISO
  rawText: string;
};

const TBANK_AMOUNT = /([\d\s,.]+)\s*(руб|₽|RUB|USD|EUR)/i;
const TBANK_CARD = /\*{1,4}(\d{4})/;

const SBER_AMOUNT = /([\d\s,.]+\.?\d*)\s*(руб|₽|р|RUB)/i;
const SBER_CARD = /(?:карт[аое]\s*(?:\*+)?|VISA|MASTERCARD|МИР)(\d{4})/i;

const STOP_WORDS = new Set([
  "Покупка", "Оплата", "Операция", "Зачисление", "Перевод",
  "Снятие", "Банкомат", "Списано", "Карта", "от", "в", "на", "по", "за", "с", "для",
  "Баланс", "Счёт", "Счет",
]);

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\s/g, "").replace(",", ".")) || 0;
}

function detectCurrency(text: string): string {
  if (/USD/i.test(text)) return "USD";
  if (/EUR/i.test(text)) return "EUR";
  return "RUB";
}

function extractMerchantAfterAmount(
  text: string,
  amountMatch: RegExpMatchArray | null,
  prefixPattern: RegExp,
): string {
  if (!amountMatch) return "";
  const afterAmount = text.slice(amountMatch.index! + amountMatch[0].length);

  // 1. Ищем по шаблону с префиксом ("в магазине", "торговая точка:" и т.п.)
  const m1 = afterAmount.match(prefixPattern);
  if (m1?.[1]) {
    const val = m1[1].trim();
    if (val.length > 1) return val;
  }

  // 2. Ищем первое подходящее слово (не служебное)
  const wordRe = /([A-ZА-ЯЁ][A-Za-zА-Яа-яёЁ]*)/gi;
  let m2: RegExpExecArray | null;
  while ((m2 = wordRe.exec(afterAmount)) !== null) {
    const val = m2[1].trim();
    if (val.length > 1 && !STOP_WORDS.has(val)) {
      return val;
    }
  }

  return "";
}

export function parseTbankMessage(text: string): BankEvent {
  const cardMatch = text.match(TBANK_CARD);
  const amountMatch = text.match(TBANK_AMOUNT);

  const prefixPattern =
    /(?:в\s+магазине\s+|в\s+у\s+|в\s+)["«']?([A-Za-zА-Яа-яёЁ0-9\s\-&]+?)["»']?(?=\.|,|\s+Карта|\s+карта|$)/i;
  const merchantRaw = extractMerchantAfterAmount(text, amountMatch, prefixPattern);

  let operationType: BankEvent["operationType"] = "unknown";
  if (/покупка|оплата|списание/i.test(text)) operationType = "card_purchase";
  else if (/снятие|банкомат/i.test(text)) operationType = "atm_withdrawal";
  else if (/перевод|отправ/i.test(text)) operationType = "transfer_out";
  else if (/зачисление|поступление|пополнение/i.test(text)) operationType = "income";

  return {
    bank: "tbank",
    operationType,
    amount: amountMatch ? parseAmount(amountMatch[1]) : 0,
    currency: detectCurrency(text),
    merchantRaw: merchantRaw || text.slice(0, 60),
    cardLast4: cardMatch?.[1] ?? null,
    timestamp: new Date().toISOString(),
    rawText: text,
  };
}

export function parseSberMessage(text: string): BankEvent {
  const cardMatch = text.match(SBER_CARD);
  const amountMatch = text.match(SBER_AMOUNT);

  // Для Сбера: мерчант идёт после суммы и перед "Баланс:" или концом строки
  let merchantRaw = "";
  if (amountMatch) {
    const afterAmount = text.slice(amountMatch.index! + amountMatch[0].length);
    // Ищем мерчант до слова "Баланс" или конца строки
    const balanceIdx = afterAmount.search(/Баланс[:\s]/i);
    const merchantPart = balanceIdx >= 0 ? afterAmount.slice(0, balanceIdx) : afterAmount;
    // Берём первое слово/токен с буквами (включая * и цифры)
    const m = merchantPart.match(/([A-Za-zА-Яа-яёЁ][A-Za-zА-Яа-яёЁ0-9*\-_.]+)/);
    if (m) merchantRaw = m[1];
  }
  if (!merchantRaw) {
    const prefixPattern =
      /(?:торговая\s+точка\s*[:\s]+|в\s+магазине\s+|в\s+у\s+|в\s+)["«']?([A-Za-zА-Яа-яёЁ0-9\s\-&*]+?)["»']?(?=\.|,|\s+карта|\s+Карта|$)/i;
    merchantRaw = extractMerchantAfterAmount(text, amountMatch, prefixPattern);
  }

  let operationType: BankEvent["operationType"] = "unknown";
  if (/покупка|оплата|списано/i.test(text)) operationType = "card_purchase";
  else if (/снятие|банкомат/i.test(text)) operationType = "atm_withdrawal";
  else if (/перевод/i.test(text)) operationType = "transfer_out";
  else if (/зачислено|поступление|пополнение|зачисление\s+зарплаты|зачисление\s+премии/i.test(text)) operationType = "income";

  return {
    bank: "sber",
    operationType,
    amount: amountMatch ? parseAmount(amountMatch[1]) : 0,
    currency: detectCurrency(text),
    merchantRaw: merchantRaw || text.slice(0, 60),
    cardLast4: cardMatch?.[1] ?? null,
    timestamp: new Date().toISOString(),
    rawText: text,
  };
}

export function parseMessage(text: string, bank?: string): BankEvent {
  const lowerBank = (bank ?? "").toLowerCase();
  if (lowerBank === "tbank" || lowerBank === "tinkoff") return parseTbankMessage(text);
  if (lowerBank === "sber" || lowerBank === "sberbank") return parseSberMessage(text);
  // Auto-detect
  if (/тинькофф|tinkoff|tbank/i.test(text)) return parseTbankMessage(text);
  if (/сбербанк|sberbank|сбер/i.test(text)) return parseSberMessage(text);
  // Fallback — try Tbank parser
  return parseTbankMessage(text);
}
