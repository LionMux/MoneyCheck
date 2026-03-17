import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MonthlySummaryItem {
  month: string;   // "YYYY-MM"
  income: number;
  expense: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: MonthlySummaryItem[];
  isLoading: boolean;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

const MONTH_ABBR = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн",
                    "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function fmt(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)    return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function getHeatColor(income: number, maxIncome: number): string {
  if (maxIncome === 0 || income === 0) return "hsl(var(--muted))";
  const ratio = income / maxIncome;
  if (ratio < 0.2)  return "#c8e6c9";
  if (ratio < 0.4)  return "#81c784";
  if (ratio < 0.65) return "#4caf50";
  if (ratio < 0.85) return "#2e7d32";
  return "#1b5e20";
}

function getTextColor(income: number, maxIncome: number): string {
  if (maxIncome === 0 || income === 0) return "hsl(var(--muted-foreground))";
  const ratio = income / maxIncome;
  return ratio >= 0.4 ? "#ffffff" : "hsl(var(--foreground))";
}

export function MonthlyIncomeModal({
  isOpen, onClose, data, isLoading, selectedMonth, onSelectMonth,
}: Props) {
  const currentYear = new Date().getFullYear();
  const [displayYear, setDisplayYear] = useState<number>(currentYear);

  const yearData = useMemo(() => {
    const map: Record<number, MonthlySummaryItem> = {};
    for (const item of data) {
      const [y, m] = item.month.split("-").map(Number);
      if (y === displayYear) map[m] = item;
    }
    return map;
  }, [data, displayYear]);

  const maxIncome = useMemo(() => {
    return Math.max(0, ...Object.values(yearData).map(d => d.income));
  }, [yearData]);

  const minYear = data.length > 0
    ? Number(data[0].month.split("-")[0])
    : currentYear;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden">

        {/* Заголовок: только название, крестик шадкн рендерит сам — даём ему место */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-semibold">
            История доходов
          </DialogTitle>
        </DialogHeader>

        {/* Переключатель года — отдельная строка под заголовком, центрированна */}
        <div className="flex items-center justify-center gap-3 px-5 pt-3 pb-3 border-b border-border">
          <button
            onClick={() => setDisplayYear(y => y - 1)}
            disabled={displayYear <= minYear}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            aria-label="Предыдущий год"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold w-12 text-center tabular-nums select-none">
            {displayYear}
          </span>
          <button
            onClick={() => setDisplayYear(y => y + 1)}
            disabled={displayYear >= currentYear}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            aria-label="Следующий год"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {MONTH_ABBR.map((abbr, idx) => {
                const monthNum = idx + 1;
                const monthStr = `${displayYear}-${String(monthNum).padStart(2, "0")}`;
                const entry = yearData[monthNum];
                const incomeVal = entry?.income ?? 0;
                const bg = getHeatColor(incomeVal, maxIncome);
                const textCol = getTextColor(incomeVal, maxIncome);
                const isSelected = selectedMonth === monthStr;
                const isFuture = monthStr > format(new Date(), "yyyy-MM");

                return (
                  <button
                    key={monthStr}
                    disabled={isFuture || (incomeVal === 0 && !entry)}
                    onClick={() => {
                      onSelectMonth(monthStr);
                      onClose();
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg p-2 h-16",
                      "transition-all duration-150",
                      isFuture
                        ? "opacity-30 cursor-not-allowed"
                        : "cursor-pointer hover:ring-2 hover:ring-primary/50",
                      isSelected && "ring-2 ring-primary shadow-sm"
                    )}
                    style={{ background: bg }}
                    aria-label={`${abbr} ${displayYear}: ${fmt(incomeVal)} ₽`}
                  >
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: textCol }}
                    >
                      {abbr}
                    </span>
                    <span
                      className="text-[13px] font-bold tabular-nums mt-0.5"
                      style={{ color: textCol }}
                    >
                      {fmt(incomeVal)}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Легенда */}
          {!isLoading && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">Интенсивность дохода:</span>
              <div className="flex items-center gap-1">
                {["hsl(var(--muted))", "#c8e6c9", "#81c784", "#4caf50", "#2e7d32", "#1b5e20"].map((c, i) => (
                  <span
                    key={i}
                    className="w-4 h-3 rounded-sm inline-block"
                    style={{ background: c }}
                  />
                ))}
                <span className="text-[11px] text-muted-foreground ml-1">Макс</span>
              </div>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
