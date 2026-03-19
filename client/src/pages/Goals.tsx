import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SavingsGoal, InsertSavingsGoal, Account } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Target, Shield, Plane, Laptop, Home, Car, GraduationCap, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

const ICONS: Record<string, React.ReactNode> = {
  Target: <Target size={20} />,
  Shield: <Shield size={20} />,
  Plane: <Plane size={20} />,
  Laptop: <Laptop size={20} />,
  Home: <Home size={20} />,
  Car: <Car size={20} />,
  GraduationCap: <GraduationCap size={20} />,
};

const PRESET_COLORS = ["#20808D", "#437A22", "#7A39BB", "#A84B2F", "#D19900", "#006494"];

export default function Goals() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositAccountId, setDepositAccountId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<InsertSavingsGoal>>({ color: PRESET_COLORS[0], icon: "Target" });

  const { data: goals = [] } = useQuery<SavingsGoal[]>({ queryKey: ["/api/goals"] });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });

  const addMut = useMutation({
    mutationFn: (data: InsertSavingsGoal) => apiRequest("POST", "/api/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setOpen(false);
      setForm({ color: PRESET_COLORS[0], icon: "Target" });
      toast({ title: "Цель создана" });
    },
  });

  const depositMut = useMutation({
    mutationFn: ({ id, amount, accountId }: { id: number; amount: number; accountId: number | null }) =>
      apiRequest("PATCH", `/api/goals/${id}/deposit`, { amount, accountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setDepositOpen(null);
      setDepositAmount("");
      setDepositAccountId(null);
      toast({ title: "Сумма добавлена к цели" });
    },
    onError: (error: any) => {
      const message = error?.message || "Не удалось пополнить цель";
      toast({ title: "Ошибка пополнения", description: message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/goals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] }),
  });

  const handleSubmit = () => {
    if (!form.title || !form.targetAmount) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    addMut.mutate({
      title: form.title,
      targetAmount: Number(form.targetAmount),
      currentAmount: 0,
      deadline: form.deadline ?? null,
      icon: form.icon ?? "Target",
      color: form.color ?? PRESET_COLORS[0],
      accountId: null,
    });
  };

  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-goals">Цели накоплений</h1>
          <p className="text-sm text-muted-foreground">Копи на то, что важно</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="btn-add-goal" size="sm" className="gap-2">
          <Plus size={16} /> Новая цель
        </Button>
      </div>

      {goals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Всего накоплено</span>
              <span className="text-sm font-semibold tabular-nums text-primary">{fmt(totalSaved)} / {fmt(totalTarget)}</span>
            </div>
            <Progress value={totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}% от общей суммы целей
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {goals.map(goal => {
          const pct = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
          const remaining = goal.targetAmount - goal.currentAmount;
          const daysLeft = goal.deadline ? differenceInDays(new Date(goal.deadline), new Date()) : null;
          const done = pct >= 100;
          const linkedAccount = goal.accountId ? accounts.find((a: any) => a.id === goal.accountId) : null;

          return (
            <Card key={goal.id} data-testid={`goal-card-${goal.id}`} className={cn(done && "border-primary/40")}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: goal.color + "22", color: goal.color }}>
                    {ICONS[goal.icon] ?? <Target size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm leading-none">{goal.title}</h3>
                        {linkedAccount && (
                          <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0">
                            <Wallet size={10} />
                            {(linkedAccount as any).name}
                          </Badge>
                        )}
                        {daysLeft !== null && (
                          <span className={cn("text-xs block", daysLeft < 14 ? "text-expense" : "text-muted-foreground")}>
                            {daysLeft > 0 ? `${daysLeft} дней осталось` : done ? "Цель достигнута!" : "Срок истёк"}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteMut.mutate(goal.id)}
                        data-testid={`btn-delete-goal-${goal.id}`}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5 flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={pct} className="flex-1 h-2.5" style={{ ["--progress-foreground" as string]: goal.color }} />
                      <span className="text-xs font-bold tabular-nums w-9 text-right" style={{ color: goal.color }}>{pct}%</span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground tabular-nums">{fmt(goal.currentAmount)}</span>
                        {" "}/ {fmt(goal.targetAmount)}
                      </div>
                      {!done && (
                        <span className="text-xs text-muted-foreground tabular-nums">осталось {fmt(remaining)}</span>
                      )}
                    </div>

                    {!done && (
                      <Button
                        variant="outline" size="sm" className="mt-3 h-7 text-xs"
                        onClick={() => setDepositOpen(goal.id)}
                        data-testid={`btn-deposit-${goal.id}`}
                      >
                        Пополнить
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {goals.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Target size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Пока нет целей. Создайте первую!</p>
          </div>
        )}
      </div>

      {/* Add Goal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Новая цель</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Название цели</Label>
              <Input data-testid="input-goal-title" placeholder="Например, Отпуск" value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Целевая сумма (₽)</Label>
              <Input data-testid="input-goal-target" type="number" placeholder="100000" value={form.targetAmount ?? ""} onChange={e => setForm(f => ({ ...f, targetAmount: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <Label>Срок (необязательно)</Label>
              <Input type="date" value={form.deadline ?? ""} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Иконка</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {Object.entries(ICONS).map(([key, icon]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, icon: key }))}
                    className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", form.icon === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Цвет</Label>
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} data-testid="btn-submit-goal" disabled={addMut.isPending}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog
        open={depositOpen !== null}
        onOpenChange={(open) => {
          if (!open) { setDepositOpen(null); setDepositAmount(""); setDepositAccountId(null); }
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Пополнить цель</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="deposit-account">Счёт (опционально)</Label>
              <Select
                value={depositAccountId ? String(depositAccountId) : "none"}
                onValueChange={v => setDepositAccountId(v === "none" ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Без списания со счёта" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без списания со счёта</SelectItem>
                  {(accounts as any[]).map((acc: any) => {
                    // Для всех типов счетов показываем реальный баланс
                    const displayInfo = `${acc.name} · ${fmt(acc.balance ?? 0)}`;
                    return <SelectItem key={acc.id} value={String(acc.id)}>{displayInfo}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deposit-amount">Сумма (₽)</Label>
              <Input
                id="deposit-amount"
                data-testid="input-deposit-amount"
                type="number"
                placeholder="5000"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDepositOpen(null); setDepositAmount(""); setDepositAccountId(null); }}>Отмена</Button>
            <Button
              onClick={() => {
                if (depositOpen && depositAmount) {
                  depositMut.mutate({ id: depositOpen, amount: Number(depositAmount), accountId: depositAccountId });
                }
              }}
              data-testid="btn-submit-deposit"
              disabled={depositMut.isPending}
            >
              Пополнить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
