import { useEffect, useState } from "react";
import { Copy, Check, Smartphone, Monitor, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * /widget-auth — универсальная страница авторизации внешних клиентов
 *
 * Определяет устройство и выбирает стратегию:
 *
 * ┌─────────────────────────────────────────────────────┐
 * │ iPhone / iPad  → создаёт PAT → редирект в Shortcuts │
 * │                  shortcuts://run-shortcut            │
 * │                  ?name=FinWise&input=text            │
 * │                  &text=finwise_pat_xxx               │
 * ├─────────────────────────────────────────────────────┤
 * │ Всё остальное  → создаёт PAT → показывает токен     │
 * │ (Mac, Android) с кнопкой «Скопировать»              │
 * └─────────────────────────────────────────────────────┘
 *
 * Для Scriptable (отдельный флоу) — параметр ?client=scriptable
 * использует старый одноразовый code через /api/widget/auth/issue
 */

type Strategy = "shortcuts" | "manual";
type Status = "idle" | "loading" | "success" | "error";
type Client = "shortcuts" | "scriptable" | "unknown";

function detectStrategy(): Strategy {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  return isIOS ? "shortcuts" : "manual";
}

function detectClient(): Client {
  const params = new URLSearchParams(window.location.search);
  const c = params.get("client");
  if (c === "scriptable") return "scriptable";
  if (c === "shortcuts") return "shortcuts";
  return "unknown";
}

export default function WidgetAuthPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("manual");
  const [client] = useState<Client>(detectClient);
  const [token, setToken] = useState("");
  const [code, setCode] = useState(""); // только для Scriptable
  const [copied, setCopied] = useState(false);

  // ─── SCRIPTABLE FLOW (старый, через одноразовый code) ───────────────────
  async function issueScriptableCode() {
    setStatus("loading");
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        setStatus("error");
        setMessage("Вы не авторизованы. Войдите в FinWise и попробуйте снова.");
        return;
      }
      const issueRes = await fetch("/api/widget/auth/issue", {
        method: "POST",
        credentials: "include",
      });
      if (!issueRes.ok) {
        const err = await issueRes.json();
        setStatus("error");
        setMessage(err.error || "Ошибка сервера");
        return;
      }
      const { code: newCode } = await issueRes.json();
      setCode(newCode);
      setStatus("success");
      setMessage("Код получен! Переходим в Scriptable…");
      setTimeout(() => {
        window.location.href = `scriptable:///run?scriptName=FinWise&code=${newCode}`;
      }, 800);
    } catch {
      setStatus("error");
      setMessage("Не удалось подключиться к серверу.");
    }
  }

  // ─── PAT FLOW (Shortcuts + manual) ──────────────────────────────────────
  async function issuePAT(strat: Strategy) {
    setStatus("loading");
    try {
      // 1. Проверяем авторизацию
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        setStatus("error");
        setMessage("Вы не авторизованы. Сначала откройте FinWise в браузере, войдите в аккаунт и вернитесь.");
        return;
      }

      // 2. Создаём PAT
      const patRes = await fetch("/api/pat/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: strat === "shortcuts" ? "iOS Shortcuts" : "Widget Auth" }),
      });
      if (!patRes.ok) {
        const err = await patRes.json();
        setStatus("error");
        setMessage(err.error || "Ошибка создания токена");
        return;
      }
      const { token: newToken } = await patRes.json();
      setToken(newToken);
      setStatus("success");

      // 3a. iOS → авто-редирект в Shortcuts
      // Используем shortcuts://run-shortcut?name=...&input=text&text=TOKEN
      // (единственный способ передать данные в шорткат через URL на iOS)
      if (strat === "shortcuts") {
        setMessage("Токен создан! Передаём в Shortcuts…");
        const deeplink =
          `shortcuts://run-shortcut?name=FinWise` +
          `&input=text` +
          `&text=${encodeURIComponent(newToken)}`;
        setTimeout(() => {
          window.location.href = deeplink;
        }, 600);
      } else {
        // 3b. Всё остальное → показываем токен
        setMessage("Скопируйте токен и вставьте его в переменную PAT вашего Shortcut.");
      }
    } catch {
      setStatus("error");
      setMessage("Не удалось подключиться к серверу.");
    }
  }

  const copyToken = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Запускаем при монтировании
  useEffect(() => {
    if (client === "scriptable") {
      issueScriptableCode();
      return;
    }
    const strat = detectStrategy();
    setStrategy(strat);
    issuePAT(strat);
  }, []);

  // ─── UI ─────────────────────────────────────────────────────────────────

  const isScriptable = client === "scriptable";

  const icon =
    status === "loading" ? "⏳"
    : status === "error"   ? "❌"
    : isScriptable        ? "📱"
    : strategy === "shortcuts" ? "🔗"
    : "💾";

  const title =
    status === "loading" ? "Подключение…"
    : status === "error"   ? "Ошибка"
    : status === "success" && strategy === "shortcuts" && !isScriptable
      ? "Переходим в Shortcuts"
    : status === "success" && !isScriptable
      ? "Токен готов"
    : status === "success"
      ? "Готово!"
    : "Подключить";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full space-y-6">

        {/* Логотип */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="hsl(158 64% 32%)" />
              <path d="M8 22V12M12 22V16M16 22V8M20 22V14M24 22V18"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="font-bold text-xl">FinWise</span>
          </div>
        </div>

        {/* Карточка */}
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
          <div className="text-5xl">{icon}</div>

          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {message && (
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{message}</p>
            )}
          </div>

          {/* Спиннер */}
          {status === "loading" && (
            <div className="flex justify-center pt-1">
              <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* iOS Shortcuts — кнопка редиректа + fallback копирование */}
          {status === "success" && strategy === "shortcuts" && !isScriptable && token && (
            <div className="space-y-3 pt-1">
              <a
                href={
                  `shortcuts://run-shortcut?name=FinWise` +
                  `&input=text` +
                  `&text=${encodeURIComponent(token)}`
                }
                className="flex items-center justify-center gap-2 w-full py-3 px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <ExternalLink size={15} />
                Открыть Shortcuts
              </a>
              {/* Fallback: скопировать если Shortcuts не открылся */}
              <button
                onClick={copyToken}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? "Скопировано" : "Скопировать токен"}
              </button>
            </div>
          )}

          {/* Mac / Android — показываем токен с кнопкой копирования */}
          {status === "success" && strategy === "manual" && !isScriptable && token && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <code className="flex-1 text-xs font-mono break-all text-left select-all">
                  {token}
                </code>
                <button
                  onClick={copyToken}
                  className="flex-shrink-0 p-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  {copied
                    ? <Check size={14} className="text-emerald-500" />
                    : <Copy size={14} className="text-muted-foreground" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Вставьте токен в переменную <code className="bg-muted px-1 rounded">PAT</code> вашего Shortcut.
              </p>
            </div>
          )}

          {/* Scriptable success */}
          {status === "success" && isScriptable && code && (
            <div className="space-y-3 pt-1">
              <p className="text-sm text-muted-foreground">
                Если Scriptable не открылся автоматически — нажмите кнопку ниже
              </p>
              <a
                href={`scriptable:///run?scriptName=FinWise&code=${code}`}
                className="flex items-center justify-center gap-2 w-full py-3 px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <Smartphone size={15} />
                Открыть Scriptable
              </a>
            </div>
          )}

          {/* Ошибка */}
          {status === "error" && (
            <Button
              className="w-full"
              onClick={() => {
                if (client === "scriptable") issueScriptableCode();
                else issuePAT(strategy);
              }}
            >
              Попробовать снова
            </Button>
          )}
        </div>

        {/* Подпись устройства */}
        {status !== "loading" && status !== "error" && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {strategy === "shortcuts" && !isScriptable
              ? <><Smartphone size={12} /> iOS Shortcuts</>
              : isScriptable
              ? <><Smartphone size={12} /> Scriptable</>
              : <><Monitor size={12} /> Мануальный режим</>
            }
          </div>
        )}
      </div>
    </div>
  );
}
