const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes a safe API to the renderer (widget.html) via contextBridge.
 * All IPC channels are explicitly listed here — no wildcard access.
 */
contextBridge.exposeInMainWorld("finwiseWidget", {
  // ── Data events (main -> renderer) ──────────────────────────────────────
  /** Called when new summary data arrives from the server */
  onDataUpdate: (cb) => ipcRenderer.on("data-update", (_event, data) => cb(data)),
  /** Called when server request fails */
  onDataError: (cb) => ipcRenderer.on("data-error", (_event, msg) => cb(msg)),
  /** Called when login is required (401 from server) */
  onShowLogin: (cb) => ipcRenderer.on("show-login", () => cb()),

  // ── Widget actions (renderer -> main) ─────────────────────────────────
  /** Open FinWise in system browser */
  openApp: () => ipcRenderer.invoke("open-app"),
  /** Hide widget window */
  hide: () => ipcRenderer.invoke("hide-widget"),
  /** Manually refresh data */
  refresh: () => ipcRenderer.invoke("refresh-data"),

  // ── Config (renderer -> main) ─────────────────────────────────────────
  /** Get current config: { backendUrl, hasToken } */
  getConfig: () => ipcRenderer.invoke("get-config"),
  /** Save new backend URL */
  setBackendUrl: (url) => ipcRenderer.invoke("set-backend-url", url),
  /** Test connectivity to the given URL */
  testConnection: (url) => ipcRenderer.invoke("test-connection", url),

  // ── Auth (renderer -> main) ───────────────────────────────────────────
  /** Login with email + password. Returns { ok, user?, error? } */
  login: ({ email, password }) => ipcRenderer.invoke("do-login", { email, password }),
  /** Logout: clear stored token */
  logout: () => ipcRenderer.invoke("do-logout"),
});
