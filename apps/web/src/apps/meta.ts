export const APPS = [
  { id: "home", name: "Home", about: "Desktop overview and quick actions." },
  { id: "wallet", name: "Wallet", about: "Balances, transfers, and activity." },
  { id: "vault", name: "Vault", about: "Island key. Mainland apps cannot read it." },
  { id: "swap", name: "Swap", about: "Exchange tokens with a sample quote." },
  { id: "launch", name: "Launch Studio", about: "Prepare a token before any chain call." },
  { id: "dex", name: "DEX Terminal", about: "Market view and swap workspace." },
  { id: "portfolio", name: "Portfolio", about: "Holdings and allocation." },
  { id: "explorer", name: "Token Explorer", about: "Browse sample token markets." },
  { id: "nft", name: "NFT Manager", about: "Collectibles in this session." },
  { id: "bridge", name: "Bridge", about: "Move assets between networks." },
  { id: "files", name: "File Manager", about: "Browse folders and open files." },
  { id: "terminal", name: "Terminal", about: "A shell for this desktop." },
  { id: "editor", name: "Editor", about: "Edit text files." },
  { id: "browser", name: "Browser", about: "Open web pages inside the desktop." },
  { id: "settings", name: "Settings", about: "Cluster and appearance." },
  { id: "about", name: "About", about: "About this desktop." },
] as const

export type AppId = (typeof APPS)[number]["id"]

export type Size = { w: number; h: number }

export const APP_SIZE: Record<AppId, Size> = {
  home: { w: 760, h: 540 },
  wallet: { w: 560, h: 640 },
  vault: { w: 460, h: 560 },
  swap: { w: 420, h: 560 },
  launch: { w: 700, h: 660 },
  dex: { w: 980, h: 640 },
  portfolio: { w: 760, h: 540 },
  explorer: { w: 720, h: 560 },
  nft: { w: 740, h: 540 },
  bridge: { w: 520, h: 560 },
  files: { w: 740, h: 480 },
  terminal: { w: 700, h: 430 },
  editor: { w: 660, h: 500 },
  browser: { w: 920, h: 600 },
  settings: { w: 500, h: 420 },
  about: { w: 420, h: 380 },
}

export const APP_MIN: Record<AppId, Size> = {
  home: { w: 480, h: 360 },
  wallet: { w: 400, h: 420 },
  vault: { w: 380, h: 420 },
  swap: { w: 360, h: 420 },
  launch: { w: 520, h: 440 },
  dex: { w: 720, h: 420 },
  portfolio: { w: 520, h: 360 },
  explorer: { w: 480, h: 360 },
  nft: { w: 480, h: 360 },
  bridge: { w: 400, h: 420 },
  files: { w: 480, h: 320 },
  terminal: { w: 420, h: 280 },
  editor: { w: 420, h: 320 },
  browser: { w: 560, h: 360 },
  settings: { w: 400, h: 320 },
  about: { w: 360, h: 280 },
}

export const DESKTOP_SHORTCUTS: AppId[] = ["home", "wallet", "launch", "dex", "files", "settings"]

export const DOCK_PINS: AppId[] = ["home", "wallet", "swap", "launch", "dex", "files"]

export function isAppId(value: unknown): value is AppId {
  return APPS.some((app) => app.id === value)
}

export function appName(id: AppId): string {
  return APPS.find((app) => app.id === id)?.name ?? "App"
}

export function appAbout(id: AppId): string {
  return APPS.find((app) => app.id === id)?.about ?? ""
}
