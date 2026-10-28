const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("solanaOs", {
  browser: {
    navigate(url) {
      ipcRenderer.send("browser-navigate", url)
    },
    sync(state) {
      ipcRenderer.send("browser-sync", state)
    },
    onUrl(callback) {
      ipcRenderer.removeAllListeners("browser-url")
      ipcRenderer.on("browser-url", (_event, url) => callback(url))
    },
    onWarning(callback) {
      ipcRenderer.removeAllListeners("guard-warning")
      ipcRenderer.on("guard-warning", (_event, warning) => callback(warning))
    },
  },
  space: {
    status: () => ipcRenderer.invoke("space-status"),
    create: (passphrase) => ipcRenderer.invoke("space-create", passphrase),
    unlock: (passphrase) => ipcRenderer.invoke("space-unlock", passphrase),
    lock: () => ipcRenderer.invoke("space-lock"),
    writeFile: (filePath, content) => ipcRenderer.invoke("space-write", filePath, content),
  },
  host: {
    list: () => ipcRenderer.invoke("host-list"),
    clone: (id) => ipcRenderer.invoke("host-clone", id),
    open: (id) => ipcRenderer.invoke("host-open", id),
    freeze: (id) => ipcRenderer.invoke("host-freeze", id),
    thaw: (id) => ipcRenderer.invoke("host-thaw", id),
    remove: (id) => ipcRenderer.invoke("host-remove", id),
  },
  vault: {
    sign: (message, confirmed) => ipcRenderer.invoke("vault-sign", message, Boolean(confirmed)),
  },
})
