import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Account } from "@shared/schema";
import { cn } from "@/lib/utils";
import { CreditCard, Check, ChevronDown, X } from "lucide-react";

interface CardFilterBarProps {
  accounts: Account[];
  selectedAccountIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

export function CardFilterBar({
  accounts,
  selectedAccountIds,
  onSelectionChange,
}: CardFilterBarProps) {
  const [open, setOpen] = useState(false);

  if (accounts.length === 0) return null;

  const toggle = (id: number) => {
    const next = new Set(selectedAccountIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const selectAll = () => {
    // Empty Set = "no filter" = show all accounts
    onSelectionChange(new Set<number>());
    setOpen(false);
  };

  const selectAllExplicit = () => {
    onSelectionChange(new Set(accounts.map(a => a.id)));
    setOpen(false);
  };

  const hasFilter = selectedAccountIds.size > 0;

  return (
    <div className="relative">
      {/* ── Trigger ─────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors",
          "border whitespace-nowrap flex-shrink-0",
          open || hasFilter
            ? "bg-primary text-white border-primary"
            : "bg-muted text-muted-foreground border-transparent hover:bg-secondary",
        )}
      >
        <CreditCard size={14} />
        <span>Счета</span>
        <AnimatePresence mode="wait">
          {hasFilter ? (
            <motion.span
              key="count"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-5 h-5 rounded-full bg-white/25 text-xs flex items-center justify-center font-bold leading-none"
            >
              {selectedAccountIds.size}
            </motion.span>
          ) : (
            <motion.span
              key="chevron"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center"
            >
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <ChevronDown size={13} />
              </motion.span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Dropdown ────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop — closes on outside click */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={cn(
                "absolute left-0 top-full mt-2 z-50 min-w-[200px] max-w-[280px]",
                "rounded-xl border bg-popover text-popover-foreground shadow-lg",
                "p-1.5 origin-top-left",
              )}
            >
              {/* Account rows */}
              <ul className="space-y-0.5">
                {accounts.map((acc, i) => {
                  const selected = selectedAccountIds.has(acc.id);
                  return (
                    <motion.li
                      key={acc.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 28 }}
                    >
                      <button
                        onClick={() => toggle(acc.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
                          "transition-colors text-left group",
                          selected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted/60 text-foreground",
                        )}
                      >
                        {/* Color dot */}
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: acc.color ?? "#20808D" }}
                        />
                        <span className="flex-1 truncate">{acc.name}</span>
                        {/* Type badge */}
                        {acc.type === "credit" && (
                          <span className="text-[10px] text-muted-foreground">(кредит)</span>
                        )}
                        {acc.type === "cash" && (
                          <span className="text-[10px] text-muted-foreground">(нал)</span>
                        )}
                        {/* Checkmark */}
                        <motion.span
                          animate={selected ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="flex-shrink-0"
                        >
                          <Check size={13} className="text-primary" />
                        </motion.span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>

              {/* ── Footer actions ──────────────────────────────── */}
              <div className="border-t mt-1.5 pt-1.5 flex gap-1">
                <button
                  onClick={selectAllExplicit}
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  Все
                </button>
                <button
                  onClick={selectAll}
                  disabled={!hasFilter}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1",
                    hasFilter
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground/40 cursor-not-allowed",
                  )}
                >
                  <X size={11} />
                  Сбросить
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
