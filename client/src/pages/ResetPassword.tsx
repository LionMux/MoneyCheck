/**
 * ResetPassword page — user sets a new password via token from email link.
 * Public route: accessible without authentication.
 * Token is read from ?token= query param (hash-based routing).
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";

function PasswordInput({
  id,
  placeholder,
  value,
  onChange,
  testId,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="pr-10"
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? "Скрыть пароль" : "Показать пароль"}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

/** Strength bar: 0–4 segments */
function StrengthBar({ password }: { password: string }) {
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)  s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const colors = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"];
  const labels = ["", "Очень слабый", "Слабый", "Хороший", "Надёжный"];

  if (!password) return null;
  return (
    <div className="space-y-1.5 mt-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={[
              "h-1 flex-1 rounded-full transition-all duration-300",
              i <= score ? colors[score] : "bg-muted",
            ].join(" ")}
          />
        ))}
      </div>
      <p className={[
        "text-[11px] font-medium transition-colors",
        score <= 1 ? "text-red-400" : score === 2 ? "text-orange-400" : score === 3 ? "text-yellow-400" : "text-emerald-400",
      ].join(" ")}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [location] = useLocation();

  // Extract token from query string (?token=xxx) in hash routing
  const token = new URLSearchParams(location.split("?")[1] ?? "").get("token") ?? "";

  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [done, setDone]                       = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (!token) {
      setError("Ссылка для сброса недействительна. Запросите новую.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Неизвестная ошибка");
        return;
      }

      setDone(true);
    } catch {
      setError("Нет связи с сервером. Проверьте интернет-соединение.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-emerald-500/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-900/30">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="FinWise logo">
              <path d="M8 22V16M12 22V12M16 22V8M20 22V14M24 22V18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              FinWise
            </h1>
            <p className="text-sm text-muted-foreground">Умные финансы и финансовая грамотность</p>
          </div>
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-4">
            {!done ? (
              <>
                <CardTitle className="tracking-tight">Новый пароль</CardTitle>
                <CardDescription>Придумайте надёжный пароль для вашего аккаунта</CardDescription>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 mb-2">
                  <ShieldCheck size={24} className="text-emerald-400" />
                </div>
                <CardTitle className="tracking-tight">Пароль изменён</CardTitle>
                <CardDescription>
                  Теперь вы можете войти с новым паролем
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {!done ? (
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Error banner */}
                {error && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* No token warning */}
                {!token && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3.5 py-3 text-sm text-orange-400">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    <span>Ссылка недействительна. Запросите ссылку сброса повторно.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Новый пароль</Label>
                  <PasswordInput
                    id="new-password"
                    placeholder="Минимум 8 символов"
                    value={newPassword}
                    onChange={setNewPassword}
                    testId="input-new-password"
                  />
                  <StrengthBar password={newPassword} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Повторите пароль</Label>
                  <PasswordInput
                    id="confirm-password"
                    placeholder="Повторите новый пароль"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    testId="input-confirm-password"
                  />
                  {mismatch && (
                    <p className="text-[11px] text-destructive mt-1">Пароли не совпадают</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30 transition-all duration-150"
                  disabled={loading || !token || mismatch}
                  data-testid="btn-reset-submit"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin mr-2" /> Сохраняем…</>
                    : "Сохранить новый пароль"
                  }
                </Button>
              </form>
            ) : (
              <Link href="/">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30 transition-all duration-150"
                >
                  Перейти ко входу
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Back link — only shown before success */}
        {!done && (
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <ArrowLeft size={14} />
              Вернуться во вход
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
