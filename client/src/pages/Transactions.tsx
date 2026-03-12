import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Transaction, InsertTransaction } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const CATEGORIES = ["Еда", "Транспорт", "Развлечения", "Подписки", "Спорт", "ЖКХ", "Образование", "Доход", "Другое"];

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Math.abs(n));
}

function formatDate(d: string) {
  try { return format(new Date(d), "d MMM", { locale: ru }); }
  catch { return d; }
}

export default function Transactions() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [form, setForm] = useState<Partial<InsertTransaction>>({
    type: "expense",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });

  const addMut = useMutation({
    mutationFn: (data: InsertTransaction) => apiRequest("POST", "/api/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setOpen(false);
      setForm({ type: "expense", date: format(new Date(), "yyyy-MM-dd") });
      toast({ title: "Операция добавлена" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/transactions"] }),
  });

  const filtered = transactions.filter(t => filter === "all" || t.type === filter);

  const handleSubmit = () => {
    if (!form.title || !form.amount || !form.category || !form.type || !form.date) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    const amount = form.type === "expense" ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount));
    addMut.mutate({ ...form, amount } as InsertTransaction);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-transactions">Операции</h1>
          <p className="text-sm text-muted-foreground">История доходов и расходов</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="btn-add-transaction" size="sm" className="gap-2">
          <Plus size={16} /> Добавить
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2" data-testid="filter-tabs">
        {(["all", "income", "expense"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              filter === f
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-secondary"
            )}
          >
            {{ all: "Все", income: "Доходы", expense: "Расходы" }[f]}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingUp size={20} className="text-income flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Итого доходов</p>
              <p className="text-base font-bold tabular-nums text-income">
                {fmt(transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0))}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingDown size={20} className="text-expense flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Итого расходов</p>
              <p className="text-base font-bold tabular-nums text-expense">
                {fmt(transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Нет операций</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(tx => (
                <div key={tx.id} data-testid={`transaction-item-${tx.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    tx.type === "income" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"
                  )}>
                    {tx.type === "income"
                      ? <TrendingUp size={14} className="text-income" />
                      : <TrendingDown size={14} className="text-expense" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 font-normal">{tx.category}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums flex-shrink-0", tx.type === "income" ? "text-income" : "text-expense")}>
                    {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                  </span>
                  <button
                    onClick={() => deleteMut.mutate(tx.id)}
                    data-testid={`btn-delete-transaction-${tx.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая операция</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  data-testid={`type-${t}`}
                  className={cn(
                    "py-2 rounded-lg text-sm font-medium border transition-all",
                    form.type === t
                      ? t === "income" ? "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 border-red-400 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "border-border text-muted-foreground hover:border-primary"
                  )}
                >
                  {t === "expense" ? "Расход" : "Доход"}
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="tx-title">Название</Label>
              <Input id="tx-title" data-testid="input-tx-title" placeholder="Например, продукты" value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tx-amount">Сумма (₽)</Label>
              <Input id="tx-amount" data-testid="input-tx-amount" type="number" placeholder="0" value={form.amount ?? ""} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <Label>Категория</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-category" className="mt-1">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tx-date">Дата</Label>
              <Input id="tx-date" data-testid="input-tx-date" type="date" value={form.date ?? ""} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} data-testid="btn-submit-transaction" disabled={addMut.isPending}>
              {addMut.isPending ? "Сохранение..." : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
