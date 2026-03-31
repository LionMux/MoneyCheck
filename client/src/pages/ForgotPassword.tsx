/**
 * ForgotPassword page — 3-step password reset via 6-digit code.
 * Step 1: enter email → send code
 * Step 2: enter 6-digit code → verify (no DB password change yet)
 * Step 3: enter new password x2 → save (only here password changes)
 * Public route: accessible without authentication.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailCheck, ArrowLeft, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";

type Step = 1 | 2 | 3;

function PasswordInput({
  id, placeholder, value, onChange,
}: { id: string; placeholder: string; value: string; onChange: (v: string) => void }) {
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

function StrengthBar({ password }: { password: string }) {
  const score = (() => {
    if (!password) return 0;
    if (password.length < 6) return 1;
    let s = 1;
    if (password.length >= 10) s++;
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
          <div key={i} className={["h-1 flex-1 rounded-full transition-all duration-300", i <= score ? colors[score] : "bg-muted"].join(" ")} />
        ))}
      </div>
      <p className={["text-[11px] font-medium", score <= 1 ? "text-red-400" : score === 2 ? "text-orange-400" : score === 3 ? "text-yellow-400" : "text-emerald-400"].join(" ")}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const { toast } = useToast();

  const [step, setStep]               = useState<Step>(1);
  const [email, setEmail]             = useState("");
  const [code, setCode]               = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [done, setDone]               = useState(false);

  const mismatch   = confirmPw.length > 0 && newPassword !== confirmPw;
  const tooShort   = newPassword.length > 0 && newPassword.length < 6;
  const canSubmit3 = !loading && newPassword.length >= 6 && newPassword === confirmPw;

  // ── Step 1: send code ────────────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        toast({ title: "Слишком много попыток", description: "Попробуйте через 15 минут.", variant: "destructive" });
        return;
      }
      // Always advance to step 2 (OWASP anti-enumeration)
      setStep(2);
    } catch {
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify code ──────────────────────────────────────────────────
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Неверный или истёкший код");
        return;
      }
      setStep(3);
    } catch {
      setError("Нет связи с сервером. Проверьте интернет-соединение.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: reset password ───────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPw) { setError("Пароли не совпадают"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword, confirmPassword: confirmPw }),
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

  const stepTitles: Record<Step, string> = {
    1: "Восстановление пароля",
    2: "Введите код",
    3: "Новый пароль",
  };
  const stepDescriptions: Record<Step, string> = {
    1: "Введите email — мы отправим 6-значный код для сброса пароля",
    2: `Код отправлен на ${email}. Проверьте папку «Спам»`,
    3: "Придумайте надёжный пароль для вашего аккаунта",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>FinWise</h1>
            <p className="text-sm text-muted-foreground">Умные финансы и финансовая грамотность</p>
          </div>
        </div>

        {/* Step indicator */}
        {!done && (
          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as Step[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={["w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
                  s < step ? "bg-emerald-600 text-white" : s === step ? "bg-emerald-600 text-white ring-2 ring-emerald-400/40" : "bg-muted text-muted-foreground",
                ].join(" ")}>
                  {s < step ? "✓" : s}
                </div>
                {s < 3 && <div className={["w-8 h-0.5 rounded-full transition-all duration-300", s < step ? "bg-emerald-600" : "bg-muted"].join(" ")} />}
              </div>
            ))}
          </div>
        )}

        <Card className="border-border/60">
          <CardHeader className="pb-4">
            {done ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 mb-2">
                  <ShieldCheck size={24} className="text-emerald-400" />
                </div>
                <CardTitle className="tracking-tight">Пароль изменён</CardTitle>
                <CardDescription>Теперь вы можете войти с новым паролем</CardDescription>
              </>
            ) : (
              <>
                {step === 2 && (
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 mb-2">
                    <MailCheck size={24} className="text-emerald-400" />
                  </div>
                )}
                <CardTitle className="tracking-tight">{stepTitles[step]}</CardTitle>
                <CardDescription>{stepDescriptions[step]}</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {done ? (
              <Link href="/">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">Перейти ко входу</Button>
              </Link>
            ) : (
              <>
                {/* Error banner */}
                {error && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive mb-4">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* ── Step 1 ── */}
                {step === 1 && (
                  <form onSubmit={handleSendCode} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white" disabled={loading}>
                      {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Отправляем…</> : "Отправить код"}
                    </Button>
                  </form>
                )}

                {/* ── Step 2 ── */}
                {step === 2 && (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-code">6-значный код</Label>
                      <Input
                        id="reset-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        autoFocus
                        className="text-center text-2xl tracking-[0.5em] font-mono"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white" disabled={loading || code.length !== 6}>
                      {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Проверяем…</> : "Далее"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setStep(1); setCode(""); setError(null); }}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Ввести другой email
                    </button>
                  </form>
                )}

                {/* ── Step 3 ── */}
                {step === 3 && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">Новый пароль</Label>
                      <PasswordInput id="new-password" placeholder="Минимум 6 символов" value={newPassword} onChange={setNewPassword} />
                      <StrengthBar password={newPassword} />
                      {tooShort && <p className="text-[11px] text-destructive">Минимум 6 символов</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">Повторите пароль</Label>
                      <PasswordInput id="confirm-password" placeholder="Повторите новый пароль" value={confirmPw} onChange={setConfirmPw} />
                      {mismatch && <p className="text-[11px] text-destructive">Пароли не совпадают</p>}
                    </div>
                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white" disabled={!canSubmit3}>
                      {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Сохраняем…</> : "Сохранить новый пароль"}
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {!done && (
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              <ArrowLeft size={14} />
              Вернуться во вход
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
