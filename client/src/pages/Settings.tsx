import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Key, Plus, Trash2, Copy, Check, Info, ShieldCheck, Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface PAT {
  id: number;
  name: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function isExpired(iso: string) {
  return new Date(iso) < new Date();
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

  const handleCreate = () => {
    createMutation.mutate(tokenName);
  };

  const handleCloseNewToken = () => {
    setNewToken(null);
    setCreateOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground text-sm mt-1">Управление аккаунтом и интеграциями</p>
      </div>

      {/* PAT SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-primary" />
            <h2 className="text-base font-semibold">API-токены (PAT)</h2>
          </div>
          <Button
            size="sm"
            onClick={() => { setCreateOpen(true); setNewToken(null); }}
            className="gap-1.5"
          >
            <Plus size={15} />
            Создать токен
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex gap-2.5 text-sm text-muted-foreground">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-primary" />
          <span>
            Токены используются для авторизации в <strong>iOS Shortcuts</strong> и <strong>Scriptable</strong>.
            Заголовок запроса: <code className="bg-muted px-1 rounded text-xs">Authorization: Bearer finwise_pat_xxx</code>
          </span>
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
                    {" · "}
                    {isExpired(pat.expiresAt)
                      ? <span className="text-destructive">Истёк {formatDate(pat.expiresAt)}</span>
                      : <span>До {formatDate(pat.expiresAt)}</span>
                    }
                    {pat.lastUsedAt && (
                      <> · Исп. {formatDate(pat.lastUsedAt)}</>
                    )}
                  </p>
                </div>
                {isExpired(pat.expiresAt)
                  ? <Badge variant="destructive" className="text-[10px]">Истёк</Badge>
                  : <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40">Активен</Badge>
                }
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  onClick={() => setRevokeId(pat.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DIALOG: CREATE TOKEN */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) handleCloseNewToken(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать API-токен</DialogTitle>
            <DialogDescription>
              Токен будет показан <strong>один раз</strong> — сохраните его в Shortcuts сразу после создания.
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
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Создаётся…" : "Создать"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-2">
                  ✅ Токен создан — скопируйте его сейчас. Повторно он не будет показан.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-2 break-all select-all font-mono">
                    {newToken}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => copyToken(newToken)}
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Вставьте этот токен в переменную <code className="bg-muted px-1 rounded">PAT</code> вашего Shortcut.
              </p>
              <Button className="w-full" onClick={handleCloseNewToken}>
                Готово
              </Button>
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
              Токен перестанет работать немедленно. Shortcuts и виджеты, использующие его, перестанут получать данные.
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
