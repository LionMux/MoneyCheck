/**
 * ForgotPassword page — user enters email to receive a reset link.
 * Public route: accessible without authentication.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailCheck, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show success to prevent email enumeration (OWASP)
      if (res.ok || res.status === 429) {
        if (res.status === 429) {
          toast({
            title: "Слишком много попыток",
            description: "Попробуйте через 15 минут.",
            variant: "destructive",
          });
          return;
        }
        setSent(true);
      }
    } catch {
      // Network error — still show success (don't leak info)
      setSent(true);
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

            {!sent ? (
              <>
                <CardTitle className="tracking-tight">Восстановление пароля</CardTitle>
                <CardDescription>
                  Введите email — мы отправим ссылку для сброса пароля
                </CardDescription>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 mb-2">
                  <MailCheck size={24} className="text-emerald-400" />
                </div>
                <CardTitle className="tracking-tight">Письмо отправлено</CardTitle>
                <CardDescription>
                  Если аккаунт с адресом <span className="text-foreground font-medium">{email}</span> существует,
                  {" "}вы получите ссылку в течение нескольких минут.
                  {" "}Проверьте папку «Спам».
                </CardDescription>
              </>
            )}

          </CardHeader>

          <CardContent>
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    data-testid="input-forgot-email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30 transition-all duration-150"
                  disabled={loading}
                  data-testid="btn-forgot-submit"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin mr-2" /> Отправляем…</>
                    : "Отправить ссылку"
                  }
                </Button>
              </form>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Отправить ещё раз
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <ArrowLeft size={14} />
            Вернуться во вход
          </Link>
        </div>

      </div>
    </div>
  );
}
