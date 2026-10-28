const { app, BrowserWindow, WebContentsView, ipcMain } = require("electron")
const path = require("path")
const { inspectUrl } = require("./guard.cjs")
const host = require("./host-apps.cjs")

const START_URL = process.env.SOLANA_OS_URL || "http://localhost:5173"

function safeUrl(input) {
  if (typeof input !== "string") return null
  try {
    const url = new URL(input)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

function contentSize(win) {
  const bounds = win.getContentBounds()
  return { width: bounds.width, height: bounds.height }
}

app.whenReady().then(async () => {
  const space = await import("./space.mjs")
  const dir = path.join(app.getPath("userData"), "space")
  space.init(dir)
  host.attach(dir, space)

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#1a1c22",
    title: "Solana OS",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const page = new WebContentsView({
    webPreferences: {
      partition: "persist:solana-browser",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.contentView.addChildView(page)
  page.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  page.setVisible(false)

  const sendUrl = (url) => {
    if (win.isDestroyed()) return
    win.webContents.send("browser-url", url)
  }
  page.webContents.on("did-navigate", (_event, url) => sendUrl(url))
  page.webContents.on("did-navigate-in-page", (_event, url) => sendUrl(url))
  page.webContents.setWindowOpenHandler(({ url }) => {
    const next = safeUrl(url)
    const verdict = next ? inspectUrl(next) : { ok: false, warning: "That address was blocked." }
    if (next && verdict.ok) page.webContents.loadURL(next)
    else if (!verdict.ok) win.webContents.send("guard-warning", verdict.warning)
    return { action: "deny" }
  })

  const fromUi = (event) => event.sender === win.webContents

  ipcMain.on("browser-navigate", (event, input) => {
    if (!fromUi(event)) return
    const url = safeUrl(input)
    if (!url) return
    const verdict = inspectUrl(url)
    if (!verdict.ok) {
      win.webContents.send("guard-warning", verdict.warning)
      return
    }
    page.webContents.loadURL(url)
  })

  ipcMain.on("browser-sync", (event, state) => {
    if (!fromUi(event) || !state || !state.bounds) return
    const limits = contentSize(win)
    const x = Math.max(0, Math.min(Number(state.bounds.x) || 0, limits.width))
    const y = Math.max(0, Math.min(Number(state.bounds.y) || 0, limits.height))
    const width = Math.max(0, Math.min(Number(state.bounds.width) || 0, limits.width - x))
    const height = Math.max(0, Math.min(Number(state.bounds.height) || 0, limits.height - y))
    const show = Boolean(state.show) && width > 1 && height > 1
    page.setVisible(show)
    page.setBounds({ x, y, width: show ? width : 0, height: show ? height : 0 })
  })

  const reply = (event, value) => (fromUi(event) ? value : { ok: false, error: "Rejected." })
  ipcMain.handle("space-status", (event) => reply(event, space.status()))
  ipcMain.handle("space-create", (event, passphrase) => reply(event, space.create(String(passphrase || ""))))
  ipcMain.handle("space-unlock", (event, passphrase) => reply(event, space.unlock(String(passphrase || ""))))
  ipcMain.handle("space-lock", (event) => {
    if (!fromUi(event)) return { ok: false }
    space.lock()
    return { ok: true }
  })
  ipcMain.handle("space-write", (event, filePath, content) => reply(event, space.writeFile(filePath, content)))
  ipcMain.handle("host-list", async (event) => reply(event, fromUi(event) ? { available: process.platform === "win32", apps: await host.scan() } : { available: false, apps: [] }))
  ipcMain.handle("host-clone", (event, id) => reply(event, host.clone(String(id || ""))))
  ipcMain.handle("host-open", (event, id) => reply(event, host.open(String(id || ""))))
  ipcMain.handle("host-freeze", (event, id) => reply(event, host.freeze(String(id || ""))))
  ipcMain.handle("host-thaw", (event, id) => reply(event, host.thaw(String(id || ""))))
  ipcMain.handle("host-remove", (event, id) => reply(event, host.remove(String(id || ""))))
  ipcMain.handle("vault-sign", (event, message, confirmed) => reply(event, space.signMessage(message, Boolean(confirmed))))

  win.loadURL(START_URL)

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) win.show()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
