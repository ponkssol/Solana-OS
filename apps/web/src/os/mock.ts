export type SampleToken = {
  symbol: string
  name: string
  amount: number
  usd: number
  change: number
  mint: string
}

export type SampleActivity = {
  id: string
  title: string
  detail: string
  time: string
  kind: "in" | "out" | "swap" | "note"
}

export type SampleCandle = {
  o: number
  h: number
  l: number
  c: number
}

export type SampleNft = {
  id: string
  name: string
  collection: string
  tone: string
}

export const SAMPLE_PRICE = 148.2

export const SAMPLE_TOKENS: SampleToken[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    amount: 420.12,
    usd: 420.12,
    change: 0.01,
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    amount: 86.2,
    usd: 72.41,
    change: -1.8,
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    amount: 1_250_000,
    usd: 31.25,
    change: 6.1,
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  },
]

export const SAMPLE_SOL: SampleToken = {
  symbol: "SOL",
  name: "Solana",
  amount: 12.48,
  usd: 1849.54,
  change: 2.4,
  mint: "So11111111111111111111111111111111111111112",
}

export const SAMPLE_ACTIVITY: SampleActivity[] = [
  { id: "a1", title: "Received SOL", detail: "+0.42 SOL · sample", time: "2h", kind: "in" },
  { id: "a2", title: "Swapped USDC", detail: "40 USDC → 0.27 SOL · sample", time: "1d", kind: "swap" },
  { id: "a3", title: "Sent JUP", detail: "12 JUP · sample", time: "3d", kind: "out" },
  { id: "a4", title: "Wallet connected", detail: "Session started on this desktop", time: "5d", kind: "note" },
]

export const SAMPLE_CHART = [142, 145, 144, 147, 149, 146, 148.2, 151, 149.4, 152, 150.8, 148.2]

export const SAMPLE_CANDLES: SampleCandle[] = [
  { o: 144.2, h: 146.1, l: 143.4, c: 145.6 },
  { o: 145.6, h: 147.8, l: 145.1, c: 146.9 },
  { o: 146.9, h: 148.4, l: 145.8, c: 146.2 },
  { o: 146.2, h: 147.1, l: 144.6, c: 145.0 },
  { o: 145.0, h: 148.8, l: 144.8, c: 148.3 },
  { o: 148.3, h: 150.2, l: 147.6, c: 149.4 },
  { o: 149.4, h: 151.6, l: 148.9, c: 150.8 },
  { o: 150.8, h: 151.2, l: 148.1, c: 148.6 },
  { o: 148.6, h: 149.9, l: 147.2, c: 149.1 },
  { o: 149.1, h: 152.4, l: 148.8, c: 151.7 },
  { o: 151.7, h: 153.1, l: 150.4, c: 150.9 },
  { o: 150.9, h: 151.8, l: 147.9, c: 148.2 },
]

export const SAMPLE_MARKETS = [
  { id: "sol-usdc", base: "SOL", quote: "USDC", price: 148.2, change: 1.62, volume: "42.1M" },
  { id: "jup-sol", base: "JUP", quote: "SOL", price: 0.0056, change: -0.84, volume: "6.4M" },
  { id: "bonk-usdc", base: "BONK", quote: "USDC", price: 0.000025, change: 6.1, volume: "18.8M" },
]

export const SAMPLE_EXPLORE = [
  { symbol: "SOL", name: "Solana", price: 148.2, change: 2.4, mcap: "71.2B", liq: "1.4B" },
  { symbol: "JUP", name: "Jupiter", price: 0.84, change: -1.8, mcap: "1.1B", liq: "42M" },
  { symbol: "BONK", name: "Bonk", price: 0.000025, change: 6.1, mcap: "1.8B", liq: "28M" },
  { symbol: "WIF", name: "dogwifhat", price: 1.42, change: 3.3, mcap: "1.4B", liq: "31M" },
  { symbol: "PYTH", name: "Pyth Network", price: 0.31, change: -0.4, mcap: "1.1B", liq: "19M" },
]

export const SAMPLE_NFTS: SampleNft[] = [
  { id: "n1", name: "Pad #042", collection: "OsPad Genesis", tone: "#6C63FF" },
  { id: "n2", name: "Pad #118", collection: "OsPad Genesis", tone: "#22D3EE" },
  { id: "n3", name: "Relay Pass", collection: "Bridge Club", tone: "#2DD4A7" },
  { id: "n4", name: "Studio Key", collection: "Launch Lab", tone: "#F5A524" },
]

export const SAMPLE_FEE_SOL = 0.02

export function samplePortfolioUsd(): number {
  return SAMPLE_SOL.usd + SAMPLE_TOKENS.reduce((sum, token) => sum + token.usd, 0)
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

export function formatAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 10_000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 })
}
