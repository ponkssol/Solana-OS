import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const root = path.join(os.homedir(), "AppData", "Roaming", "solana-os-desktop", "space")
const running = new Map()
let catalog = []
let scannedAt = 0

function idFor(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function catalogFile() {
  return path.join(root, "host-catalog.json")
}

function readSaved() {
  try {
    const parsed = JSON.parse(readFileSync(catalogFile(), "utf8"))
    return {
      clones: Array.isArray(parsed.clones) ? parsed.clones : [],
      frozen: Array.isArray(parsed.frozen) ? parsed.frozen : [],
    }
  } catch {
    return { clones: [], frozen: [] }
  }
}

function writeSaved(saved) {
  mkdirSync(root, { recursive: true })
  writeFileSync(catalogFile(), JSON.stringify(saved))
}

function decorate() {
  const saved = readSaved()
  return catalog.map((app) => ({
    ...app,
    cloned: saved.clones.includes(app.id),
    frozen: saved.frozen.includes(app.id),
    running: running.has(app.id),
  }))
}

export async function listApps() {
  if (process.platform !== "win32") return { available: false, apps: [] }
  if (Date.now() - scannedAt > 60_000 || catalog.length === 0) {
    const found = new Map()
    const [menu, installed, store] = await Promise.all([startMenu(), uninstallList(), storeApps()])
    for (const app of [...menu, ...installed, ...store]) {
      if (!found.has(app.id)) found.set(app.id, app)
    }
    catalog = [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
    scannedAt = Date.now()
  }
  return { available: true, apps: decorate() }
}

export function cloneApp(id) {
  const app = catalog.find((item) => item.id === id)
  if (!app) return { ok: false, error: "That app is not installed." }
  const saved = readSaved()
  if (!saved.clones.includes(id)) saved.clones.push(id)
  mkdirSync(path.join(root, "profiles", id), { recursive: true })
  writeSaved(saved)
  return { ok: true }
}

export function openApp(id) {
  const app = catalog.find((item) => item.id === id)
  if (!app) return { ok: false, error: "That app is not installed." }
  const saved = readSaved()
  if (!saved.clones.includes(id)) return { ok: false, error: "Clone the app into this OS first." }
  if (saved.frozen.includes(id)) return { ok: false, error: "Unfreeze the app before opening it." }
  if (app.kind === "store") {
    spawn("explorer.exe", [`shell:AppsFolder\\${app.target}`], { detached: true, stdio: "ignore" }).unref()
    return { ok: true }
  }
  const profile = path.join(root, "profiles", id)
  mkdirSync(path.join(profile, "Roaming"), { recursive: true })
  mkdirSync(path.join(profile, "Local"), { recursive: true })
  const args = splitArgs(app.args || "")
  if (/chrome\.exe$/i.test(app.target) || /msedge\.exe$/i.test(app.target)) {
    args.push(`--user-data-dir=${path.join(profile, "browser")}`)
  }
  const child = spawn(app.target, args, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, APPDATA: path.join(profile, "Roaming"), LOCALAPPDATA: path.join(profile, "Local") },
  })
  child.unref()
  if (child.pid) running.set(id, child.pid)
  return { ok: true }
}

export function freezeApp(id) {
  const pid = running.get(id)
  if (pid) spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
  running.delete(id)
  const saved = readSaved()
  if (!saved.frozen.includes(id)) saved.frozen.push(id)
  writeSaved(saved)
  return { ok: true }
}

export function thawApp(id) {
  const saved = readSaved()
  saved.frozen = saved.frozen.filter((item) => item !== id)
  writeSaved(saved)
  return { ok: true }
}

export function removeApp(id) {
  freezeApp(id)
  const dir = path.join(root, "profiles", id)
  if (dir.startsWith(path.join(root, "profiles"))) rmSync(dir, { recursive: true, force: true })
  const saved = readSaved()
  saved.clones = saved.clones.filter((item) => item !== id)
  saved.frozen = saved.frozen.filter((item) => item !== id)
  writeSaved(saved)
  return { ok: true }
}

export async function handleHost(request, response) {
  const url = new URL(request.url, "http://localhost")
  const send = (body) => {
    response.statusCode = 200
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify(body))
  }
  if (request.method === "GET" && url.pathname === "/api/host/apps") {
    send(await listApps())
    return
  }
  if (request.method !== "POST") {
    response.statusCode = 404
    response.end()
    return
  }
  const body = await readBody(request)
  const id = typeof body.id === "string" ? body.id : ""
  if (url.pathname === "/api/host/clone") return send(cloneApp(id))
  if (url.pathname === "/api/host/open") return send(openApp(id))
  if (url.pathname === "/api/host/freeze") return send(freezeApp(id))
  if (url.pathname === "/api/host/thaw") return send(thawApp(id))
  if (url.pathname === "/api/host/remove") return send(removeApp(id))
  response.statusCode = 404
  response.end()
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = []
    request.on("data", (chunk) => chunks.push(chunk))
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"))
      } catch {
        resolve({})
      }
    })
  })
}

function startMenu() {
  const script = `
$shell = New-Object -ComObject WScript.Shell
$roots = @(
  "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
  "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"
)
$list = foreach ($dir in $roots) {
  if (Test-Path $dir) {
    Get-ChildItem $dir -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        $link = $shell.CreateShortcut($_.FullName)
        if ($link.TargetPath -and $link.TargetPath -notmatch 'uninstall|unins') {
          [pscustomobject]@{ name = $_.BaseName; target = $link.TargetPath; args = $link.Arguments; kind = 'exe' }
        }
      } catch {}
    }
  }
}
$list | ConvertTo-Json -Compress
`
  return powershell(script).then(parseApps)
}

function uninstallList() {
  const script = `
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -and $_.DisplayIcon } |
  ForEach-Object {
    $icon = ($_.DisplayIcon -split ',')[0].Trim('"')
    if ($icon -match '\\.exe$' -and (Test-Path $icon) -and $icon -notmatch 'uninstall|unins') {
      [pscustomobject]@{ name = $_.DisplayName; target = $icon; args = ''; kind = 'exe' }
    }
  } | ConvertTo-Json -Compress
`
  return powershell(script).then(parseApps)
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

function parseApps(raw) {
  return parseJson(raw)
    .filter((row) => row.name && row.target && existsSync(String(row.target)))
    .map((row) => ({
      id: idFor(String(row.target).toLowerCase()),
      name: String(row.name),
      target: String(row.target),
      args: String(row.args || ""),
      kind: "exe",
    }))
}

function parseJson(raw) {
  if (!raw || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

function powershell(script) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      { timeout: 40000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (_error, stdout) => resolve(stdout || ""),
    )
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
