import { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MonthlySummaryItem {
  month: string; // "YYYY-MM"
  income: number;
  expense: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: MonthlySummaryItem[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
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
  isOpen, onClose, data, isLoading, isError = false, onRetry,
  selectedMonth, onSelectMonth,
}: Props) {
  const currentYear = new Date().getFullYear();
  const [displayYear, setDisplayYear]   = useState<number>(currentYear);
  // [6.2] Состояние анимации: кликнутый месяц
  const [pulsing, setPulsing]           = useState<string | null>(null);
  // [6.3] Реф на первую кнопку для фокуса при открытии
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  // [6.3] Автофокус на переключатель года при открытии модалки
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

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

  // [6.2] Обработчик клика: pulse-анимация, затем переключение месяца
  function handleMonthClick(monthStr: string) {
    setPulsing(monthStr);
    setTimeout(() => {
      setPulsing(null);
      onSelectMonth(monthStr);
      onClose();
    }, 200);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/*
        [6.2] animate-in fade-in zoom-in-95 — стандартные Tailwind-классы shadcn
        [6.1] sm:max-w-lg — на мобиле окно растягивается на весь экран
      */}
      <DialogContent
        className="w-full sm:max-w-lg p-0 overflow-hidden"
        aria-label="Модальное окно истории доходов"
        aria-modal="true"
      >
        {/* [6.3] Заголовок */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-semibold">
            История доходов
          </DialogTitle>
        </DialogHeader>

        {/* Переключатель года */}
        <div className="flex items-center justify-center gap-3 px-5 pt-3 pb-3 border-b border-border">
          <button
            ref={firstBtnRef}
            onClick={() => setDisplayYear(y => y - 1)}
            disabled={displayYear <= minYear}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Предыдущий год"
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className="text-sm font-semibold w-12 text-center tabular-nums select-none"
            aria-live="polite"
            aria-atomic="true"
          >
            {displayYear}
          </span>
          <button
            onClick={() => setDisplayYear(y => y + 1)}
            disabled={displayYear >= currentYear}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Следующий год"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="px-5 py-4">

          {/* [6.5] Error state */}
          {isError && !isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <AlertCircle size={32} className="text-destructive opacity-70" />
              <p className="text-sm text-muted-foreground">
                Не удалось загрузить данные.
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Повторить загрузку"
                >
                  <RefreshCw size={14} />
                  Повторить
                </button>
              )}
            </div>

          ) : isLoading ? (
            // [6.4] Loading skeleton
            // [6.1] Мобайл: 2 колонки, планшет: 3, десктоп: 4
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>

          ) : (
            // [6.1] Сетка: 2 колонки на мобайле, 3 на планшете, 4 на широком экране
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {MONTH_ABBR.map((abbr, idx) => {
                const monthNum  = idx + 1;
                const monthStr  = `${displayYear}-${String(monthNum).padStart(2, "0")}`;
                const entry     = yearData[monthNum];
                const incomeVal = entry?.income ?? 0;
                const bg        = getHeatColor(incomeVal, maxIncome);
                const textCol   = getTextColor(incomeVal, maxIncome);
                const isSelected = selectedMonth === monthStr;
                const isFuture   = monthStr > format(new Date(), "yyyy-MM");
                const isPulsing  = pulsing === monthStr;

                return (
                  <button
                    key={monthStr}
                    disabled={isFuture || (incomeVal === 0 && !entry)}
                    onClick={() => handleMonthClick(monthStr)}
                    className={cn(
                      // [6.3] a11y: видимый focus-ring
                      "relative flex flex-col items-center justify-center rounded-lg p-2 h-16",
                      "transition-all duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isFuture
                        ? "opacity-30 cursor-not-allowed"
                        : "cursor-pointer hover:ring-2 hover:ring-primary/50",
                      isSelected && "ring-2 ring-primary shadow-sm",
                      // [6.2] Pulse-анимация при клике
                      isPulsing && "scale-95 opacity-70"
                    )}
                    style={{ background: bg }}
                    // [6.3] Полноценный aria-label для скринридеров
                    aria-label={`${abbr} ${displayYear}: ${incomeVal > 0 ? fmt(incomeVal) + " ₽" : "данных нет"}`}
                    aria-pressed={isSelected}
                    tabIndex={isFuture ? -1 : 0}
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
                      <span
                        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Легенда */}
          {!isLoading && !isError && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">Интенсивность дохода:</span>
              <div
                className="flex items-center gap-1"
                role="img"
                aria-label="Шкала интенсивности от 0 до максимального дохода"
              >
                {["hsl(var(--muted))", "#c8e6c9", "#81c784", "#4caf50", "#2e7d32", "#1b5e20"].map((c, i) => (
                  <span
                    key={i}
                    className="w-4 h-3 rounded-sm inline-block"
                    style={{ background: c }}
                    aria-hidden="true"
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
