/**
 * Accounts page — manage debit, credit and cash accounts.
 * Shows credit card debt tracking for credit accounts.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  CreditCard, Wallet, Banknote, Plus, Pencil, Archive,
  TrendingDown, AlertCircle, CheckCircle
} from "lucide-react";

const ACCOUNT_TYPES = [
  { value: "debit",  label: "Дебетовая",  icon: CreditCard, color: "bg-blue-500" },
  { value: "credit", label: "Кредитная",  icon: CreditCard, color: "bg-orange-500" },
  { value: "cash",   label: "Наличные",   icon: Banknote,   color: "bg-emerald-500" },
  { value: "other",  label: "Другое",     icon: Wallet,     color: "bg-purple-500" },
] as const;

// Доступные цвета карты — добавлен чёрный (#1a1a1a)
const CARD_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#1a1a1a"];

type AccountType = typeof ACCOUNT_TYPES[number]["value"];

function AccountTypeBadge({ type }: { type: string }) {
  const config = ACCOUNT_TYPES.find(t => t.value === type);
  return <Badge variant="outline" className="text-xs">{config?.label ?? type}</Badge>;
}

function formatCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

// ── Add/Edit Account Dialog ────────────────────────────────────────────────

interface AccountFormProps {
  initial?: Account;
  onDone: () => void;
}

function AccountForm({ initial, onDone }: AccountFormProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AccountType>((initial?.type as AccountType) ?? "debit");
  const [currency, setCurrency] = useState(initial?.currency ?? "RUB");
  const [balance, setBalance] = useState(initial ? String(initial.initialBalance) : "0");
  const [creditLimit, setCreditLimit] = useState(initial?.creditLimit ? String(initial.creditLimit) : "");
  const [color, setColor] = useState(initial?.color ?? "#10b981");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name,
        type,
        currency,
        initialBalance: parseFloat(balance) || 0,
        creditLimit: type === "credit" && creditLimit ? parseFloat(creditLimit) : null,
        color,
      };
      if (initial) {
        await apiRequest("PATCH", `/api/accounts/${initial.id}`, payload);
        toast({ title: "Счёт обновлён" });
      } else {
        await apiRequest("POST", "/api/accounts", payload);
        toast({ title: "Счёт создан" });
      }
      qc.invalidateQueries({ queryKey: ["/api/accounts"] });
      onDone();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Название счёта</Label>
        <Input
          placeholder="Например: Сбербанк Дебетовая"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          data-testid="input-account-name"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Тип счёта</Label>
        <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
          <SelectTrigger data-testid="select-account-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{type === "credit" ? "Остаток на карте (₽)" : "Баланс (₽)"}</Label>
          <Input
            type="number"
            step="0.01"
            value={balance}
            onChange={e => setBalance(e.target.value)}
            data-testid="input-account-balance"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Валюта</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RUB">RUB ₽</SelectItem>
              <SelectItem value="USD">USD $</SelectItem>
              <SelectItem value="EUR">EUR €</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {type === "credit" && (
        <div className="space-y-1.5">
          <Label>Кредитный лимит (₽)</Label>
          <Input
            type="number"
            step="100"
            placeholder="100000"
            value={creditLimit}
            onChange={e => setCreditLimit(e.target.value)}
            data-testid="input-credit-limit"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Цвет карты</Label>
        <div className="flex gap-2 flex-wrap">
          {CARD_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                color === c
                  ? "border-foreground scale-110 ring-2 ring-offset-1 ring-foreground"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading} data-testid="btn-account-save">
        {loading ? "Сохраняем..." : initial ? "Сохранить изменения" : "Добавить счёт"}
      </Button>
    </form>
  );
}

// ── Credit Card Detail Card ────────────────────────────────────────────────

function CreditCardDetail({ account }: { account: Account }) {
  const limit = account.creditLimit ? parseFloat(String(account.creditLimit)) : null;
  const remaining = parseFloat(String(account.initialBalance ?? 0));
  const debt = limit !== null ? Math.max(limit - remaining, 0) : 0;
  const available = limit !== null ? remaining : null;
  const usedPct = limit ? Math.min((debt / limit) * 100, 100) : 0;

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-xl space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Кредитная карта
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Долг</div>
          <div className={`font-bold ${debt > 0 ? "text-red-500" : "text-emerald-500"}`}>
            {formatCurrency(debt)}
          </div>
        </div>
        {limit && (
          <>
            <div>
              <div className="text-muted-foreground text-xs">Лимит</div>
              <div className="font-bold">{formatCurrency(limit)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Доступно</div>
              <div className="font-bold text-emerald-500">{formatCurrency(available!)}</div>
            </div>
          </>
        )}
      </div>
      {limit && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Использовано</span>
            <span>{Math.round(usedPct)}%</span>
          </div>
          <Progress value={usedPct} className={`h-2 ${usedPct > 80 ? "[&>div]:bg-red-500" : usedPct > 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`} />
        </div>
      )}
      {debt > 0 ? (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle size={12} />
          Оплатите задолженность до даты платежа
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle size={12} />
          Задолженностей нет
        </div>
      )}
    </div>
  );
}

// ── Account Card ───────────────────────────────────────────────────────────

function AccountCard({ account }: { account: Account }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/accounts/${account.id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Счёт архивирован" });
    },
  });

  const balance = parseFloat(String((account as any).balance ?? account.initialBalance));

  return (
    <Card data-testid={`card-account-${account.id}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: account.color ?? "#10b981" }}
            >
              {account.type === "cash" ? (
                <Banknote size={18} className="text-white" />
              ) : (
                <CreditCard size={18} className="text-white" />
              )}
            </div>
            <div>
              <div className="font-semibold">{account.name}</div>
              <AccountTypeBadge type={account.type} />
            </div>
          </div>

          <div className="text-right">
            <div className={`text-lg font-bold ${balance < 0 ? "text-red-500" : "text-foreground"}`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-xs text-muted-foreground">{account.currency}</div>
          </div>
        </div>

        {account.type === "credit" && <CreditCardDetail account={account} />}

        <div className="flex gap-2 mt-3">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid={`btn-edit-account-${account.id}`}>
                <Pencil size={13} />
                Изменить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Редактировать счёт</DialogTitle>
              </DialogHeader>
              <AccountForm initial={account} onDone={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            data-testid={`btn-archive-account-${account.id}`}
          >
            <Archive size={13} />
            Архив
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Summary Bar ────────────────────────────────────────────────────────────

function AccountsSummary({ accounts }: { accounts: Account[] }) {
  const active = accounts.filter(a => !a.isArchived);

  const totalBalance = active
    .filter(a => a.type === "debit" || a.type === "cash" || a.type === "other")
    .reduce((s, a) => s + parseFloat(String((a as any).balance ?? a.initialBalance)), 0);

  const totalDebt = active
    .filter(a => a.type === "credit")
    .reduce((s, a) => {
      const limit = a.creditLimit ? parseFloat(String(a.creditLimit)) : 0;
      const remaining = parseFloat(String(a.initialBalance ?? 0));
      return s + Math.max(limit - remaining, 0);
    }, 0);

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {[
        { label: "Общий баланс", value: totalBalance, color: totalBalance >= 0 ? "text-emerald-500" : "text-red-500" },
        { label: "Кредитный долг", value: totalDebt, color: totalDebt > 0 ? "text-red-500" : "text-emerald-500" },
      ].map(item => (
        <Card key={item.label} data-testid={`summary-${item.label}`}>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
            <div className={`text-xl font-bold ${item.color}`}>{formatCurrency(item.value)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const active = accounts.filter(a => !a.isArchived);
  const archived = accounts.filter(a => a.isArchived);
  const byType = (type: string) => active.filter(a => a.type === type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Мои счета</h1>
          <p className="text-sm text-muted-foreground">{active.length} активных счётов</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="btn-add-account">
              <Plus size={16} />
              Добавить счёт
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Новый счёт</DialogTitle></DialogHeader>
            <AccountForm onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {active.length > 0 && <AccountsSummary accounts={accounts} />}

      {isLoading && (
        <div className="grid gap-4">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="pt-4"><div className="h-16 bg-muted animate-pulse rounded-lg" /></CardContent></Card>
          ))}
        </div>
      )}

      {!isLoading && active.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet size={40} className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Нет счётов</h3>
            <p className="text-sm text-muted-foreground mb-4">Добавьте дебетовую карту, кредитную карту или кошелёк с наличными</p>
            <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus size={16} />Добавить первый счёт</Button>
          </CardContent>
        </Card>
      )}

      {byType("debit").length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Дебетовые карты</h2>
          <div className="grid gap-3">{byType("debit").map(a => <AccountCard key={a.id} account={a} />)}</div>
        </section>
      )}

      {byType("credit").length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Кредитные карты</h2>
          <div className="grid gap-3">{byType("credit").map(a => <AccountCard key={a.id} account={a} />)}</div>
        </section>
      )}

      {byType("cash").length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Наличные</h2>
          <div className="grid gap-3">{byType("cash").map(a => <AccountCard key={a.id} account={a} />)}</div>
        </section>
      )}

      {byType("other").length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Другие счета</h2>
          <div className="grid gap-3">{byType("other").map(a => <AccountCard key={a.id} account={a} />)}</div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Архив ({archived.length})</h2>
          <div className="grid gap-3 opacity-60">{archived.map(a => <AccountCard key={a.id} account={a} />)}</div>
        </section>
      )}
    </div>
  );
}
