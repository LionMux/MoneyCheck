import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Demo mode ───────────────────────────────────────────────────────────────────
if (import.meta.env.VITE_DEMO_MODE === "true") {
  import("./lib/demoStore").then(({ installDemoInterceptor }) => {
    installDemoInterceptor();
    mount();
  });
} else {
  mount();
}

function mount() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", prefersDark);

  createRoot(document.getElementById("root")!).render(<App />);

  // ── Service Worker ───────────────────────────────────────────────────────────────
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[SW] Registered:", reg.scope);

          // Слушаем сообщение SW_UPDATED — при новом деплое SW авто-перезагружает страницу
          navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data?.type === "SW_UPDATED") {
              console.log("[SW] New version detected — reloading");
              window.location.reload();
            }
          });
        })
        .catch((err) => console.warn("[SW] Registration failed:", err));
    });
  }
}
