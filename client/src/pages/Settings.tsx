import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Key, Plus, Trash2, Copy, Check, Info, ShieldCheck, Terminal, LayoutGrid,
  Smartphone, ArrowDownToLine, TrendingUp, TrendingDown, Zap, ChevronRight,
  Eye, EyeOff, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import CategoryManager from "@/components/CategoryManager";
import { cn } from "@/lib/utils";

interface PAT {
  id: number;
  name: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function isExpired(iso: string) {
  return new Date(iso) < new Date();
}

function ShortcutCard({
  type,
  onDownload,
}: {
  type: "rashod" | "dohod";
  onDownload: () => void;
}) {
  const isRashod = type === "rashod";

  return (
    <button
      onClick={onDownload}
      className={[
        "group relative w-full text-left rounded-2xl border overflow-hidden",
        "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        isRashod
          ? "border-red-500/20 bg-gradient-to-br from-red-950/40 via-card to-card hover:border-red-500/40 hover:shadow-red-900/20"
          : "border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-card to-card hover:border-emerald-500/40 hover:shadow-emerald-900/20",
      ].join(" ")}
    >
      <div
        className={[
          "absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-40",
          isRashod ? "bg-red-500" : "bg-emerald-500",
        ].join(" ")}
      />

      <div className="relative p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div
            className={[
              "w-11 h-11 rounded-xl flex items-center justify-center",
              isRashod ? "bg-red-500/15" : "bg-emerald-500/15",
            ].join(" ")}
          >
            {isRashod
              ? <TrendingDown size={20} className="text-red-400" />
              : <TrendingUp size={20} className="text-emerald-400" />
            }
          </div>
          <div
            className={[
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
              isRashod
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
            ].join(" ")}
          >
            <Zap size={9} />
            Shortcut
          </div>
        </div>

        <div>
          <p className="text-base font-semibold tracking-tight">
            {isRashod ? "Расход" : "Доход"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRashod
              ? "Быстро записать трату с экрана блокировки"
              : "Быстро записать доход без открытия приложения"
            }
          </p>
        </div>

        <div
          className={[
            "flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium transition-colors",
            isRashod
              ? "bg-red-500/20 text-red-300 group-hover:bg-red-500/30"
              : "bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500/30",
          ].join(" ")}
        >
          <ArrowDownToLine size={14} />
          Добавить команду
          <ChevronRight size={13} className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
}

// ── Display preferences section ──────────────────────────────────────────────
function DisplayPreferences() {
  const [showBalance, setShowBalance] = useState(() => {
    try { return localStorage.getItem("txShowBalance") === "1"; } catch { return false; }
  });

  const toggle = () => {
    const next = !showBalance;
    setShowBalance(next);
    try { localStorage.setItem("txShowBalance", next ? "1" : "0"); } catch { /* */ }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex gap-2.5 text-sm text-muted-foreground">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-primary" />
        <span>
          Настройте отображение данных в разделе «Операции».
        </span>
      </div>

      {/* Toggle card */}
      <button
        onClick={toggle}
        className={cn(
          "w-full flex items-center gap-4 rounded-xl border px-4 py-4 text-left",
          "transition-all duration-200 hover:bg-muted/40 active:scale-[0.99]",
          showBalance
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-card",
        )}
      >
        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
          showBalance ? "bg-primary/15" : "bg-muted",
        )}>
          <Wallet size={18} className={showBalance ? "text-primary" : "text-muted-foreground"} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">
            Остаток на счёте в Операциях
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Показывать баланс карты рядом с названием счёта в каждой операции и в фильтре счетов
          </p>
        </div>

        {/* Toggle pill */}
        <div className={cn(
          "relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200",
          showBalance ? "bg-primary" : "bg-muted-foreground/30",
        )}>
          <span className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            showBalance ? "translate-x-5" : "translate-x-0.5",
          )} />
        </div>
      </button>

      {/* Preview */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 pt-3 pb-1.5">Предпросмотр</p>
        <div className="px-4 pb-4 flex items-center gap-3">
          {/* Mocked transaction row */}
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <TrendingDown size={14} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Продукты</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md">Еда</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#20808D]" />
                Тинькофф
                {showBalance && (
                  <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted tabular-nums">
                    45 000 ₽
                  </span>
                )}
              </span>
            </div>
          </div>
          <span className="text-sm font-semibold text-red-500 tabular-nums">− 2 500 ₽</span>
        </div>

        {/* Account chip preview */}
        {showBalance && (
          <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-border pt-3">
            <p className="w-full text-[11px] text-muted-foreground mb-1">Фильтр счетов:</p>
            {[
              { name: "Тинькофф", color: "#20808D", balance: 45000 },
              { name: "Сбер", color: "#1DB954", balance: 12300 },
            ].map(acc => (
              <span key={acc.name} className="flex items-center gap-2 rounded-xl border border-transparent bg-muted/60 px-3 py-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                <span className="text-sm">{acc.name}</span>
                <span className="text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-full bg-muted-foreground/10 text-muted-foreground">
                  {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(acc.balance)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);

  const { data: tokens = [], isLoading } = useQuery<PAT[]>({
    queryKey: ["/api/pat"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/pat/create", { name: name || "API Token" });
      return res.json();
    },
    onSuccess: (data) => {
      setNewToken(data.token);
      setTokenName("");
      qc.invalidateQueries({ queryKey: ["/api/pat"] });
    },
    onError: () => toast({ title: "Ошибка создания токена", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pat/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Токен отозван" });
      qc.invalidateQueries({ queryKey: ["/api/pat"] });
    },
    onError: () => toast({ title: "Ошибка отзыва", variant: "destructive" }),
  });

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => createMutation.mutate(tokenName);
  const handleCloseNewToken = () => { setNewToken(null); setCreateOpen(false); };

  const handleDownloadShortcut = (type: "rashod" | "dohod") => {
    const filename = type === "rashod" ? "FinWiseRashod.shortcut" : "FinWiseDohod.shortcut";
    window.location.href = `/api/ios/shortcuts/${filename}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground text-sm mt-1">Управление аккаунтом и интеграциями</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList className="w-full">
          <TabsTrigger value="categories" className="flex-1 gap-2">
            <LayoutGrid size={15} />
            Категории
          </TabsTrigger>
          <TabsTrigger value="display" className="flex-1 gap-2">
            <Eye size={15} />
            Отображение
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex-1 gap-2">
            <Key size={15} />
            API-токены
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className="flex-1 gap-2">
            <Smartphone size={15} />
            Виджеты
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: CATEGORIES ── */}
        <TabsContent value="categories" className="mt-6 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex gap-2.5 text-sm text-muted-foreground">
            <Info size={15} className="mt-0.5 flex-shrink-0 text-primary" />
            <span>
              Зажмите значок ☰ и перетащите категорию, чтобы изменить порядок.{" "}
              На мобиле — смахните влево, чтобы удалить. Удалить можно любую категорию.
            </span>
          </div>
          <CategoryManager />
        </TabsContent>

        {/* ── TAB: DISPLAY ── */}
        <TabsContent value="display" className="mt-6">
          <DisplayPreferences />
        </TabsContent>

        {/* ── TAB: API TOKENS ── */}
        <TabsContent value="tokens" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex gap-2.5 text-sm text-muted-foreground flex-1 mr-3">
              <Info size={15} className="mt-0.5 flex-shrink-0 text-primary" />
              <span>
                Для авторизации в <strong>iOS Shortcuts</strong> и <strong>Scriptable</strong>.{" "}
                Заголовок: <code className="bg-muted px-1 rounded text-xs">Authorization: Bearer finwise_pat_xxx</code>
              </span>
            </div>
            <Button size="sm" onClick={() => { setCreateOpen(true); setNewToken(null); }} className="gap-1.5 flex-shrink-0">
              <Plus size={15} />
              Создать
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Загрузка…</div>
          ) : tokens.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center">
              <ShieldCheck size={32} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Токенов нет. Создайте первый для использования в Shortcuts.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((pat) => (
                <div
                  key={pat.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <Terminal size={15} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Создан {formatDate(pat.createdAt)}
                      {" \u00b7 "}
                      {isExpired(pat.expiresAt)
                        ? <span className="text-destructive">Истёк {formatDate(pat.expiresAt)}</span>
                        : <span>До {formatDate(pat.expiresAt)}</span>
                      }
                      {pat.lastUsedAt && <> · Исп. {formatDate(pat.lastUsedAt)}</>}
                    </p>
                  </div>
                  {isExpired(pat.expiresAt)
                    ? <Badge variant="destructive" className="text-[10px]">Истёк</Badge>
                    : <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40">Активен</Badge>
                  }
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => setRevokeId(pat.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: SHORTCUTS / ВИДЖЕТЫ ── */}
        <TabsContent value="shortcuts" className="mt-6 space-y-5">

          <div className="space-y-2">
            {[
              { n: "1", text: "Перейдите во вкладку «API-токены» и создайте токен", sub: "Нужен для авторизации в Shortcuts" },
              { n: "2", text: "Нажмите кнопку ниже с iPhone", sub: "iOS автоматически откроет приложение «Команды»" },
              { n: "3", text: "Вставьте токен в шорткат и добавьте на экран блокировки", sub: "Быстрый ввод расходов без открытия браузера" },
            ].map(({ n, text, sub }) => (
              <div key={n} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  {n}
                </span>
                <div>
                  <p className="text-sm font-medium leading-tight">{text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ShortcutCard type="rashod" onDownload={() => handleDownloadShortcut("rashod")} />
            <ShortcutCard type="dohod" onDownload={() => handleDownloadShortcut("dohod")} />
          </div>

        </TabsContent>
      </Tabs>

      {/* DIALOG: CREATE TOKEN */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) handleCloseNewToken(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать API-токен</DialogTitle>
            <DialogDescription>
              Токен будет показан <strong>один раз</strong> — сохраните его сразу.
            </DialogDescription>
          </DialogHeader>
          {!newToken ? (
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Название токена</label>
                <Input
                  placeholder="iOS Shortcuts, Scriptable Widget…"
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Создаётся…" : "Создать"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-2">
                  ✅ Токен создан — скопируйте его сейчас.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-2 break-all select-all font-mono">
                    {newToken}
                  </code>
                  <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0" onClick={() => copyToken(newToken)}>
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Вставьте токен в переменную <code className="bg-muted px-1 rounded">PAT</code> вашего Shortcut.
              </p>
              <Button className="w-full" onClick={handleCloseNewToken}>Готово</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ALERT: REVOKE */}
      <AlertDialog open={revokeId !== null} onOpenChange={(o) => { if (!o) setRevokeId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отозвать токен?</AlertDialogTitle>
            <AlertDialogDescription>
              Токен перестанет работать немедленно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (revokeId) revokeMutation.mutate(revokeId); setRevokeId(null); }}
            >
              Отозвать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
