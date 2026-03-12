import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Demo mode: install fetch interceptor BEFORE anything renders ────────────
// When built with VITE_DEMO_MODE=true, all /api/* calls are handled in-memory.
if (import.meta.env.VITE_DEMO_MODE === "true") {
  // Dynamic import to keep the interceptor out of normal production builds
  import("./lib/demoStore").then(({ installDemoInterceptor }) => {
    installDemoInterceptor();
    mount();
  });
} else {
  mount();
}

function mount() {
  // Theme init: default to system preference, no localStorage (sandboxed)
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", prefersDark);

  createRoot(document.getElementById("root")!).render(<App />);

  // Register Service Worker for PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[SW] Registered:", reg.scope))
        .catch((err) => console.warn("[SW] Registration failed:", err));
    });
  }
}
