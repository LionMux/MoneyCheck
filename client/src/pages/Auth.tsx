/**
 * Auth page — Login and Register tabs.
 * Shown when the app is in PG mode and user is not logged in.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();

  // Login state
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading]   = useState(false);

  // Register state
  const [regName, setRegName]         = useState("");
  const [regEmail, setRegEmail]       = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      toast({ title: "Ошибка входа", description: err.message, variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 8) {
      toast({ title: "Слабый пароль", description: "Минимум 8 символов", variant: "destructive" });
      return;
    }
    setRegLoading(true);
    try {
      await register(regEmail, regName, regPassword);
    } catch (err: any) {
      toast({ title: "Ошибка регистрации", description: err.message, variant: "destructive" });
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Ambient glow — subtle background accent */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-emerald-500/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-6">

        {/* Logo header */}
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

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
          </TabsList>

          {/* ── Login Tab ── */}
          <TabsContent value="login">
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="tracking-tight">Добро пожаловать</CardTitle>
                <CardDescription>Войдите в свой аккаунт</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">

                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      data-testid="input-login-email"
                    />
                  </div>

                  <div className="space-y-1.5">
                    {/* Label row with "Forgot password?" on the right */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Пароль</Label>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-emerald-400 transition-colors duration-150"
                      >
                        Забыли пароль?
                      </Link>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Ваш пароль"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      data-testid="input-login-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30 transition-all duration-150"
                    disabled={loginLoading}
                    data-testid="btn-login-submit"
                  >
                    {loginLoading
                      ? <><Loader2 size={16} className="animate-spin mr-2" /> Вход…</>
                      : "Войти"
                    }
                  </Button>

                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Register Tab ── */}
          <TabsContent value="register">
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="tracking-tight">Создать аккаунт</CardTitle>
                <CardDescription>Начните управлять финансами</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">Имя</Label>
                    <Input
                      id="reg-name"
                      placeholder="Иван Иванов"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      data-testid="input-reg-name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      data-testid="input-reg-email"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Пароль</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Минимум 8 символов"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      data-testid="input-reg-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30 transition-all duration-150"
                    disabled={regLoading}
                    data-testid="btn-register-submit"
                  >
                    {regLoading
                      ? <><Loader2 size={16} className="animate-spin mr-2" /> Создаю…</>
                      : "Создать аккаунт"
                    }
                  </Button>

                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
