import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Budget, Transaction, InsertBudget } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

const PRESET_COLORS = ["#20808D", "#A84B2F", "#7A39BB", "#D19900", "#437A22", "#006494", "#944454", "#848456"];

export default function Budget() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<InsertBudget>>({ color: PRESET_COLORS[0] });

  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });

  const addMut = useMutation({
    mutationFn: (data: InsertBudget) => apiRequest("POST", "/api/budgets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setOpen(false);
      setForm({ color: PRESET_COLORS[0] });
      toast({ title: "Категория бюджета добавлена" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/budgets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/budgets"] }),
  });

  // Calculate spent per category
  const spentMap = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const budgetItems = budgets.map(b => ({
    ...b,
    spent: spentMap[b.category] || 0,
    pct: Math.min(Math.round(((spentMap[b.category] || 0) / b.limit) * 100), 100),
    over: (spentMap[b.category] || 0) > b.limit,
  }));

  const chartData = budgetItems.map(b => ({
    name: b.category,
    Лимит: b.limit,
    Потрачено: b.spent,
    color: b.color,
  }));

  const handleSubmit = () => {
    if (!form.category || !form.limit) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    addMut.mutate({ category: form.category, limit: Number(form.limit), color: form.color ?? PRESET_COLORS[0] });
  };

  const overCount = budgetItems.filter(b => b.over).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-budget">Бюджет</h1>
          <p className="text-sm text-muted-foreground">Лимиты расходов по категориям</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="btn-add-budget" size="sm" className="gap-2">
          <Plus size={16} /> Категория
        </Button>
      </div>

      {/* Alert if over budget */}
      {overCount > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Превышен лимит в <strong>{overCount}</strong> {overCount === 1 ? "категории" : "категориях"}. Проверьте свои расходы.
          </p>
        </div>
      )}

      {/* Bar chart overview */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Лимит vs. Факт</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [fmt(v)]} />
                <Bar dataKey="Лимит" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Потрачено" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Budget cards */}
      <div className="grid grid-cols-1 gap-3">
        {budgetItems.map(b => (
          <Card key={b.id} data-testid={`budget-item-${b.id}`}
            className={cn(b.over && "border-red-300 dark:border-red-800")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: b.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{b.category}</span>
                      {b.over
                        ? <AlertTriangle size={13} className="text-destructive" />
                        : b.pct >= 80 ? <TrendingDown size={13} className="text-yellow-500" /> : <CheckCircle2 size={13} className="text-income" />
                      }
                    </div>
                    <div className="text-right">
                      <span className={cn("text-sm font-bold tabular-nums", b.over ? "text-expense" : "text-foreground")}>
                        {fmt(b.spent)}
                      </span>
                      <span className="text-xs text-muted-foreground"> / {fmt(b.limit)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={b.pct}
                      className={cn("flex-1 h-2", b.over ? "[&>div]:bg-destructive" : b.pct >= 80 ? "[&>div]:bg-yellow-500" : "")}
                    />
                    <span className={cn("text-xs font-semibold w-9 text-right tabular-nums", b.over ? "text-expense" : "text-muted-foreground")}>
                      {b.pct}%
                    </span>
                  </div>
                  {b.over && (
                    <p className="text-xs text-expense mt-1">Перерасход: {fmt(b.spent - b.limit)}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteMut.mutate(b.id)}
                  data-testid={`btn-delete-budget-${b.id}`}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая категория бюджета</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Категория</Label>
              <Input
                data-testid="input-budget-category"
                placeholder="Например, Еда"
                value={form.category ?? ""}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Лимит в месяц (₽)</Label>
              <Input
                data-testid="input-budget-limit"
                type="number"
                placeholder="10000"
                value={form.limit ?? ""}
                onChange={e => setForm(f => ({ ...f, limit: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Цвет</Label>
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} data-testid="btn-submit-budget" disabled={addMut.isPending}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
