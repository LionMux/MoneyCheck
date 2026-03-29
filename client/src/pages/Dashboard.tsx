import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transaction, Budget, SavingsGoal, UserProgress, Account } from "@shared/schema";
import { TrendingUp, TrendingDown, Wallet, BookOpen, ArrowRight, CalendarDays, ArrowLeftRight } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PieChart, Pie, Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  MonthlyIncomeModal,
  type MonthlySummaryItem,
} from "@/components/MonthlyIncomeModal";
import ActivityChart from "@/components/ActivityChart";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 12,
  color: "hsl(var(--card-foreground))",
};
const TOOLTIP_ITEM_STYLE: React.CSSProperties = { color: "hsl(var(--card-foreground))" };
const TOOLTIP_LABEL_STYLE: React.CSSProperties = { color: "hsl(var(--muted-foreground))", marginBottom: 2 };

const CATEGORY_COLORS: Record<string, string> = {
  "Еда": "#20808D",
  "Транспорт": "#A84B2F",
  "Развлечения": "#7A39BB",
  "Подписки": "#D19900",
  "Спорт": "#437A22",
  "ЖКХ": "#006494",
  "Образование": "#944454",
  "Другое": "#848456",
};

export default function Dashboard() {
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [modalOpen, setModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: budgets = [] }      = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const { data: goals = [] }        = useQuery<SavingsGoal[]>({ queryKey: ["/api/goals"] });
  const { data: progress }          = useQuery<UserProgress>({ queryKey: ["/api/progress"] });
  const { data: accounts = [] }     = useQuery<Account[]>({ queryKey: ["/api/accounts"] });

  const {
    data: monthlySummary = [],
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery<MonthlySummaryItem[]>({
    queryKey: ["/api/transactions/monthly-summary"],
  });

  function handleSummaryRetry() {
    queryClient.invalidateQueries({ queryKey: ["/api/transactions/monthly-summary"] });
  }

  const totalBalance = accounts
    .filter(a => !a.isArchived && (a.type === "debit" || a.type === "cash" || a.type === "other"))
    .reduce((s, a) => s + parseFloat(String((a as any).balance ?? a.initialBalance)), 0);

  const monthTxs = transactions.filter(t => t.date.startsWith(currentDisplayMonth));

  // creditPayment = перевод на кредитку, не доход и не расход
  const income  = monthTxs.filter(t => t.type === "income" && t.type !== "transfer").reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter(t => (t.type === "expense" || t.type === "creditPurchase") && t.type !== "transfer").reduce((s, t) => s + Math.abs(t.amount), 0);

  const incomeCount  = monthTxs.filter(t => t.type === "income" && t.type !== "transfer").length;
  const expenseCount = monthTxs.filter(t => (t.type === "expense" || t.type === "creditPurchase") && t.type !== "transfer").length;

  const monthLabel    = format(new Date(currentDisplayMonth + "-01"), "LLLL", { locale: ru });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Круговая диаграмма: только расходы текущего месяца, без переводов на кредитку
  const catData = Object.entries(
    monthTxs
      .filter(t => (t.type === "expense" || t.type === "creditPurchase") && t.type !== "transfer")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
        return acc;
      }, {} as Record<string, number>)
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const recentTxs = transactions.slice(0, 5);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-dashboard">Дашборд</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "d MMMM yyyy", { locale: ru })}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="kpi-balance">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Баланс</span>
                <Wallet size={16} className="text-primary" />
              </div>
              <p className={cn("text-xl font-bold tabular-nums", totalBalance >= 0 ? "text-income" : "text-expense")}>
                {fmt(totalBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">дебет + наличные</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-income">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Доходы</span>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-income" />
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setModalOpen(true)}
                        className="p-0.5 rounded hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label="История доходов по месяцам"
                      >
                        <CalendarDays size={14} className="text-muted-foreground/70 hover:text-primary transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      История доходов по месяцам
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums text-income">{fmt(income)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {monthLabelCap} · {incomeCount} операций
              </p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-expense">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Расходы</span>
                <TrendingDown size={16} className="text-expense" />
              </div>
              <p className="text-xl font-bold tabular-nums text-expense">{fmt(expense)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {monthLabelCap} · {expenseCount} операций
              </p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-savings">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Уровень</span>
                <BookOpen size={16} className="text-primary" />
              </div>
              <p className="text-xl font-bold tabular-nums text-primary">
                {progress?.level ?? 1}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{progress?.totalXp ?? 0} XP набрано</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <ActivityChart transactions={transactions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Расходы по категориям · {monthLabelCap}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3 pt-1">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                    {catData.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[entry.name] ?? "#848456"} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(v: number, name: string) => [fmt(v), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 w-full">
                {catData.map((entry) => (
                  <span key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[entry.name] ?? "#848456" }} />
                    {entry.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Последние операции</CardTitle>
                <Link href="/transactions">
                  <a className="text-xs text-primary flex items-center gap-1 hover:underline">Все <ArrowRight size={12} /></a>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {recentTxs.map(tx => {
                const isIncome   = tx.type === "income";
                const isTransfer = tx.type === "creditPayment";
                const color = isIncome ? "text-income" : isTransfer ? "text-blue-500" : "text-expense";
                const icon  = isIncome
                  ? <TrendingUp size={13} className="text-income" />
                  : isTransfer
                  ? <ArrowLeftRight size={13} className="text-blue-500" />
                  : <TrendingDown size={13} className="text-expense" />;
                const prefix = isIncome ? "+" : "−";
                return (
                  <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {icon}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate leading-none">{tx.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{tx.category}</p>
                      </div>
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums flex-shrink-0", color)}>
                      {prefix}{fmt(Math.abs(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Цели накоплений</CardTitle>
                <Link href="/goals">
                  <a className="text-xs text-primary flex items-center gap-1 hover:underline">Все <ArrowRight size={12} /></a>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {goals.slice(0, 3).map(goal => {
                const pct = Math.round((goal.currentAmount / goal.targetAmount) * 100);
                return (
                  <div key={goal.id} data-testid={`goal-item-${goal.id}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{goal.title}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-xs font-semibold w-8 text-right tabular-nums">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <MonthlyIncomeModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          data={monthlySummary}
          isLoading={summaryLoading}
          isError={summaryError}
          onRetry={handleSummaryRetry}
          selectedMonth={currentDisplayMonth}
          onSelectMonth={setCurrentDisplayMonth}
        />
      </div>
    </TooltipProvider>
  );
}
