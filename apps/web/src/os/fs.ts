export type FileMap = Record<string, string>

export function seedFiles(): FileMap {
  return {
    "/Welcome.txt":
      "Welcome to OsPad.\n\nFiles in this desktop stay in this browser.\nOpen File Manager, Editor, or Terminal to begin.\n",
    "/Documents/Notes.txt":
      "The default cluster is devnet.\nSwitch it in Settings before you work on mainnet.\n",
  }
}

export function seedIslandFiles(): FileMap {
  return {
    "/Island.txt":
      "This folder belongs to Island.\n\nCloned apps read and write files here.\nMainland File Manager cannot see this folder.\nThe vault key is not stored in these files.\n",
  }
}

export type Entry = { name: string; kind: "file" | "dir" }

export function resolvePath(cwd: string, input: string): string {
  const raw = !input || input === "." ? cwd : input.startsWith("/") ? input : `${cwd === "/" ? "" : cwd}/${input}`
  const parts: string[] = []
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") parts.pop()
    else parts.push(part)
  }
  return `/${parts.join("/")}`
}

export function isDir(files: FileMap, path: string): boolean {
  if (path === "/") return true
  const prefix = path.endsWith("/") ? path : `${path}/`
  return Object.keys(files).some((key) => key.startsWith(prefix))
}

export function listDir(files: FileMap, dir: string): Entry[] {
  const prefix = dir === "/" ? "/" : dir.endsWith("/") ? dir : `${dir}/`
  const names = new Map<string, Entry["kind"]>()
  for (const path of Object.keys(files)) {
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    if (!rest) continue
    const slash = rest.indexOf("/")
    if (slash === -1) names.set(rest, "file")
    else names.set(rest.slice(0, slash), "dir")
  }
  return [...names.entries()]
    .map(([name, kind]) => ({ name, kind }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function parentDir(path: string): string {
  if (path === "/") return "/"
  const cut = path.lastIndexOf("/")
  return cut <= 0 ? "/" : path.slice(0, cut)
}

export function baseName(path: string): string {
  const cut = path.lastIndexOf("/")
  return cut === -1 ? path : path.slice(cut + 1)
}
