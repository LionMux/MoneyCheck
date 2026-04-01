import { useMemo } from "react";
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
  /** Deduplicated list: transfer pairs are collapsed to a single outgoing tx */
  transactions: Transaction[];
}

/**
 * Groups transactions by date and deduplicates transfer pairs.
 *
 * The backend creates two `transfer` rows per operation and links them via
 * `linkedTransactionId`.  We only keep the **outgoing** leg (amount < 0)
 * and silently drop the mirror incoming leg.  This means the list shows one
 * row per transfer instead of two.
 *
 * Grouping is by `tx.date` (first 10 chars), sorted newest-first.
 */
export function groupByDate(transactions: Transaction[]): DateGroup[] {
  // Collect IDs of incoming-leg transfers so we can skip them
  const incomingTransferIds = new Set<number>();

  for (const tx of transactions) {
    if (tx.type === "transfer" && tx.linkedTransactionId != null) {
      // outgoing leg: amount < 0.  Its linkedTransactionId points to the
      // incoming leg.  Mark that incoming leg for exclusion.
      if (tx.amount < 0) {
        incomingTransferIds.add(tx.linkedTransactionId);
      }
    }
  }

  const map = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    // Skip the incoming half of transfer pairs
    if (incomingTransferIds.has(tx.id)) continue;

    const key = String(tx.date).slice(0, 10);
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
      if (tx.type === "income")                                    income  += Math.abs(tx.amount);
      if (tx.type === "expense" || tx.type === "creditPurchase")  expense += Math.abs(tx.amount);
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
