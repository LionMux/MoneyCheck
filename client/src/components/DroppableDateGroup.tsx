import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Transaction } from "@shared/schema";
import type { DateGroup } from "@/components/TransactionDateGroup";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { useMemo } from "react";
import { DraggableTransactionItem } from "@/components/DraggableTransactionItem";

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
    if (isToday(d) || isYesterday(d)) return format(d, "d MMMM, EEEE", { locale: ru });
    return format(d, "EEEE", { locale: ru });
  } catch {
    return "";
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Math.abs(n));
}

interface DroppableDateGroupProps {
  group: DateGroup;
  index: number;
  renderRow: (tx: Transaction) => React.ReactNode;
  isDndActive: boolean;
}

export function DroppableDateGroup({ group, index, renderRow, isDndActive }: DroppableDateGroupProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `date:${group.dateKey}` });

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

  const sortableIds = group.transactions.map(tx => tx.id);

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 320, damping: 30 }}
      className={cn(
        "transition-colors duration-150",
        isOver && isDndActive && "bg-primary/5 rounded-lg ring-2 ring-primary/20",
      )}
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

      {/* Droppable + sortable rows */}
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {group.transactions.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
                transition={{
                  delay: index * 0.06 + i * 0.035,
                  type: "spring",
                  stiffness: 340,
                  damping: 32,
                }}
              >
                <DraggableTransactionItem id={tx.id}>
                  {renderRow(tx)}
                </DraggableTransactionItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </motion.div>
  );
}
