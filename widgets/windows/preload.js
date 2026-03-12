const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("finwiseWidget", {
  onDataUpdate: (cb) => ipcRenderer.on("data-update", (_event, data) => cb(data)),
  onDataError: (cb) => ipcRenderer.on("data-error", (_event, msg) => cb(msg)),
  openApp: () => ipcRenderer.invoke("open-app"),
  hide: () => ipcRenderer.invoke("hide-widget"),
  refresh: () => ipcRenderer.invoke("refresh-data"),
});
