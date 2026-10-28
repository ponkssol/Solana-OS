import { useEffect, useState } from "react"

export type Cluster = "devnet" | "testnet" | "mainnet-beta"

export const CLUSTERS: { id: Cluster; label: string }[] = [
  { id: "devnet", label: "Devnet" },
  { id: "testnet", label: "Testnet" },
  { id: "mainnet-beta", label: "Mainnet" },
]

export function rpcUrl(cluster: Cluster): string {
  if (cluster === "testnet") return "https://api.testnet.solana.com"
  if (cluster === "mainnet-beta") return "https://api.mainnet-beta.solana.com"
  return "https://api.devnet.solana.com"
}

export function clusterLabel(cluster: Cluster): string {
  return CLUSTERS.find((item) => item.id === cluster)?.label ?? "Devnet"
}

export function isCluster(value: unknown): value is Cluster {
  return value === "devnet" || value === "testnet" || value === "mainnet-beta"
}

async function rpc<T>(cluster: Cluster, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl(cluster), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const body = (await response.json()) as { result?: T; error?: { message?: string } }
  if (body.error) throw new Error(body.error.message ?? "RPC error")
  return body.result as T
}

export function useNetwork(cluster: Cluster) {
  const [rpcState, setRpcState] = useState<"checking" | "online" | "offline">("checking")
  const [price, setPrice] = useState<number | null>(null)

  useEffect(() => {
    let cancel = false
    const check = async () => {
      setRpcState("checking")
      try {
        const slot = await rpc<number>(cluster, "getSlot", [])
        if (!cancel) setRpcState(typeof slot === "number" ? "online" : "offline")
      } catch {
        if (!cancel) setRpcState("offline")
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 30000)
    return () => {
      cancel = true
      window.clearInterval(timer)
    }
  }, [cluster])

  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        )
        const body = (await response.json()) as { solana?: { usd?: number } }
        if (!cancel && typeof body.solana?.usd === "number") setPrice(body.solana.usd)
      } catch {
        if (!cancel) setPrice(null)
      }
    }
    void load()
    return () => {
      cancel = true
    }
  }, [])

  return { rpcState, price }
}

export function useBalance(cluster: Cluster, address: string | null) {
  const [balance, setBalance] = useState<number | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const watch = address ? `${cluster}:${address}` : ""
  const [tracked, setTracked] = useState(watch)
  if (watch !== tracked) {
    setTracked(watch)
    setBalance(null)
    setStatus(address ? "loading" : "idle")
  }

  useEffect(() => {
    if (!address) return
    let cancel = false
    const load = async () => {
      try {
        const result = await rpc<{ value: number }>(cluster, "getBalance", [address])
        if (cancel) return
        setBalance(result.value / 1_000_000_000)
        setStatus("ready")
      } catch {
        if (cancel) return
        setBalance(null)
        setStatus("error")
      }
    }
    void load()
    return () => {
      cancel = true
    }
  }, [address, cluster])

  return { balance, status }
}

export function shortenAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function formatSol(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}
