import { useEffect, useState } from "react";

/**
 * /widget-auth — страница авторизации iOS-виджета (Scriptable)
 *
 * Flow:
 * 1. Пользователь уже залогинен в браузере (cookie finwise_token)
 * 2. Эта страница вызывает POST /api/widget/auth/issue
 * 3. Сервер создаёт одноразовый code (TTL 5 минут) и возвращает его
 * 4. Страница делает deeplink: scriptable://run?scriptName=FinWise&code=XXX
 * 5. Scriptable перехватывает code, обменивает на Bearer-токен
 */
export default function WidgetAuthPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");

  async function issueCode() {
    setStatus("loading");
    try {
      // Проверяем, авторизован ли пользователь
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        setStatus("error");
        setMessage("Вы не авторизованы. Войдите в FinWise и попробуйте снова.");
        return;
      }

      // Запрашиваем одноразовый code
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
      setMessage("Код получен! Переходим в Scriptable...");

      // Deeplink в Scriptable — передаём code как query-параметр
      // Scriptable должен называться "FinWise" (регистр важен)
      const deeplink = `scriptable:///run?scriptName=FinWise&code=${newCode}`;
      setTimeout(() => {
        window.location.href = deeplink;
      }, 800);
    } catch (e) {
      setStatus("error");
      setMessage("Не удалось подключиться к серверу.");
    }
  }

  // Автоматически запускаем при открытии страницы
  useEffect(() => {
    issueCode();
  }, []);

  const icon =
    status === "loading" ? "⏳"
    : status === "success" ? "✅"
    : status === "error"   ? "❌"
    : "📱";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-6">

        {/* Иконка */}
        <div className="text-6xl">{icon}</div>

        {/* Заголовок */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {status === "loading" && "Подключение виджета..."}
            {status === "success" && "Готово!"}
            {status === "error"   && "Ошибка"}
            {status === "idle"    && "Подключить виджет"}
          </h1>
          {message && (
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          )}
        </div>

        {/* Спиннер при загрузке */}
        {status === "loading" && (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* При успехе — показываем code и кнопку ручного перехода */}
        {status === "success" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Если Scriptable не открылся автоматически — нажмите кнопку ниже
            </p>
            <a
              href={`scriptable:///run?scriptName=FinWise&code=${code}`}
              className="inline-block w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
            >
              Открыть Scriptable
            </a>
          </div>
        )}

        {/* При ошибке — кнопка повтора */}
        {status === "error" && (
          <button
            onClick={issueCode}
            className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
          >
            Попробовать снова
          </button>
        )}

        {/* Подсказка */}
        <p className="text-xs text-muted-foreground">
          Эта страница подключает iOS-виджет FinWise через приложение Scriptable.
          Код действителен 5 минут.
        </p>
      </div>
    </div>
  );
}
