import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react"
import { APP_MIN, APP_SIZE, appName, isAppId, type AppId } from "../apps/meta"
import { seedFiles, seedIslandFiles, type FileMap } from "./fs"
import { isCluster, type Cluster } from "./network"
import { lockVault } from "./vault"

const STORAGE_KEY = "solana-os.profile.v2"
export const PANEL_H = 44
export const DOCK_H = 100

export type Accent = "violet" | "green"
export type Theme = "light" | "dark"
export type Workspace = 1 | 2
export type Space = "mainland" | "island"

export type Win = {
  id: string
  app: AppId
  x: number
  y: number
  w: number
  h: number
  z: number
  workspace: Workspace
  space: Space
  minimized: boolean
  maximized: boolean
  restore?: { x: number; y: number; w: number; h: number }
  path?: string
}

export type Note = { id: string; title: string; body: string; time: number }

type State = {
  booted: boolean
  files: FileMap
  cluster: Cluster
  accent: Accent
  theme: Theme
  workspace: Workspace
  space: Space
  clones: AppId[]
  frozen: AppId[]
  islandFiles: FileMap
  windows: Win[]
  activeId: string | null
  launcherOpen: boolean
  searchOpen: boolean
  notesOpen: boolean
  notes: Note[]
  unread: number
  address: string | null
  unlocked: boolean
}

type Action =
  | { type: "boot" }
  | { type: "open"; app: AppId; path?: string; space?: Space }
  | { type: "close"; id: string }
  | { type: "focus"; id: string }
  | { type: "blur" }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; w: number; h: number }
  | { type: "minimize"; id: string }
  | { type: "maximize"; id: string }
  | { type: "workspace"; workspace: Workspace }
  | { type: "space"; space: Space }
  | { type: "clone"; app: AppId }
  | { type: "unclone"; app: AppId }
  | { type: "freeze"; app: AppId }
  | { type: "thaw"; app: AppId }
  | { type: "launcher"; open: boolean }
  | { type: "search"; open: boolean }
  | { type: "notes"; open: boolean }
  | { type: "dismiss-overlays" }
  | { type: "write"; path: string; content: string; space: Space }
  | { type: "cluster"; cluster: Cluster }
  | { type: "accent"; accent: Accent }
  | { type: "theme"; theme: Theme }
  | { type: "notify"; title: string; body: string }
  | { type: "wallet"; address: string | null }
  | { type: "unlock" }
  | { type: "hydrate"; files: FileMap }

type Os = State & {
  finishBoot: () => void
  openApp: (app: AppId, path?: string) => void
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  blur: () => void
  moveWindow: (id: string, x: number, y: number) => void
  resizeWindow: (id: string, w: number, h: number) => void
  minimizeWindow: (id: string) => void
  maximizeWindow: (id: string) => void
  setWorkspace: (workspace: Workspace) => void
  setSpace: (space: Space) => void
  cloneApp: (app: AppId) => void
  removeClone: (app: AppId) => void
  freezeApp: (app: AppId) => void
  thawApp: (app: AppId) => void
  filesFor: (space: Space) => FileMap
  setLauncher: (open: boolean) => void
  setSearch: (open: boolean) => void
  setNotes: (open: boolean) => void
  dismissOverlays: () => void
  writeFile: (path: string, content: string, space?: Space) => void
  setCluster: (cluster: Cluster) => void
  setAccent: (accent: Accent) => void
  setTheme: (theme: Theme) => void
  notify: (title: string, body: string) => void
  setAddress: (address: string | null) => void
  markUnlocked: () => void
  hydrateFiles: (files: FileMap) => void
}

const OsContext = createContext<Os | null>(null)

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isWorkspace(value: unknown): value is Workspace {
  return value === 1 || value === 2
}

function loadClones(value: unknown): AppId[] {
  if (!Array.isArray(value)) return []
  const clones: AppId[] = []
  for (const item of value) {
    if (isAppId(item) && item !== "vault" && !clones.includes(item)) clones.push(item)
  }
  return clones
}

function loadFrozen(value: unknown, clones: AppId[]): AppId[] {
  if (!Array.isArray(value)) return []
  const frozen: AppId[] = []
  for (const item of value) {
    if (item === "vault" || (isAppId(item) && clones.includes(item))) {
      if (!frozen.includes(item)) frozen.push(item)
    }
  }
  return frozen
}

function topId(windows: Win[], workspace: Workspace, space: Space): string | null {
  return (
    windows
      .filter((win) => !win.minimized && win.workspace === workspace && win.space === space)
      .sort((a, b) => b.z - a.z)[0]?.id ?? null
  )
}

function nextZ(windows: Win[]): number {
  return windows.reduce((max, win) => Math.max(max, win.z), 0) + 1
}

function sanitizeWindows(value: unknown): Win[] {
  if (!Array.isArray(value)) return []
  const windows: Win[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const win = item as Partial<Win>
    if (typeof win.id !== "string" || !isAppId(win.app)) continue
    if (typeof win.x !== "number" || typeof win.y !== "number") continue
    const min = APP_MIN[win.app]
    windows.push({
      id: win.id,
      app: win.app,
      x: clamp(win.x, -200, 1600),
      y: clamp(win.y, PANEL_H, 900),
      w: clamp(typeof win.w === "number" ? win.w : APP_SIZE[win.app].w, min.w, 1600),
      h: clamp(typeof win.h === "number" ? win.h : APP_SIZE[win.app].h, min.h, 1200),
      z: typeof win.z === "number" ? win.z : windows.length + 1,
      workspace: isWorkspace(win.workspace) ? win.workspace : 1,
      space: "island",
      minimized: Boolean(win.minimized),
      maximized: Boolean(win.maximized),
      path: typeof win.path === "string" ? win.path : undefined,
    })
  }
  return windows
}

function loadState(): State {
  let saved: Partial<State> | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) saved = JSON.parse(raw) as Partial<State>
  } catch {
    saved = null
  }
  const files = saved?.files && typeof saved.files === "object" ? saved.files : seedFiles()
  const islandFiles = saved?.islandFiles && typeof saved.islandFiles === "object" ? saved.islandFiles : seedIslandFiles()
  const clones = loadClones(saved?.clones)
  const windows = sanitizeWindows(saved?.windows)
  const workspace = isWorkspace(saved?.workspace) ? saved.workspace : 1
  const space: Space = "island"
  const firstVisit = !saved
  return {
    booted: sessionStorage.getItem("solana-os.booted") === "1",
    files,
    islandFiles,
    clones,
    frozen: loadFrozen(saved?.frozen, clones),
    cluster: isCluster(saved?.cluster) ? saved.cluster : "devnet",
    accent: saved?.accent === "green" ? "green" : "violet",
    theme: saved?.theme === "dark" ? "dark" : "light",
    workspace,
    space,
    windows,
    activeId: topId(windows, workspace, space),
    launcherOpen: false,
    searchOpen: false,
    notesOpen: false,
    notes: firstVisit
      ? [
          {
            id: "welcome",
            title: "Welcome to OsPad",
            body: "This OS sits on top of Windows. Its files are separate from the computer.",
            time: Date.now(),
          },
        ]
      : [],
    unread: firstVisit ? 1 : 0,
    address: null,
    unlocked: false,
  }
}

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "boot":
      return { ...state, booted: true }
    case "open": {
      const space = action.space ?? state.space
      const existing = state.windows.find((win) => win.app === action.app && win.space === space)
      const z = nextZ(state.windows)
      if (existing) {
        return {
          ...state,
          space,
          launcherOpen: false,
          searchOpen: false,
          activeId: existing.id,
          windows: state.windows.map((win) =>
            win.id === existing.id
              ? {
                  ...win,
                  z,
                  minimized: false,
                  workspace: state.workspace,
                  path: action.path ?? win.path,
                }
              : win,
          ),
        }
      }
      const size = APP_SIZE[action.app]
      const step = state.windows.filter((win) => win.workspace === state.workspace && win.space === space).length % 5
      const id = crypto.randomUUID()
      return {
        ...state,
        space,
        launcherOpen: false,
        searchOpen: false,
        activeId: id,
        windows: [
          ...state.windows,
          {
            id,
            app: action.app,
            x: 96 + step * 28,
            y: PANEL_H + 16 + step * 28,
            w: size.w,
            h: size.h,
            z,
            workspace: state.workspace,
            space,
            minimized: false,
            maximized: false,
            path: action.path,
          },
        ],
      }
    }
    case "close": {
      const windows = state.windows.filter((win) => win.id !== action.id)
      return {
        ...state,
        windows,
        activeId: state.activeId === action.id ? topId(windows, state.workspace, state.space) : state.activeId,
      }
    }
    case "focus": {
      const target = state.windows.find((win) => win.id === action.id)
      return {
        ...state,
        workspace: target?.workspace ?? state.workspace,
        space: target?.space ?? state.space,
        activeId: action.id,
        windows: state.windows.map((win) =>
          win.id === action.id ? { ...win, z: nextZ(state.windows), minimized: false } : win,
        ),
      }
    }
    case "blur":
      return { ...state, activeId: null }
    case "move":
      return {
        ...state,
        windows: state.windows.map((win) =>
          win.id === action.id && !win.maximized ? { ...win, x: action.x, y: action.y } : win,
        ),
      }
    case "resize":
      return {
        ...state,
        windows: state.windows.map((win) =>
          win.id === action.id && !win.maximized ? { ...win, w: action.w, h: action.h } : win,
        ),
      }
    case "minimize":
      return {
        ...state,
        activeId: state.activeId === action.id ? null : state.activeId,
        windows: state.windows.map((win) => (win.id === action.id ? { ...win, minimized: true } : win)),
      }
    case "maximize":
      return {
        ...state,
        activeId: action.id,
        windows: state.windows.map((win) => {
          if (win.id !== action.id) return win
          if (win.maximized && win.restore) {
            return { ...win, ...win.restore, maximized: false, restore: undefined, minimized: false }
          }
          const min = APP_MIN[win.app]
          return {
            ...win,
            restore: { x: win.x, y: win.y, w: win.w, h: win.h },
            x: 8,
            y: PANEL_H + 8,
            w: Math.max(min.w, window.innerWidth - 16),
            h: Math.max(min.h, window.innerHeight - PANEL_H - DOCK_H - 16),
            maximized: true,
            minimized: false,
          }
        }),
      }
    case "workspace":
      return {
        ...state,
        workspace: action.workspace,
        activeId: topId(state.windows, action.workspace, state.space),
        launcherOpen: false,
        searchOpen: false,
        notesOpen: false,
      }
    case "space":
      return {
        ...state,
        space: action.space,
        activeId: topId(state.windows, state.workspace, action.space),
        launcherOpen: false,
        searchOpen: false,
        notesOpen: false,
      }
    case "clone":
      if (action.app === "vault" || state.clones.includes(action.app)) return state
      return { ...state, clones: [...state.clones, action.app] }
    case "unclone": {
      const windows = state.windows.filter((win) => !(win.space === "island" && win.app === action.app))
      return {
        ...state,
        clones: state.clones.filter((id) => id !== action.app),
        frozen: state.frozen.filter((id) => id !== action.app),
        windows,
        activeId: windows.some((win) => win.id === state.activeId)
          ? state.activeId
          : topId(windows, state.workspace, state.space),
      }
    }
    case "freeze": {
      const windows = state.windows.filter((win) => !(win.space === "island" && win.app === action.app))
      return {
        ...state,
        frozen: state.frozen.includes(action.app) ? state.frozen : [...state.frozen, action.app],
        windows,
        activeId: windows.some((win) => win.id === state.activeId)
          ? state.activeId
          : topId(windows, state.workspace, state.space),
      }
    }
    case "thaw":
      return { ...state, frozen: state.frozen.filter((id) => id !== action.app) }
    case "launcher":
      return {
        ...state,
        launcherOpen: action.open,
        searchOpen: action.open ? false : state.searchOpen,
        notesOpen: action.open ? false : state.notesOpen,
      }
    case "search":
      return {
        ...state,
        searchOpen: action.open,
        launcherOpen: action.open ? false : state.launcherOpen,
        notesOpen: action.open ? false : state.notesOpen,
      }
    case "notes":
      return {
        ...state,
        notesOpen: action.open,
        unread: action.open ? 0 : state.unread,
        launcherOpen: action.open ? false : state.launcherOpen,
        searchOpen: action.open ? false : state.searchOpen,
      }
    case "dismiss-overlays":
      return { ...state, launcherOpen: false, searchOpen: false, notesOpen: false }
    case "write":
      if (action.space === "island") {
        return { ...state, islandFiles: { ...state.islandFiles, [action.path]: action.content } }
      }
      return { ...state, files: { ...state.files, [action.path]: action.content } }
    case "cluster":
      return { ...state, cluster: action.cluster }
    case "accent":
      return { ...state, accent: action.accent }
    case "theme":
      return { ...state, theme: action.theme }
    case "notify":
      return {
        ...state,
        unread: state.notesOpen ? 0 : state.unread + 1,
        notes: [
          { id: crypto.randomUUID(), title: action.title, body: action.body, time: Date.now() },
          ...state.notes,
        ].slice(0, 8),
      }
    case "wallet":
      return { ...state, address: action.address }
    case "unlock":
      return { ...state, unlocked: true, space: "island" }
    case "hydrate":
      return { ...state, islandFiles: action.files, space: "island", unlocked: true }
    default:
      return state
  }
}

export function OsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, loadState)

  useEffect(() => {
    const profile = {
      files: state.files,
      islandFiles: window.solanaOs?.space ? undefined : state.islandFiles,
      clones: state.clones,
      frozen: state.frozen,
      cluster: state.cluster,
      accent: state.accent,
      theme: state.theme,
      workspace: state.workspace,
      space: state.space,
      windows: state.windows,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  }, [state.files, state.islandFiles, state.clones, state.frozen, state.cluster, state.accent, state.theme, state.workspace, state.space, state.windows])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document.documentElement.style.colorScheme = state.theme
  }, [state.theme])

  const api: Os = {
    ...state,
    finishBoot: () => {
      sessionStorage.setItem("solana-os.booted", "1")
      dispatch({ type: "boot" })
    },
    openApp: (app, path) => {
      if (state.frozen.includes(app)) {
        dispatch({
          type: "notify",
          title: "App is frozen",
          body: "Unfreeze it from Apps before opening it.",
        })
        return
      }
      dispatch({ type: "open", app, path, space: "island" })
    },
    closeWindow: (id) => dispatch({ type: "close", id }),
    focusWindow: (id) => dispatch({ type: "focus", id }),
    blur: () => dispatch({ type: "blur" }),
    moveWindow: (id, x, y) => dispatch({ type: "move", id, x, y }),
    resizeWindow: (id, w, h) => dispatch({ type: "resize", id, w, h }),
    minimizeWindow: (id) => dispatch({ type: "minimize", id }),
    maximizeWindow: (id) => dispatch({ type: "maximize", id }),
    setWorkspace: (workspace) => dispatch({ type: "workspace", workspace }),
    setSpace: (space) => dispatch({ type: "space", space }),
    cloneApp: (app) => {
      if (app === "vault" || state.clones.includes(app)) {
        dispatch({ type: "notify", title: "Already in Island", body: `${appName(app)} already has an Island copy.` })
        return
      }
      dispatch({ type: "clone", app })
      dispatch({
        type: "notify",
        title: "Cloned to Island",
        body: `${appName(app)} can run in Island. Its files stay separate from Mainland.`,
      })
    },
    removeClone: (app) => dispatch({ type: "unclone", app }),
    freezeApp: (app) => {
      if (app === "vault") lockVault()
      dispatch({ type: "freeze", app })
      dispatch({
        type: "notify",
        title: "Frozen",
        body:
          app === "vault"
            ? "Vault is frozen and the key is out of memory."
            : `${appName(app)} cannot run until you unfreeze it.`,
      })
    },
    thawApp: (app) => dispatch({ type: "thaw", app }),
    filesFor: (space) => (space === "island" ? state.islandFiles : state.files),
    setLauncher: (open) => dispatch({ type: "launcher", open }),
    setSearch: (open) => dispatch({ type: "search", open }),
    setNotes: (open) => dispatch({ type: "notes", open }),
    dismissOverlays: () => dispatch({ type: "dismiss-overlays" }),
    writeFile: (path, content, space) => {
      const target = space ?? "island"
      dispatch({ type: "write", path, content, space: target })
      if (target === "island") void window.solanaOs?.space.writeFile(path, content)
    },
    setCluster: (cluster) => dispatch({ type: "cluster", cluster }),
    setAccent: (accent) => dispatch({ type: "accent", accent }),
    setTheme: (theme) => dispatch({ type: "theme", theme }),
    notify: (title, body) => dispatch({ type: "notify", title, body }),
    setAddress: (address) => dispatch({ type: "wallet", address }),
    markUnlocked: () => dispatch({ type: "unlock" }),
    hydrateFiles: (files) => dispatch({ type: "hydrate", files }),
  }

  return <OsContext.Provider value={api}>{children}</OsContext.Provider>
}

export function useOs(): Os {
  const value = useContext(OsContext)
  if (!value) throw new Error("useOs must be used inside OsProvider")
  return value
}
