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

const TBANK_PURCHASE =
  /(?:Покупка|Оплата|Операция)[:\s]+?([\d,. ]+)\s*(руб|₽|RUB|USD|EUR)?[\s\S]*?(?:в |В |у )?(.*?)(?:\n|$|\s{2,})/i;
const TBANK_AMOUNT = /([\d\s,.]+)\s*(руб|₽|RUB|USD|EUR)/i;
const TBANK_CARD = /\*{1,4}(\d{4})/;
const TBANK_MERCHANT_PATTERNS = [
  /(?:в магазине|в |у )"?([A-Za-zА-Яа-яёЁ0-9\s\-.,&]+)"?/i,
  /([A-Z][A-Z0-9\s\-*]+?)(?:\s{2,}|\n|$)/,
];

const SBER_AMOUNT = /([\d\s,]+\.?\d*)\s*(руб|₽|RUB)/i;
const SBER_CARD = /карт[аое]\s*(?:\*+)?(\d{4})/i;
const SBER_MERCHANT = /(?:в |В |торговая точка[:\ ]+|Перевод[:\ ]+|Зачисление[:\ ]+)"?([\w\s\-.,&А-Яа-яёЁ]+?)"?(?:[.\n]|$)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\s/g, "").replace(",", ".")) || 0;
}

function detectCurrency(text: string): string {
  if (/USD/i.test(text)) return "USD";
  if (/EUR/i.test(text)) return "EUR";
  return "RUB";
}

export function parseTbankMessage(text: string): BankEvent {
  const cardMatch = text.match(TBANK_CARD);
  const amountMatch = text.match(TBANK_AMOUNT);

  let merchantRaw = "";
  for (const p of TBANK_MERCHANT_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) { merchantRaw = m[1].trim(); break; }
  }

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
  const merchantMatch = text.match(SBER_MERCHANT);

  let operationType: BankEvent["operationType"] = "unknown";
  if (/покупка|оплата|списано/i.test(text)) operationType = "card_purchase";
  else if (/снятие|банкомат/i.test(text)) operationType = "atm_withdrawal";
  else if (/перевод/i.test(text)) operationType = "transfer_out";
  else if (/зачислено|поступление|пополнение/i.test(text)) operationType = "income";

  return {
    bank: "sber",
    operationType,
    amount: amountMatch ? parseAmount(amountMatch[1]) : 0,
    currency: detectCurrency(text),
    merchantRaw: merchantMatch?.[1]?.trim() || text.slice(0, 60),
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
