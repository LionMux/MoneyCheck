import { useState, useMemo } from "react";
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
import { Trash2, Plus, TrendingUp, TrendingDown, CreditCard, ChevronDown, ArrowLeftRight, MoveRight, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { CardFilterBar } from "@/components/CardFilterBar";
import { TransactionDateGroup, groupByDate } from "@/components/TransactionDateGroup";

interface Category { id: number; name: string; type: string; }

type FilterType = "all" | "income" | "expense" | "transfer";
type FormMode  = "expense" | "income" | "transfer";

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

/**
 * Parses the transfer title created by the backend:
 * "Перевод: Сбербанк → Тинькофф"  →  { from: "Сбербанк", to: "Тинькофф" }
 * Falls back gracefully if the format doesn't match.
 */
function parseTransferTitle(title: string): { from: string; to: string } | null {
  const match = title.match(/^Перевод:\s*(.+?)\s*→\s*(.+)$/);
  if (!match) return null;
  return { from: match[1].trim(), to: match[2].trim() };
}

// ── Строка перевода ──────────────────────────────────────────────
function TransferRow({ tx, onDelete }: { tx: Transaction; onDelete: () => void }) {
  const parsed = parseTransferTitle(tx.title);

  return (
    <div
      data-testid={`transaction-item-${tx.id}`}
      className="px-4 py-3 hover:bg-muted/40 transition-colors group"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <ArrowLeftRight size={14} className="text-blue-500" />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          {parsed ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-foreground truncate max-w-[7rem]">{parsed.from}</span>
              <ArrowRight size={12} className="text-blue-400 flex-shrink-0" />
              <span className="text-sm font-medium text-foreground truncate max-w-[7rem]">{parsed.to}</span>
            </div>
          ) : (
            <p className="text-sm font-medium truncate">{tx.title}</p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal text-blue-500 border-blue-300">
              Перевод
            </Badge>
            {tx.note && (
              <span className="text-xs text-muted-foreground truncate max-w-[12rem]">{tx.note}</span>
            )}
          </div>
        </div>

        {/* Amount + delete */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-sm font-semibold tabular-nums text-blue-500">
            {fmt(tx.amount)}
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

// ── Строка обычной транзакции ────────────────────────────────────
function TxRow({ tx, accounts, onDelete }: { tx: Transaction; accounts: Account[]; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const isIncome  = tx.type === "income";
  const isExpense = tx.type === "expense" || tx.type === "creditPurchase";

  const amountColor = isIncome ? "text-income" : "text-expense";
  const iconBg      = isIncome
    ? "bg-emerald-100 dark:bg-emerald-900/30"
    : "bg-red-100 dark:bg-red-900/30";
  const icon = isIncome
    ? <TrendingUp size={14} className="text-income" />
    : <TrendingDown size={14} className="text-expense" />;
  const prefix = isIncome ? "+" : "−";

  const txAccount = tx.accountId ? accounts.find(a => a.id === tx.accountId) : null;
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
            {txAccount && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: txAccount.color ?? "#20808D" }} />
                {txAccount.name}
              </span>
            )}
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

// ── Селектор счёта ────────────────────────────────────────────
function AccountSelect({
  value, onChange, accounts, placeholder, testId,
}: {
  value: number | undefined;
  onChange: (id: number) => void;
  accounts: Account[];
  placeholder: string;
  testId?: string;
}) {
  return (
    <Select
      value={value ? String(value) : ""}
      onValueChange={v => onChange(Number(v))}
    >
      <SelectTrigger className="mt-1" data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map(acc => (
          <SelectItem key={acc.id} value={String(acc.id)}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color ?? "#10b981" }} />
              <span>{acc.name}</span>
              <span className="text-xs text-muted-foreground">
                {acc.type === "credit" ? "(кредит)" : acc.type === "cash" ? "(нал)" : ""}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Главная страница ───────────────────────────────────────────
export default function Transactions() {
  const { toast } = useToast();
  const [open, setOpen]       = useState(false);
  const [filter, setFilter]   = useState<FilterType>("all");
  const [mode, setMode]       = useState<FormMode>("expense");

  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());

  const [form, setForm] = useState<Partial<InsertTransaction> & { accountId?: number }>({
    type: "expense",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const [transfer, setTransfer] = useState<{
    fromAccountId?: number;
    toAccountId?: number;
    amount?: number;
    date: string;
    note?: string;
  }>({
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

  const transferMut = useMutation({
    mutationFn: (data: typeof transfer) => apiRequest("POST", "/api/transfers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setOpen(false);
      setTransfer({ date: format(new Date(), "yyyy-MM-dd") });
      toast({ title: "Перевод выполнен" });
    },
    onError: (e: any) => {
      toast({ title: e.message ?? "Ошибка перевода", variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });

  // ── Фильтрация ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = transactions;

    if (filter !== "all") {
      list = list.filter(t => {
        if (filter === "income")   return t.type === "income";
        if (filter === "expense")  return t.type === "expense" || t.type === "creditPurchase";
        if (filter === "transfer") return t.type === "transfer";
        return true;
      });
    }

    if (selectedAccountIds.size > 0) {
      list = list.filter(t => t.accountId != null && selectedAccountIds.has(t.accountId));
    }

    return list;
  }, [transactions, filter, selectedAccountIds]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const totalIncome  = transactions.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense" || t.type === "creditPurchase").reduce((s, t) => s + Math.abs(t.amount), 0);

  const handleSubmit = () => {
    if (mode === "transfer") {
      if (!transfer.fromAccountId || !transfer.toAccountId || !transfer.amount) {
        toast({ title: "Заполните все поля перевода", variant: "destructive" });
        return;
      }
      if (transfer.fromAccountId === transfer.toAccountId) {
        toast({ title: "Выберите разные счета", variant: "destructive" });
        return;
      }
      transferMut.mutate(transfer as any);
      return;
    }
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

  const handleModeChange = (m: FormMode) => {
    setMode(m);
    if (m !== "transfer") setForm(f => ({ ...f, type: m, category: undefined }));
  };

  const handleClose = () => {
    setOpen(false);
    setMode("expense");
    setForm({ type: "expense", date: format(new Date(), "yyyy-MM-dd") });
    setTransfer({ date: format(new Date(), "yyyy-MM-dd") });
  };

  const fromAcc = activeAccounts.find(a => a.id === transfer.fromAccountId);
  const toAcc   = activeAccounts.find(a => a.id === transfer.toAccountId);

  // Row renderer — routes transfer type to TransferRow, rest to TxRow
  const renderRow = (tx: Transaction) => {
    if (tx.type === "transfer") {
      return (
        <TransferRow
          key={tx.id}
          tx={tx}
          onDelete={() => deleteMut.mutate(tx.id)}
        />
      );
    }
    return (
      <TxRow
        key={tx.id}
        tx={tx}
        accounts={activeAccounts}
        onDelete={() => deleteMut.mutate(tx.id)}
      />
    );
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

      {/* Фильтры */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar" data-testid="filter-tabs">
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

        {activeAccounts.length > 0 && (
          <CardFilterBar
            accounts={activeAccounts}
            selectedAccountIds={selectedAccountIds}
            onSelectionChange={setSelectedAccountIds}
          />
        )}
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
        <CardContent className="p-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {groups.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-muted-foreground py-12 text-sm"
              >
                Нет операций
              </motion.p>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="divide-y divide-border"
              >
                {groups.map((group, i) => (
                  <TransactionDateGroup
                    key={group.dateKey}
                    group={group}
                    index={i}
                    renderRow={renderRow}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Диалог */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {mode === "transfer" ? "Перевод между счетами" : "Новая операция"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-xl">
              {([
                { v: "expense"  as FormMode, label: "Расход",  activeClass: "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
                { v: "income"   as FormMode, label: "Доход",   activeClass: "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
                { v: "transfer" as FormMode, label: "Перевод", activeClass: "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
              ]).map(({ v, label, activeClass }) => (
                <button
                  key={v}
                  onClick={() => handleModeChange(v)}
                  data-testid={`type-${v}`}
                  className={cn(
                    "py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    mode === v ? activeClass : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "transfer" ? (
              <>
                {activeAccounts.length < 2 ? (
                  <div className="py-6 text-center">
                    <ArrowLeftRight size={32} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Для перевода нужно минимум два счёта</p>
                    <p className="text-xs text-muted-foreground mt-1">Создайте их в разделе «Счета»</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Откуда</Label>
                        <AccountSelect
                          value={transfer.fromAccountId}
                          onChange={id => setTransfer(t => ({ ...t, fromAccountId: id }))}
                          accounts={activeAccounts.filter(a => a.id !== transfer.toAccountId)}
                          placeholder="Счёт-источник"
                          testId="select-from-account"
                        />
                      </div>
                      <div className="mt-5 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <MoveRight size={14} className="text-blue-500" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Куда</Label>
                        <AccountSelect
                          value={transfer.toAccountId}
                          onChange={id => setTransfer(t => ({ ...t, toAccountId: id }))}
                          accounts={activeAccounts.filter(a => a.id !== transfer.fromAccountId)}
                          placeholder="Счёт-назначение"
                          testId="select-to-account"
                        />
                      </div>
                    </div>

                    {fromAcc && toAcc && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: fromAcc.color ?? "#20808D" }} />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{fromAcc.name}</span>
                        <ArrowLeftRight size={12} className="text-blue-400 flex-shrink-0 mx-0.5" />
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: toAcc.color ?? "#20808D" }} />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{toAcc.name}</span>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="tr-amount">Сумма (₽)</Label>
                      <Input id="tr-amount" type="number" placeholder="0"
                        value={transfer.amount ?? ""}
                        onChange={e => setTransfer(t => ({ ...t, amount: Number(e.target.value) }))}
                        className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="tr-date">Дата</Label>
                      <Input id="tr-date" type="date"
                        value={transfer.date}
                        onChange={e => setTransfer(t => ({ ...t, date: e.target.value }))}
                        className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="tr-note">Комментарий <span className="text-muted-foreground font-normal">(необязательно)</span></Label>
                      <Input id="tr-note" placeholder="Например, пополнение копилки"
                        value={transfer.note ?? ""}
                        onChange={e => setTransfer(t => ({ ...t, note: e.target.value }))}
                        className="mt-1" />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
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
                        {mode === "expense" ? "Покупка в кредит — долг возрастёт" : "Погашение кредита — долг уменьшится"}
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
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Отмена</Button>
            <Button
              onClick={handleSubmit}
              data-testid="btn-submit-transaction"
              disabled={addMut.isPending || transferMut.isPending}
              className={mode === "transfer" ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {(addMut.isPending || transferMut.isPending)
                ? "Сохранение..."
                : mode === "transfer" ? "Перевести" : "Добавить"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
