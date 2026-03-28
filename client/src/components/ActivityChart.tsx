import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, subDays, startOfMonth, eachDayOfInterval, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Transaction } from "@shared/schema";

// ── Типы ──────────────────────────────────────────────────────────────────
type ViewMode = "pulse" | "bars";
type Range = "7d" | "14d" | "month";

const VIEW_LABELS: Record<ViewMode, string> = {
  pulse: "Pulse",
  bars:  "Bars",
};

const RANGE_LABELS: Record<Range, string> = {
  "7d":    "7 д",
  "14d":   "14 д",
  "month": "Месяц",
};

// ── Помощники ──────────────────────────────────────────────────────────────
function fmtY(v: number): string {
  if (v === 0) return "";
  if (v < 1_000)     return String(Math.round(v));
  if (v < 1_000_000) return `${Math.round(v / 1_000)}к`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency", currency: "RUB", maximumFractionDigits: 0,
  }).format(n);
}

// ── Стили tooltip ─────────────────────────────────────────────────────────────
const TS: React.CSSProperties = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8, fontSize: 12,
  color: "hsl(var(--card-foreground))",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
};
const TI: React.CSSProperties = { color: "hsl(var(--card-foreground))" };
const TL: React.CSSProperties = { color: "hsl(var(--muted-foreground))", marginBottom: 2 };

// ── Переключатель ─────────────────────────────────────────────────────────────
function SegmentedControl<T extends string>({
  options, value, onChange, size = "sm",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "xs";
}) {
  return (
    <div className={cn(
      "flex items-center rounded-lg bg-muted p-0.5 gap-0.5",
    )}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-all duration-200",
            size === "xs"
              ? "text-[10px] px-2 py-1"
              : "text-[11px] px-3 py-1",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Карточка статистики ───────────────────────────────────────────────────────
function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums ml-auto">{value}</span>
    </div>
  );
}

// ── Главный компонент ────────────────────────────────────────────────────────────
export default function ActivityChart({ transactions }: { transactions: Transaction[] }) {
  const [view, setView]   = useState<ViewMode>("pulse");
  const [range, setRange] = useState<Range>("7d");

  // ── Формируем данные ─────────────────────────────────────────────────────
  const data = useMemo(() => {
    let days: Date[];
    const today = new Date();

    if (range === "7d")    days = Array.from({ length: 7 },  (_, i) => subDays(today, 6 - i));
    else if (range === "14d") days = Array.from({ length: 14 }, (_, i) => subDays(today, 13 - i));
    else {
      const start = startOfMonth(today);
      const end   = endOfMonth(today);
      days = eachDayOfInterval({ start, end });
    }

    // Для месяца — группируем по неделям… нет, показываем подневно
    return days.map(d => {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayTxs  = transactions.filter(t => t.date === dateStr);
      const label   = range === "month"
        ? format(d, "d", { locale: ru })
        : format(d, range === "7d" ? "EEEEEE" : "dd.MM", { locale: ru });
      return {
        label,
        fullDate: format(d, "d MMM", { locale: ru }),
        income:  dayTxs.filter(t => t.type === "income"  || t.type === "creditPayment").reduce((s, t) => s + t.amount, 0),
        expense: dayTxs.filter(t => t.type === "expense" || t.type === "creditPurchase").reduce((s, t) => s + Math.abs(t.amount), 0),
      };
    });
  }, [transactions, range]);

  // ── Суммары для stat-плашек ───────────────────────────────────────────────────
  const totalIncome  = data.reduce((s, d) => s + d.income, 0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);
  const avgIncome    = totalIncome  / (data.filter(d => d.income  > 0).length || 1);
  const avgExpense   = totalExpense / (data.filter(d => d.expense > 0).length || 1);
  const balance      = totalIncome - totalExpense;

  // макс для ReferenceLine (среднее)
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);

  // Такт для оси X при много точек
  const tickEvery = range === "month" ? 4 : 1;
  const xTicks = data
    .filter((_, i) => i % tickEvery === 0)
    .map(d => d.label);

  // ── Рендер ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Заголовок + переключатели */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold leading-none">Activity</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {range === "7d" ? "Последние 7 дней" :
             range === "14d" ? "Последние 14 дней" :
             "Текущий месяц"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            options={Object.entries(RANGE_LABELS).map(([v, l]) => ({ value: v as Range, label: l }))}
            value={range}
            onChange={setRange}
            size="xs"
          />
          <SegmentedControl
            options={Object.entries(VIEW_LABELS).map(([v, l]) => ({ value: v as ViewMode, label: l }))}
            value={view}
            onChange={setView}
            size="xs"
          />
        </div>
      </div>

      {/* График */}
      <ResponsiveContainer width="100%" height={180}>
        {view === "pulse" ? (
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="acInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="acExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              ticks={xTicks}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false}
              tickFormatter={fmtY} width={36}
            />
            {/* Линия среднего дохода */}
            {avgIncome > 0 && (
              <ReferenceLine
                y={avgIncome} stroke="#10b981" strokeDasharray="4 3"
                strokeOpacity={0.5} strokeWidth={1}
              />
            )}
            {/* Линия среднего расхода */}
            {avgExpense > 0 && (
              <ReferenceLine
                y={avgExpense} stroke="#f43f5e" strokeDasharray="4 3"
                strokeOpacity={0.5} strokeWidth={1}
              />
            )}
            <RechartsTooltip
              contentStyle={TS} itemStyle={TI} labelStyle={TL}
              labelFormatter={(l, items) => {
                const pt = items?.[0]?.payload;
                return pt?.fullDate ?? l;
              }}
              formatter={(v: number, name: string) => [fmt(v), name]}
            />
            <Area
              type="monotone" dataKey="income" name="Доход"
              stroke="#10b981" strokeWidth={2}
              fill="url(#acInc)" dot={false} activeDot={{ r: 4, fill: "#10b981" }}
            />
            <Area
              type="monotone" dataKey="expense" name="Расход"
              stroke="#f43f5e" strokeWidth={2}
              fill="url(#acExp)" dot={false} activeDot={{ r: 4, fill: "#f43f5e" }}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <defs>
              <linearGradient id="bInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#10b981" stopOpacity={1} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="bExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#f43f5e" stopOpacity={1} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              ticks={xTicks}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false}
              tickFormatter={fmtY} width={36}
            />
            <RechartsTooltip
              contentStyle={TS} itemStyle={TI} labelStyle={TL}
              labelFormatter={(l, items) => {
                const pt = items?.[0]?.payload;
                return pt?.fullDate ?? l;
              }}
              formatter={(v: number, name: string) => [fmt(v), name]}
            />
            <Bar dataKey="income"  name="Доход"  fill="url(#bInc)" radius={[3, 3, 0, 0]} maxBarSize={range === "month" ? 8 : 20} />
            <Bar dataKey="expense" name="Расход" fill="url(#bExp)" radius={[3, 3, 0, 0]} maxBarSize={range === "month" ? 8 : 20} />
          </BarChart>
        )}
      </ResponsiveContainer>

      {/* Легенда + цифры */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
        <StatBadge label="Доход" value={fmt(totalIncome)}  color="#10b981" />
        <StatBadge label="Расход" value={fmt(totalExpense)} color="#f43f5e" />
        <StatBadge
          label="Баланс"
          value={fmt(Math.abs(balance))}
          color={balance >= 0 ? "#10b981" : "#f43f5e"}
        />
      </div>
    </div>
  );
}
