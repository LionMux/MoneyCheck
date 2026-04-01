import { motion, AnimatePresence } from "framer-motion";
import type { Account } from "@shared/schema";
import { cn } from "@/lib/utils";
import { CreditCard, Check, X, Wallet } from "lucide-react";
import { useDisplayPreferences } from "@/contexts/DisplayPreferencesContext";

interface CardFilterBarProps {
  accounts: Account[];
  selectedAccountIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

export function CardFilterBar({
  accounts,
  selectedAccountIds,
  onSelectionChange,
}: CardFilterBarProps) {
  const { showBalance } = useDisplayPreferences();

  if (accounts.length === 0) return null;

  const toggle = (id: number) => {
    const next = new Set(selectedAccountIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const clearFilter = () => onSelectionChange(new Set<number>());

  const hasFilter = selectedAccountIds.size > 0;

  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <CreditCard size={12} />
          Счета
        </span>
        <AnimatePresence>
          {hasFilter && (
            <motion.button
              key="clear"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearFilter}
              className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              <X size={11} />
              Сбросить
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Account chips — wrap naturally, no horizontal scroll */}
      <div className="flex flex-wrap gap-2">
        {accounts.map((acc) => {
          const selected = selectedAccountIds.has(acc.id);
          // Prefer currentBalance if available (computed server-side), fall back to initialBalance
          const balance = (acc as any).currentBalance ?? acc.initialBalance ?? 0;
          return (
            <motion.button
              key={acc.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggle(acc.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all min-w-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                selected
                  ? "bg-primary/10 border-primary/40 text-primary font-medium"
                  : "bg-muted/60 border-transparent text-foreground hover:bg-muted",
              )}
            >
              {/* Color dot */}
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: acc.color ?? "#20808D" }}
              />

              <span className="truncate max-w-[120px]">{acc.name}</span>

              {/* Balance badge — reactive via context */}
              {showBalance && (
                <span className={cn(
                  "text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-full leading-none flex-shrink-0",
                  selected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted-foreground/10 text-muted-foreground",
                )}>
                  {fmt(balance)}
                </span>
              )}

              {/* Type badge */}
              {acc.type === "credit" && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0">(кредит)</span>
              )}
              {acc.type === "cash" && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                  <Wallet size={9} /> нал
                </span>
              )}

              {/* Checkmark */}
              <AnimatePresence>
                {selected && (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="flex-shrink-0"
                  >
                    <Check size={13} className="text-primary" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
