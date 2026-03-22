/**
 * FinWise Windows Widget — Electron
 *
 * Compact always-on-top window that shows balance summary.
 * Supports:
 *  - Persistent config via electron-store (backendUrl, authToken)
 *  - In-widget login screen (POST /api/auth/login)
 *  - Settings screen (change server URL, test connection)
 *  - Auto-polling every 60s
 *  - System tray with show/hide/quit
 *
 * USAGE (dev):
 *   npm install
 *   npm start
 *
 * BUILD installer:
 *   npm run build
 *   -> dist/FinWise Widget Setup.exe
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, shell } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");

// ── Config store (electron-store) ────────────────────────────────────────────
// Lazy-load to avoid issues if not installed in dev without npm install
let store = null;
function getStore() {
  if (!store) {
    try {
      const Store = require("electron-store");
      store = new Store({
        defaults: {
          backendUrl: process.env.FINWISE_API ?? "http://localhost:5000",
          authToken: "",
          windowX: null,
          windowY: null,
        },
      });
    } catch {
      // fallback: in-memory store if electron-store not installed
      const defaults = {
        backendUrl: process.env.FINWISE_API ?? "http://localhost:5000",
        authToken: "",
        windowX: null,
        windowY: null,
      };
      store = {
        get: (k) => defaults[k],
        set: (k, v) => { defaults[k] = v; },
      };
    }
  }
  return store;
}

let tray = null;
let widgetWindow = null;
let pollingInterval = null;

// ── Helper: fetch JSON from API ──────────────────────────────────────────────
function fetchJson(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith("https") ? https : http;
    const headers = { "Accept": "application/json", ...options.headers };
    const req = mod.get(urlStr, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 401) {
          reject(new Error("UNAUTHORIZED"));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(7000, () => req.destroy());
  });
}

// ── Helper: POST JSON ────────────────────────────────────────────────────────
function postJson(urlStr, body) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith("https") ? https : http;
    const data = JSON.stringify(body);
    const urlObj = new URL(urlStr);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlStr.startsWith("https") ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = mod.request(options, (res) => {
      let resp = "";
      res.on("data", (chunk) => (resp += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(resp);
          if (res.statusCode >= 400) reject(new Error(parsed.error || "Login failed"));
          else resolve({ body: parsed, headers: res.headers });
        } catch {
          reject(new Error("Invalid JSON response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(7000, () => req.destroy());
    req.write(data);
    req.end();
  });
}

// ── Create widget window ──────────────────────────────────────────────────────
function createWidgetWindow() {
  const cfg = getStore();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const savedX = cfg.get("windowX");
  const savedY = cfg.get("windowY");

  widgetWindow = new BrowserWindow({
    width: 320,
    height: 260,
    x: savedX ?? width - 340,
    y: savedY ?? height - 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  widgetWindow.loadFile(path.join(__dirname, "widget.html"));

  // Save window position when moved
  widgetWindow.on("moved", () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      const [x, y] = widgetWindow.getPosition();
      cfg.set("windowX", x);
      cfg.set("windowY", y);
    }
  });

  widgetWindow.on("closed", () => { widgetWindow = null; });
}

// ── Data polling ──────────────────────────────────────────────────────────────
async function fetchAndSend() {
  const cfg = getStore();
  const apiBase = cfg.get("backendUrl") || "http://localhost:5000";
  const authToken = cfg.get("authToken") || "";

  try {
    let data = null;

    // Try the dedicated widget endpoint first
    try {
      const headers = authToken ? { "Cookie": `finwise_token=${authToken}` } : {};
      data = await fetchJson(`${apiBase}/api/widget/summary`, { headers });
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        // Token invalid or missing — show login screen
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send("show-login");
        }
        return;
      }
      // Fallback to /api/progress (demo mode without auth)
      try {
        const progress = await fetchJson(`${apiBase}/api/progress`);
        data = {
          totalBalance: 0,
          monthIncome: 0,
          monthExpense: 0,
          streak: progress?.streak ?? 0,
          level: progress?.level ?? 1,
          totalXp: progress?.totalXp ?? 0,
          demo: true,
        };
      } catch {
        throw new Error("Server unavailable");
      }
    }

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send("data-update", data);
    }
  } catch (err) {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send("data-error", err.message);
    }
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("open-app", () => {
  const cfg = getStore();
  shell.openExternal(`${cfg.get("backendUrl")}`);
});

ipcMain.handle("hide-widget", () => {
  if (widgetWindow) widgetWindow.hide();
});

ipcMain.handle("refresh-data", () => fetchAndSend());

// Get current config
ipcMain.handle("get-config", () => {
  const cfg = getStore();
  return {
    backendUrl: cfg.get("backendUrl"),
    hasToken: !!(cfg.get("authToken")),
  };
});

// Save server URL
ipcMain.handle("set-backend-url", (_, url) => {
  const cfg = getStore();
  cfg.set("backendUrl", url.trim());
  return { ok: true };
});

// Login: POST /api/auth/login, store cookie token
ipcMain.handle("do-login", async (_, { email, password }) => {
  const cfg = getStore();
  const apiBase = cfg.get("backendUrl") || "http://localhost:5000";
  try {
    const { body, headers } = await postJson(`${apiBase}/api/auth/login`, { email, password });
    // Extract token from set-cookie header
    const setCookie = headers["set-cookie"] || [];
    let token = "";
    for (const cookie of setCookie) {
      const match = cookie.match(/finwise_token=([^;]+)/);
      if (match) { token = match[1]; break; }
    }
    if (token) {
      cfg.set("authToken", token);
      return { ok: true, user: body };
    }
    // If no cookie, use JWT from response body if present
    if (body.token) {
      cfg.set("authToken", body.token);
      return { ok: true, user: body };
    }
    return { ok: false, error: "No token in response" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Logout: clear stored token
ipcMain.handle("do-logout", () => {
  const cfg = getStore();
  cfg.set("authToken", "");
  return { ok: true };
});

// Test connection to backend
ipcMain.handle("test-connection", async (_, url) => {
  try {
    const apiBase = (url || getStore().get("backendUrl")).trim();
    await fetchJson(`${apiBase}/api/widget/summary`);
    return { ok: true };
  } catch (err) {
    if (err.message === "UNAUTHORIZED") return { ok: true, needsLogin: true };
    return { ok: false, error: err.message };
  }
});

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "icon.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error("empty");
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("FinWise Widget");

  const updateMenu = () => {
    const cfg = getStore();
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: "Показать виджет",
        click: () => {
          if (widgetWindow) {
            widgetWindow.show();
            widgetWindow.focus();
          } else {
            createWidgetWindow();
            fetchAndSend();
          }
        },
      },
      {
        label: "Открыть FinWise в браузере",
        click: () => shell.openExternal(cfg.get("backendUrl")),
      },
      {
        label: "Обновить данные",
        click: () => fetchAndSend(),
      },
      { type: "separator" },
      { label: "Выход", role: "quit" },
    ]));
  };

  updateMenu();

  tray.on("click", () => {
    if (widgetWindow) {
      widgetWindow.isVisible() ? widgetWindow.hide() : widgetWindow.show();
    }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  createWidgetWindow();

  // Start polling (every 60s)
  fetchAndSend();
  pollingInterval = setInterval(fetchAndSend, 60_000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWidgetWindow();
  });
});

app.on("window-all-closed", (e) => {
  // Keep running in tray — do not quit
  e.preventDefault();
});

app.on("before-quit", () => {
  if (pollingInterval) clearInterval(pollingInterval);
});
