interface InjectedWallet {
  isPhantom?: boolean
  publicKey: { toString(): string } | null
  connect: () => Promise<{ publicKey: { toString(): string } }>
  disconnect?: () => Promise<void>
}

interface SolanaOsBrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

interface HostAppInfo {
  id: string
  name: string
  kind: "exe" | "store"
  cloned: boolean
  frozen: boolean
  running: boolean
}

interface SolanaOsBridge {
  browser: {
    navigate: (url: string) => void
    sync: (state: { show: boolean; bounds: SolanaOsBrowserBounds }) => void
    onUrl: (callback: (url: string) => void) => void
    onWarning: (callback: (warning: string) => void) => void
  }
  space: {
    status: () => Promise<{ created: boolean }>
    create: (passphrase: string) => Promise<SpaceReply>
    unlock: (passphrase: string) => Promise<SpaceReply>
    lock: () => Promise<{ ok: boolean }>
    writeFile: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>
  }
  host: {
    list: () => Promise<{ available: boolean; apps: HostAppInfo[] }>
    clone: (id: string) => Promise<ActionReply>
    open: (id: string) => Promise<ActionReply>
    freeze: (id: string) => Promise<ActionReply>
    thaw: (id: string) => Promise<ActionReply>
    remove: (id: string) => Promise<ActionReply>
  }
  vault: {
    sign: (message: string, confirmed: boolean) => Promise<SignReply>
  }
}

interface SpaceReply {
  ok: boolean
  error?: string
  address?: string
  files?: Record<string, string>
}

interface ActionReply {
  ok: boolean
  error?: string
}

interface SignReply {
  ok: boolean
  signature?: string
  error?: string
  warnings?: string[]
}

interface Window {
  solana?: InjectedWallet
  solflare?: InjectedWallet
  phantom?: { solana?: InjectedWallet }
  solanaOs?: SolanaOsBridge
}
