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

type ViewMode = "pulse" | "bars";
type Range = "7d" | "14d" | "month";

const VIEW_LABELS: Record<ViewMode, string> = { pulse: "Pulse", bars: "Bars" };
const RANGE_LABELS: Record<Range, string>   = { "7d": "7 д", "14d": "14 д", "month": "Месяц" };

function fmtY(v: number): string {
  if (v === 0) return "";
  if (v < 1_000)     return String(Math.round(v));
  if (v < 1_000_000) return `${Math.round(v / 1_000)}к`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}
function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

const TS: React.CSSProperties = {
  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
  borderRadius: 8, fontSize: 12, color: "hsl(var(--card-foreground))",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
};
const TI: React.CSSProperties = { color: "hsl(var(--card-foreground))" };
const TL: React.CSSProperties = { color: "hsl(var(--muted-foreground))", marginBottom: 2 };

function SegmentedControl<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center rounded-lg bg-muted p-0.5 gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-all duration-200 text-[10px] px-2 py-1",
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

export default function ActivityChart({ transactions }: { transactions: Transaction[] }) {
  const [view, setView]   = useState<ViewMode>("pulse");
  const [range, setRange] = useState<Range>("7d");

  const rawData = useMemo(() => {
    const today = new Date();
    let days: Date[];
    if (range === "7d")       days = Array.from({ length: 7 },  (_, i) => subDays(today, 6 - i));
    else if (range === "14d") days = Array.from({ length: 14 }, (_, i) => subDays(today, 13 - i));
    else days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });

    return days.map(d => {
      const ds     = format(d, "yyyy-MM-dd");
      const dayTxs = transactions.filter(t => t.date === ds);
      const label  = range === "month"
        ? format(d, "d", { locale: ru })
        : format(d, range === "7d" ? "EEEEEE" : "dd.MM", { locale: ru });
      return {
        label,
        fullDate: format(d, "d MMM", { locale: ru }),
        income:  dayTxs.filter(t => t.type === "income" && t.type !== "transfer").reduce((s, t) => s + t.amount, 0),
        expense: dayTxs.filter(t => (t.type === "expense" || t.type === "creditPurchase") && t.type !== "transfer").reduce((s, t) => s + Math.abs(t.amount), 0),
      };
    });
  }, [transactions, range]);

  const pulseData = useMemo(() => {
    let cumInc = 0, cumExp = 0;
    return rawData.map(d => {
      cumInc += d.income;
      cumExp += d.expense;
      return { ...d, cumInc, cumExp };
    });
  }, [rawData]);

  const totalIncome  = rawData.reduce((s, d) => s + d.income, 0);
  const totalExpense = rawData.reduce((s, d) => s + d.expense, 0);

  const tickEvery = range === "month" ? 4 : 1;
  const xTicks = rawData.filter((_, i) => i % tickEvery === 0).map(d => d.label);
  const barMax = range === "month" ? 8 : 22;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-none">Activity</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {range === "7d" ? "Последние 7 дней" : range === "14d" ? "Последние 14 дней" : "Текущий месяц"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <SegmentedControl
            options={Object.entries(RANGE_LABELS).map(([v, l]) => ({ value: v as Range, label: l }))}
            value={range} onChange={setRange}
          />
          <SegmentedControl
            options={Object.entries(VIEW_LABELS).map(([v, l]) => ({ value: v as ViewMode, label: l }))}
            value={view} onChange={setView}
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        {view === "pulse" ? (
          <AreaChart data={pulseData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="acInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="acExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#f43f5e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" ticks={xTicks}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false} tickFormatter={fmtY} width={36}
            />
            <RechartsTooltip
              contentStyle={TS} itemStyle={TI} labelStyle={TL}
              labelFormatter={(_, items) => items?.[0]?.payload?.fullDate ?? ""}
              formatter={(v: number, name: string) => [fmt(v), name]}
            />
            <Area type="monotone" dataKey="cumInc" name="Доход (итог)"
              stroke="#10b981" strokeWidth={2} fill="url(#acInc)" dot={false}
              activeDot={{ r: 4, fill: "#10b981", stroke: "white", strokeWidth: 2 }}
            />
            <Area type="monotone" dataKey="cumExp" name="Расход (итог)"
              stroke="#f43f5e" strokeWidth={2} fill="url(#acExp)" dot={false}
              activeDot={{ r: 4, fill: "#f43f5e", stroke: "white", strokeWidth: 2 }}
            />
          </AreaChart>
        ) : (
          <BarChart data={rawData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="bExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#f43f5e" stopOpacity={1} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" ticks={xTicks}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false} tickFormatter={fmtY} width={36}
            />
            <RechartsTooltip
              contentStyle={TS} itemStyle={TI} labelStyle={TL}
              labelFormatter={(_, items) => items?.[0]?.payload?.fullDate ?? ""}
              formatter={(v: number, name: string) => [fmt(v), name]}
            />
            <Bar dataKey="expense" name="Расход" fill="url(#bExp)"
              radius={[4, 4, 0, 0]} maxBarSize={barMax}
            />
          </BarChart>
        )}
      </ResponsiveContainer>

      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 pt-2 border-t border-border/50">
        {view === "pulse" ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-0.5 bg-[#10b981] rounded flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground">Доход</span>
              <span className="text-[11px] font-semibold tabular-nums text-foreground ml-auto sm:ml-0">{fmt(totalIncome)}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-0.5 bg-[#f43f5e] rounded flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground">Расход</span>
              <span className="text-[11px] font-semibold tabular-nums text-foreground ml-auto sm:ml-0">{fmt(totalExpense)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#f43f5e] flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground">Расходы за период</span>
            <span className="text-[11px] font-semibold tabular-nums text-foreground ml-auto">{fmt(totalExpense)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
