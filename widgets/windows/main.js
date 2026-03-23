/**
 * MoneyCheck Windows Widget — Electron
 *
 * Desktop-pinned widget (below all windows, on the desktop layer).
 * Supports:
 *  - Default backend: https://myfinwise.duckdns.org (configurable)
 *  - Persistent config via electron-store (backendUrl, authToken, bgColor, bgOpacity, transparent)
 *  - In-widget login screen (POST /api/auth/login)
 *  - Settings screen (server URL, bg color, opacity, full transparency)
 *  - Auto-polling every 60s
 *  - System tray with show/hide/quit
 *
 * USAGE (dev):
 *   npm install
 *   npm start
 *
 * BUILD installer:
 *   npm run build
 *   -> dist/MoneyCheck Widget Setup.exe
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, shell } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

const DEFAULT_BACKEND = "https://myfinwise.duckdns.org";

// ── Auto-updater setup ────────────────────────────────────────────────────────
log.transports.file.level = "info";
autoUpdater.logger = log;

// Only enable auto-update in packaged app
if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

// Auto-updater events
autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
  });

autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info);
    if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send("update-available", info);
        }
  });

autoUpdater.on("update-not-available", (info) => {
    log.info("Update not available:", info);
  });

autoUpdater.on("error", (err) => {
    log.error("Error in auto-updater:", err);
    if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send("update-error", err.message);
        }
  });

autoUpdater.on("download-progress", (progress) => {
    log.info(`Download speed: ${progress.bytesPerSecond} - Downloaded ${progress.percent}%`);
    if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send("update-download-progress", progress);
        }
  });

autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info);
    if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send("update-downloaded", info);
        }
  });

// ── Config store (electron-store) ────────────────────────────────────────────
let store = null;
function getStore() {
  if (!store) {
    try {
      const Store = require("electron-store");
      store = new Store({
        defaults: {
          backendUrl: process.env.MONEYCHECK_API ?? DEFAULT_BACKEND,
          authToken: "",
          windowX: null,
          windowY: null,
          bgColor: "#0f1919",
          bgOpacity: 0.92,
          fullyTransparent: false,
        },
      });
    } catch {
      const defaults = {
        backendUrl: process.env.MONEYCHECK_API ?? DEFAULT_BACKEND,
        authToken: "",
        windowX: null,
        windowY: null,
        bgColor: "#0f1919",
        bgOpacity: 0.92,
        fullyTransparent: false,
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

// ── Helper: fetch JSON from API ───────────────────────────────────────────────
function fetchJson(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith("https") ? https : http;
    const headers = { "Accept": "application/json", ...options.headers };
    const req = mod.get(urlStr, { headers, rejectUnauthorized: false }, (res) => {
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

// ── Helper: POST JSON ─────────────────────────────────────────────────────────
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
              rejectUnauthorized: false,
    };
    const req = mod.request(options, (res) => {
      let resp = "";
      res.on("data", (chunk) => (resp += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(resp);
          if (res.statusCode >= 400) reject(new Error(parsed.error || "Login failed"));
          else resolve({ body: parsed, headers: res.headers });
        } catch { reject(new Error("Invalid JSON response")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(7000, () => req.destroy());
    req.write(data);
    req.end();
  });
}

// ── Desktop-pinned window helpers ────────────────────────────────────────────
// Windows: set HWND_BOTTOM so widget sits below all normal windows but above desktop icons
function pinToDesktop(win) {
  if (process.platform !== "win32") return;
  try {
    // electron exposes setAlwaysOnTop with level — use 'desktop' level (below normal)
    win.setAlwaysOnTop(true, 'below-normal');
    // Keep it below normal windows by not setting alwaysOnTop at all.
    // The window is non-focusable and skips taskbar.
  } catch (_) {}
}

// ── Create widget window ───────────────────────────────────────────────────────
function createWidgetWindow() {
  const cfg = getStore();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const savedX = cfg.get("windowX");
  const savedY = cfg.get("windowY");
  const fullyTransparent = cfg.get("fullyTransparent");

  widgetWindow = new BrowserWindow({
    width: 320,
    height: 290,
    x: savedX ?? width - 340,
    y: savedY ?? height - 310,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
    
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  widgetWindow.loadFile(path.join(__dirname, "widget.html"));

  // On Windows: move to bottom of z-order after load
  widgetWindow.webContents.on("did-finish-load", () => {
    pinToDesktop(widgetWindow);
    // Send current appearance config to renderer
    const bgColor = cfg.get("bgColor");
    const bgOpacity = cfg.get("bgOpacity");
    const ft = cfg.get("fullyTransparent");
    widgetWindow.webContents.send("apply-appearance", { bgColor, bgOpacity, fullyTransparent: ft });
          fetchAndSend();
  });

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

// ── Data polling ───────────────────────────────────────────────────────────────
async function fetchAndSend() {
  const cfg = getStore();
  const apiBase = cfg.get("backendUrl") || DEFAULT_BACKEND;
  const authToken = cfg.get("authToken") || "";
  try {
    let data = null;
    try {
      const headers = authToken ? { "Cookie": `finwise_token=${authToken}` } : {};
      data = await fetchJson(`${apiBase}/api/widget/summary`, { headers });
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send("show-login");
        }
        return;
      }
      try {
        const progress = await fetchJson(`${apiBase}/api/progress`);
        data = {
          totalBalance: 0, monthIncome: 0, monthExpense: 0,
          streak: progress?.streak ?? 0,
          level: progress?.level ?? 1,
          totalXp: progress?.totalXp ?? 0,
          demo: true,
        };
      } catch { throw new Error("Server unavailable"); }
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

// ── IPC handlers ───────────────────────────────────────────────────────────────
ipcMain.handle("open-app", () => {
  const cfg = getStore();
  shell.openExternal(`${cfg.get("backendUrl")}`);
});

ipcMain.handle("hide-widget", () => {
  if (widgetWindow) widgetWindow.hide();
});

ipcMain.handle("refresh-data", () => fetchAndSend());

ipcMain.handle("get-config", () => {
  const cfg = getStore();
  return {
    backendUrl: cfg.get("backendUrl"),
    hasToken: !!(cfg.get("authToken")),
    bgColor: cfg.get("bgColor"),
    bgOpacity: cfg.get("bgOpacity"),
    fullyTransparent: cfg.get("fullyTransparent"),
  };
});

ipcMain.handle("set-backend-url", (_, url) => {
  const cfg = getStore();
  cfg.set("backendUrl", url.trim());
  return { ok: true };
});

// Save appearance settings and push to renderer
ipcMain.handle("set-appearance", (_, { bgColor, bgOpacity, fullyTransparent }) => {
  const cfg = getStore();
  if (bgColor !== undefined) cfg.set("bgColor", bgColor);
  if (bgOpacity !== undefined) cfg.set("bgOpacity", bgOpacity);
  if (fullyTransparent !== undefined) cfg.set("fullyTransparent", fullyTransparent);
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("apply-appearance", {
      bgColor: cfg.get("bgColor"),
      bgOpacity: cfg.get("bgOpacity"),
      fullyTransparent: cfg.get("fullyTransparent"),
    });
  }
  return { ok: true };
});

// Update-related IPC handlers
ipcMain.handle("check-for-updates", async () => {
    if (!app.isPackaged) {
          return { ok: false, error: "Updates only available in packaged app" };
        }
    try {
          const result = await autoUpdater.checkForUpdates();
          return { ok: true, updateInfo: result?.updateInfo };
        } catch (err) {
          log.error("Check for updates failed:", err);
          return { ok: false, error: err.message };
        }
  });

ipcMain.handle("install-update", () => {
    if (!app.isPackaged) {
          return { ok: false, error: "Updates only available in packaged app" };
        }
    try {
          autoUpdater.quitAndInstall();
          return { ok: true };
        } catch (err) {
          log.error("Install update failed:", err);
          return { ok: false, error: err.message };
        }
  });

ipcMain.handle("get-app-version", () => {
    return { version: app.getVersion() };
  });

ipcMain.handle("do-login", async (_, { email, password }) => {
  const cfg = getStore();
  const apiBase = cfg.get("backendUrl") || DEFAULT_BACKEND;
  try {
    const { body, headers } = await postJson(`${apiBase}/api/auth/login`, { email, password });
    const setCookie = headers["set-cookie"] || [];
    let token = "";
    for (const cookie of setCookie) {
      const match = cookie.match(/finwise_token=([^;]+)/);
      if (match) { token = match[1]; break; }
    }
    if (token) { cfg.set("authToken", token); return { ok: true, user: body }; }
    if (body.token) { cfg.set("authToken", body.token); return { ok: true, user: body }; }
    return { ok: false, error: "No token in response" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("do-logout", () => {
  const cfg = getStore();
  cfg.set("authToken", "");
  return { ok: true };
});

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

// ── Tray ───────────────────────────────────────────────────────────────────────
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
  tray.setToolTip("MoneyCheck Widget");
  const updateMenu = () => {
    const cfg = getStore();
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Показать виджет", click: () => {
        if (widgetWindow) { widgetWindow.show(); }
        else { createWidgetWindow(); fetchAndSend(); }
      }},
      { label: "Открыть MoneyCheck", click: () => shell.openExternal(cfg.get("backendUrl")), },
      { label: "Обновить данные", click: () => fetchAndSend(), },
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

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  createWidgetWindow();
  pollingInterval = setInterval(fetchAndSend, 60_000);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWidgetWindow();
  });
});

app.on("window-all-closed", (e) => {
  e.preventDefault(); // keep running in tray
});

app.on("before-quit", () => {
  if (pollingInterval) clearInterval(pollingInterval);
});
