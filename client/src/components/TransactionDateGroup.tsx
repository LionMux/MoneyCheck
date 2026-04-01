import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import type { Transaction } from "@shared/schema";
import { cn } from "@/lib/utils";

function formatDayLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (isToday(d))     return "Сегодня";
    if (isYesterday(d)) return "Вчера";
    return format(d, "d MMMM", { locale: ru });
  } catch {
    return dateStr;
  }
}

function formatWeekday(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (isToday(d) || isYesterday(d)) {
      return format(d, "d MMMM, EEEE", { locale: ru });
    }
    return format(d, "EEEE", { locale: ru });
  } catch {
    return "";
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

export interface DateGroup {
  dateKey: string;
  transactions: Transaction[];
}

/**
 * TZ-safe date key extractor.
 *
 * The backend may return dates as:
 *   - "2026-03-31"             (date-only string)
 *   - "2026-03-31T00:00:00Z"  (ISO UTC midnight)
 *   - "2026-03-31T21:00:00.000Z" (UTC that may cross local midnight)
 *
 * We parse into a local Date and then format with the Swedish locale
 * (sv) which produces "YYYY-MM-DD" — effectively toLocaleDateString
 * in ISO format, but in the user's local timezone.
 */
function toLocalDateKey(dateValue: string | Date): string {
  try {
    // If it already looks like a plain date string (no T), keep as-is
    const s = String(dateValue);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Otherwise parse and re-format in local timezone
    return new Date(s).toLocaleDateString("sv"); // sv = ISO YYYY-MM-DD
  } catch {
    return String(dateValue).slice(0, 10);
  }
}

/**
 * Groups transactions by date and collapses transfer pairs into one row.
 *
 * The backend creates two `transfer` rows per operation:
 *   outTx: amount < 0, linkedTransactionId = inTx.id
 *   inTx:  amount > 0, linkedTransactionId = outTx.id
 *
 * Strategy: collect ids of incoming legs (outgoing legs reference them
 * via linkedTransactionId), then skip those ids entirely.
 */
export function groupByDate(transactions: Transaction[]): DateGroup[] {
  // Pass 1 — collect incoming leg IDs
  const incomingIds = new Set<number>();
  for (const tx of transactions) {
    if (
      tx.type === "transfer" &&
      tx.amount < 0 &&
      tx.linkedTransactionId != null
    ) {
      incomingIds.add(tx.linkedTransactionId);
    }
  }

  // Pass 2 — group by local date, skip incoming legs
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (incomingIds.has(tx.id)) continue;
    const key = toLocalDateKey(tx.date as string);
    const arr = map.get(key) ?? [];
    arr.push(tx);
    map.set(key, arr);
  }

  return Array.from(map.entries())
    .map(([dateKey, txs]) => ({ dateKey, transactions: txs }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

interface TransactionDateGroupProps {
  group: DateGroup;
  renderRow: (tx: Transaction) => React.ReactNode;
  index?: number;
}

export function TransactionDateGroup({
  group,
  renderRow,
  index = 0,
}: TransactionDateGroupProps) {
  const dayLabel = formatDayLabel(group.dateKey);
  const weekday  = formatWeekday(group.dateKey);

  const { totalIncome, totalExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of group.transactions) {
      if (tx.type === "income")                                   income  += Math.abs(tx.amount);
      if (tx.type === "expense" || tx.type === "creditPurchase") expense += Math.abs(tx.amount);
    }
    return { totalIncome: income, totalExpense: expense };
  }, [group.transactions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        type: "spring",
        stiffness: 320,
        damping: 30,
      }}
    >
      {/* Date header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 z-10 bg-background/90 backdrop-blur-sm">
        <div>
          <span className="text-sm font-semibold text-foreground">{dayLabel}</span>
          <span className="ml-2 text-xs text-muted-foreground capitalize">{weekday}</span>
        </div>
        <div className="flex items-center gap-2">
          {totalIncome > 0 && (
            <span className="text-xs font-medium tabular-nums text-income">+{fmt(totalIncome)}</span>
          )}
          {totalExpense > 0 && (
            <span className="text-xs font-medium tabular-nums text-expense">−{fmt(totalExpense)}</span>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className={cn("divide-y divide-border")}>
        {group.transactions.map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: index * 0.06 + i * 0.035,
              type: "spring",
              stiffness: 340,
              damping: 32,
            }}
          >
            {renderRow(tx)}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
