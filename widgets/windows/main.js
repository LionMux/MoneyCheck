/**
 * FinWise Windows Widget — Electron
 *
 * A compact always-on-top window that shows balance summary
 * and lets you quickly add transactions.
 *
 * USAGE:
 *   npm install
 *   FINWISE_API=http://localhost:5000 npm start
 *
 * PACKAGE (optional):
 *   npm install --save-dev electron-builder
 *   npx electron-builder --win
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");

const API_BASE = process.env.FINWISE_API ?? "http://localhost:5000";
let tray = null;
let widgetWindow = null;
let pollingInterval = null;

// ── Helper: fetch JSON from API ────────────────────────────────────────────

function fetchJson(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith("https") ? https : http;
    const req = mod.get(urlStr, { headers: { "Accept": "application/json" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy());
  });
}

// ── Create widget window ───────────────────────────────────────────────────

function createWidgetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  widgetWindow = new BrowserWindow({
    width: 320,
    height: 220,
    x: width - 340,
    y: height - 240,
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

  // Drag support: clicks pass through to desktop when not interacting
  widgetWindow.setIgnoreMouseEvents(false);
}

// ── Data polling ───────────────────────────────────────────────────────────

async function fetchAndSend() {
  try {
    // Try the dedicated widget endpoint; fall back to /api/progress for demo mode
    let data = null;
    try {
      data = await fetchJson(`${API_BASE}/api/widget/summary`);
    } catch {
      const progress = await fetchJson(`${API_BASE}/api/progress`);
      // Build a compatible summary from available data
      data = {
        totalBalance: 0,
        monthIncome: 0,
        monthExpense: 0,
        streak: progress?.streak ?? 0,
        level: progress?.level ?? 1,
        totalXp: progress?.totalXp ?? 0,
      };
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

// ── IPC handlers ──────────────────────────────────────────────────────────

ipcMain.handle("open-app", () => {
  const { shell } = require("electron");
  shell.openExternal(`${API_BASE}/#/transactions`);
});

ipcMain.handle("hide-widget", () => {
  if (widgetWindow) widgetWindow.hide();
});

ipcMain.handle("refresh-data", () => fetchAndSend());

// ── Tray ───────────────────────────────────────────────────────────────────

function createTray() {
  // Simple 16x16 green circle icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("FinWise Widget");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Показать виджет",
      click: () => {
        if (widgetWindow) {
          widgetWindow.show();
          widgetWindow.focus();
        } else {
          createWidgetWindow();
        }
      },
    },
    { label: "Открыть FinWise", click: () => require("electron").shell.openExternal(`${API_BASE}`) },
    { type: "separator" },
    { label: "Выход", role: "quit" },
  ]));

  tray.on("click", () => {
    if (widgetWindow) {
      widgetWindow.isVisible() ? widgetWindow.hide() : widgetWindow.show();
    }
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────────

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
  // Keep running in tray
  e.preventDefault();
});

app.on("before-quit", () => {
  if (pollingInterval) clearInterval(pollingInterval);
});
