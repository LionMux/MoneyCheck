import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Transaction, InsertTransaction, Account } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, TrendingUp, TrendingDown, CreditCard, Wallet, Banknote, ChevronDown, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Category { id: number; name: string; type: string; }

type FilterType = "all" | "income" | "expense" | "transfer";

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all",      label: "Все" },
  { value: "income",   label: "Доходы" },
  { value: "expense",  label: "Расходы" },
  { value: "transfer", label: "Переводы" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Math.abs(n));
}
function formatDate(d: string) {
  try { return format(new Date(d), "d MMM", { locale: ru }); }
  catch { return d; }
}
function resolveType(formType: "income" | "expense", account?: Account): string {
  if (!account || account.type !== "credit") return formType;
  return formType === "expense" ? "creditPurchase" : "creditPayment";
}

// ── Строка транзакции ────────────────────────────────────────────────────
function TxRow({ tx, onDelete }: { tx: Transaction; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const isIncome   = tx.type === "income";
  const isTransfer = tx.type === "creditPayment";
  const isExpense  = tx.type === "expense" || tx.type === "creditPurchase";

  const amountColor = isIncome ? "text-income" : isTransfer ? "text-blue-500" : "text-expense";
  const iconBg      = isIncome
    ? "bg-emerald-100 dark:bg-emerald-900/30"
    : isTransfer
    ? "bg-blue-100 dark:bg-blue-900/30"
    : "bg-red-100 dark:bg-red-900/30";
  const icon = isIncome
    ? <TrendingUp size={14} className="text-income" />
    : isTransfer
    ? <ArrowLeftRight size={14} className="text-blue-500" />
    : <TrendingDown size={14} className="text-expense" />;
  const prefix = isIncome ? "+" : "−";

  const isTruncated = tx.title.length > 28;

  return (
    <div
      data-testid={`transaction-item-${tx.id}`}
      className="px-4 py-3 hover:bg-muted/40 transition-colors group"
      onClick={() => isTruncated && setExpanded(e => !e)}
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", iconBg)}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn("text-sm font-medium", expanded ? "whitespace-normal break-words" : "truncate")}>
              {tx.title}
            </p>
            {isTruncated && (
              <ChevronDown size={13} className={cn(
                "flex-shrink-0 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-180",
              )} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 font-normal">{tx.category}</Badge>
            <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
            {tx.type === "creditPurchase" && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal text-orange-500 border-orange-300">Кредит</Badge>
            )}
            {tx.type === "creditPayment" && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal text-blue-500 border-blue-300">Погашение</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={cn("text-sm font-semibold tabular-nums", amountColor)}>
            {prefix}{fmt(tx.amount)}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            data-testid={`btn-delete-transaction-${tx.id}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Главная страница ────────────────────────────────────────────────────
export default function Transactions() {
  const { toast } = useToast();
  const [open, setOpen]     = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [form, setForm]     = useState<Partial<InsertTransaction> & { accountId?: number }>({
    type: "expense",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const { data: transactions = [] }  = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: accounts = [] }      = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: allCategories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const activeAccounts   = accounts.filter(a => !a.isArchived);
  const selectedAccount  = activeAccounts.find(a => a.id === form.accountId);
  const isCreditSelected = selectedAccount?.type === "credit";
  const formType         = (form.type === "expense" || form.type === "creditPurchase") ? "expense" : "income";
  const filteredCategories = allCategories.filter(c => c.type === formType);

  const addMut = useMutation({
    mutationFn: (data: InsertTransaction) => apiRequest("POST", "/api/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setOpen(false);
      setForm({ type: "expense", date: format(new Date(), "yyyy-MM-dd") });
      toast({ title: "Операция добавлена" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });

  // ── Фильтрация ───────────────────────────────────────────────────────
  const filtered = transactions.filter(t => {
    if (filter === "all")      return true;
    if (filter === "income")   return t.type === "income";                                // только чистый доход
    if (filter === "expense")  return t.type === "expense" || t.type === "creditPurchase"; // покупки (в т.ч. кредитные)
    if (filter === "transfer") return t.type === "creditPayment";                         // погашение = перевод
    return true;
  });

  // ── Итоги (creditPayment — не доход и не расход) ──────────────────────────
  const totalIncome  = transactions.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense" || t.type === "creditPurchase").reduce((s, t) => s + Math.abs(t.amount), 0);

  const handleSubmit = () => {
    if (!form.title || !form.amount || !form.category || !form.type || !form.date) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    const resolvedType = resolveType(form.type as "income" | "expense", selectedAccount);
    let amount: number;
    if (resolvedType === "creditPurchase")     amount = -Math.abs(Number(form.amount));
    else if (resolvedType === "creditPayment") amount =  Math.abs(Number(form.amount));
    else if (form.type === "expense")          amount = -Math.abs(Number(form.amount));
    else                                       amount =  Math.abs(Number(form.amount));

    const payload: any = { ...form, amount, type: resolvedType };
    if (!form.accountId) delete payload.accountId;
    addMut.mutate(payload as InsertTransaction);
  };

  const handleTypeChange = (t: "income" | "expense") => setForm(f => ({ ...f, type: t, category: undefined }));

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

      {/* Фильтры — с горизонтальным скроллом на узких экранах */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar" data-testid="filter-tabs">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            data-testid={`filter-${f.value}`}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              filter === f.value ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Итоги */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingUp size={20} className="text-income flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Итого доходов</p>
              <p className="text-base font-bold tabular-nums text-income">{fmt(totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingDown size={20} className="text-expense flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Итого расходов</p>
              <p className="text-base font-bold tabular-nums text-expense">{fmt(totalExpense)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Список */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Нет операций</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(tx => (
                <TxRow key={tx.id} tx={tx} onDelete={() => deleteMut.mutate(tx.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Новая операция</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map(t => (
                <button key={t} onClick={() => handleTypeChange(t)} data-testid={`type-${t}`}
                  className={cn(
                    "py-2 rounded-lg text-sm font-medium border transition-all",
                    form.type === t
                      ? t === "income"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-red-50 border-red-400 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "border-border text-muted-foreground hover:border-primary"
                  )}
                >
                  {t === "expense" ? "Расход" : "Доход"}
                </button>
              ))}
            </div>

            {activeAccounts.length > 0 && (
              <div>
                <Label>Счёт <span className="text-muted-foreground font-normal">(необязательно)</span></Label>
                <Select
                  value={form.accountId ? String(form.accountId) : "none"}
                  onValueChange={v => setForm(f => ({ ...f, accountId: v === "none" ? undefined : Number(v) }))}
                >
                  <SelectTrigger className="mt-1" data-testid="select-account">
                    <SelectValue placeholder="Без счёта" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без счёта</SelectItem>
                    {activeAccounts.map(acc => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color ?? "#10b981" }} />
                          <span>{acc.name}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {acc.type === "credit" ? "(кредит)" : acc.type === "cash" ? "(наличные)" : ""}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCreditSelected && (
                  <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
                    <CreditCard size={11} />
                    {form.type === "expense" ? "Покупка в кредит — долг возрастёт" : "Погашение кредита — долг уменьшится"}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="tx-title">Название</Label>
              <Input id="tx-title" data-testid="input-tx-title" placeholder="Например, продукты"
                value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tx-amount">Сумма (₽)</Label>
              <Input id="tx-amount" data-testid="input-tx-amount" type="number" placeholder="0"
                value={form.amount ?? ""} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <Label>Категория</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-category" className="mt-1">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.length === 0
                    ? <SelectItem value="__none" disabled>Нет категорий — добавьте в Настройках</SelectItem>
                    : filteredCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tx-date">Дата</Label>
              <Input id="tx-date" data-testid="input-tx-date" type="date"
                value={form.date ?? ""} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
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
