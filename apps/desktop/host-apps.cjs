const { spawn, execFile } = require("child_process")
const { createHash } = require("crypto")
const fs = require("fs")
const path = require("path")
const { shell } = require("electron")

let root = ""
let space = null
let catalog = []
let running = new Map()

function attach(dir, spaceApi) {
  root = dir
  space = spaceApi
  fs.mkdirSync(path.join(dir, "profiles"), { recursive: true })
}

function idFor(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function list() {
  const saved = space.catalog()
  return catalog.map((app) => ({
    ...app,
    cloned: saved.clones.includes(app.id),
    frozen: saved.frozen.includes(app.id),
    running: running.has(app.id),
  }))
}

async function scan() {
  if (process.platform !== "win32") {
    catalog = []
    return list()
  }
  const found = new Map()
  for (const app of await startMenu()) found.set(app.id, app)
  for (const app of await uninstallList()) {
    if (!found.has(app.id)) found.set(app.id, app)
  }
  for (const app of await storeApps()) {
    if (!found.has(app.id)) found.set(app.id, app)
  }
  catalog = [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
  return list()
}

function clone(id) {
  const app = catalog.find((item) => item.id === id)
  if (!app) return { ok: false, error: "That app is not installed." }
  if (!space.isUnlocked()) return { ok: false, error: "Unlock this OS first." }
  const saved = space.catalog()
  const clones = saved.clones.includes(id) ? saved.clones : [...saved.clones, id]
  fs.mkdirSync(profileDir(id), { recursive: true })
  space.setCatalog(clones, saved.frozen)
  return { ok: true }
}

function remove(id) {
  const saved = space.catalog()
  freeze(id)
  const dir = profileDir(id)
  if (dir.startsWith(path.join(root, "profiles"))) fs.rmSync(dir, { recursive: true, force: true })
  space.setCatalog(saved.clones.filter((item) => item !== id), saved.frozen.filter((item) => item !== id))
  return { ok: true }
}

function open(id) {
  const app = catalog.find((item) => item.id === id)
  if (!app) return { ok: false, error: "That app is not installed." }
  const saved = space.catalog()
  if (!saved.clones.includes(id)) return { ok: false, error: "Clone the app into this OS first." }
  if (saved.frozen.includes(id)) return { ok: false, error: "Unfreeze the app before opening it." }
  if (app.kind === "store") {
    spawn("explorer.exe", [`shell:AppsFolder\\${app.target}`], { detached: true, stdio: "ignore" }).unref()
    return { ok: true }
  }
  const profile = profileDir(id)
  fs.mkdirSync(path.join(profile, "Roaming"), { recursive: true })
  fs.mkdirSync(path.join(profile, "Local"), { recursive: true })
  const args = app.args ? splitArgs(app.args) : []
  if (/chrome\.exe$/i.test(app.target) || /msedge\.exe$/i.test(app.target)) {
    args.push(`--user-data-dir=${path.join(profile, "browser")}`)
  }
  const child = spawn(app.target, args, {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      APPDATA: path.join(profile, "Roaming"),
      LOCALAPPDATA: path.join(profile, "Local"),
    },
  })
  child.unref()
  if (child.pid) running.set(id, child.pid)
  return { ok: true }
}

function freeze(id) {
  const pid = running.get(id)
  if (pid && process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
  } else if (pid) {
    try { process.kill(pid) } catch { /* already gone */ }
  }
  running.delete(id)
  const saved = space.catalog()
  const frozen = saved.frozen.includes(id) ? saved.frozen : [...saved.frozen, id]
  space.setCatalog(saved.clones, frozen)
  return { ok: true }
}

function thaw(id) {
  const saved = space.catalog()
  space.setCatalog(saved.clones, saved.frozen.filter((item) => item !== id))
  return { ok: true }
}

function profileDir(id) {
  return path.join(root, "profiles", id)
}

async function startMenu() {
  const roots = [
    path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"),
  ]
  const apps = []
  for (const dir of roots) {
    for (const file of walk(dir)) {
      if (!file.toLowerCase().endsWith(".lnk")) continue
      try {
        const link = shell.readShortcutLink(file)
        if (!link.target || /uninstall|unins\d+\.exe/i.test(`${link.target} ${path.basename(file)}`)) continue
        const name = path.basename(file, path.extname(file))
        apps.push({ id: idFor(link.target.toLowerCase()), name, target: link.target, args: link.args || "", kind: "exe" })
      } catch {
        /* broken shortcut */
      }
    }
  }
  return apps
}

function walk(dir) {
  if (!dir || !fs.existsSync(dir)) return []
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    let stat
    try { stat = fs.statSync(full) } catch { continue }
    if (stat.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function uninstallList() {
  const script = `
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -and ($_.DisplayIcon -or $_.InstallLocation) } |
  Select-Object DisplayName, DisplayIcon, InstallLocation |
  ConvertTo-Json -Compress
`
  return powershell(script).then((raw) => {
    const rows = parseJson(raw)
    const apps = []
    for (const row of rows) {
      const target = exeFrom(row.DisplayIcon) || exeFrom(row.InstallLocation)
      if (!target || /uninstall|unins\d+\.exe/i.test(target)) continue
      apps.push({ id: idFor(target.toLowerCase()), name: String(row.DisplayName), target, args: "", kind: "exe" })
    }
    return apps
  })
}

function storeApps() {
  return powershell("Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress").then((raw) => {
    return parseJson(raw)
      .filter((row) => row.Name && row.AppID && String(row.AppID).includes("!"))
      .map((row) => ({
        id: idFor(String(row.AppID)),
        name: String(row.Name),
        target: String(row.AppID),
        args: "",
        kind: "store",
      }))
  })
}

function exeFrom(value) {
  if (!value || typeof value !== "string") return ""
  const cleaned = value.split(",")[0].replace(/^"/, "").replace(/"$/, "").trim()
  if (cleaned.toLowerCase().endsWith(".exe") && fs.existsSync(cleaned)) return cleaned
  if (cleaned && fs.existsSync(cleaned)) {
    const hit = fs.readdirSync(cleaned).find((name) => name.toLowerCase().endsWith(".exe") && !/uninstall|unins/i.test(name))
    if (hit) return path.join(cleaned, hit)
  }
  return ""
}

function parseJson(raw) {
  if (!raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

function powershell(script) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-Command", script], {
      timeout: 25000,
      maxBuffer: 12 * 1024 * 1024,
      windowsHide: true,
    }, (_error, stdout) => resolve(stdout || ""))
  })
}

function splitArgs(value) {
  const args = []
  const pattern = /"([^"]*)"|(\S+)/g
  let match = pattern.exec(value)
  while (match) {
    args.push(match[1] ?? match[2])
    match = pattern.exec(value)
  }
  return args
}

module.exports = { attach, scan, list, clone, open, freeze, thaw, remove }
