import { useMemo, useState } from "react"
import { SAMPLE_CANDLES, SAMPLE_MARKETS, SAMPLE_PRICE, SAMPLE_SOL, SAMPLE_TOKENS, formatPct } from "../os/mock"
import { formatUsd } from "../os/network"
import { useOs } from "../os/store"
import { AppHead, AppPage, CandleChart, Field, SampleBadge } from "./ui"

type QuoteState = "idle" | "quote" | "pending" | "success" | "error"

const ASSETS = ["SOL", "USDC", "JUP", "BONK"] as const

function balanceOf(symbol: string): number {
  if (symbol === "SOL") return SAMPLE_SOL.amount
  return SAMPLE_TOKENS.find((token) => token.symbol === symbol)?.amount ?? 0
}

function rate(from: string, to: string): number {
  if (from === to) return 1
  if (from === "SOL" && to === "USDC") return SAMPLE_PRICE
  if (from === "USDC" && to === "SOL") return 1 / SAMPLE_PRICE
  if (from === "JUP") return to === "SOL" ? 0.0056 : 0.84
  if (from === "BONK") return to === "USDC" ? 0.000025 : 0.000025 / SAMPLE_PRICE
  return 1
}

export function DexTerminal({ compact = false }: { compact?: boolean }) {
  const os = useOs()
  const [pair, setPair] = useState(SAMPLE_MARKETS[0].id)
  const [from, setFrom] = useState<(typeof ASSETS)[number]>("SOL")
  const [to, setTo] = useState<(typeof ASSETS)[number]>("USDC")
  const [amount, setAmount] = useState("1")
  const [slippage, setSlippage] = useState("0.5")
  const [state, setState] = useState<QuoteState>("idle")
  const [message, setMessage] = useState("Enter an amount to build a sample quote.")

  const market = SAMPLE_MARKETS.find((item) => item.id === pair) ?? SAMPLE_MARKETS[0]
  const value = Number(amount)
  const quote = useMemo(() => (Number.isFinite(value) && value > 0 ? value * rate(from, to) : 0), [from, to, value])
  const minOut = quote * (1 - Number(slippage || 0) / 100)

  const buildQuote = () => {
    if (!Number.isFinite(value) || value <= 0) {
      setState("error")
      setMessage("Enter an amount greater than zero.")
      return
    }
    if (value > balanceOf(from)) {
      setState("error")
      setMessage("Amount is above the sample balance.")
      return
    }
    setState("quote")
    setMessage(`Sample quote: ${value} ${from} → ${quote.toFixed(4)} ${to}.`)
  }

  const runSwap = () => {
    if (state !== "quote") {
      buildQuote()
      return
    }
    setState("pending")
    setMessage("Preparing a sample result…")
    window.setTimeout(() => {
      setState("success")
      setMessage("Sample quote only. No swap was sent.")
      os.notify("Swap preview", "No swap was sent.")
    }, 700)
  }

  const swapForm = (
    <div className="dex-side">
      <Field label="From">
        <select value={from} onChange={(event) => setFrom(event.target.value as (typeof ASSETS)[number])}>
          {ASSETS.map((asset) => (
            <option key={asset}>{asset}</option>
          ))}
        </select>
      </Field>
      <Field label="Amount">
        <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <p className="muted">Sample balance {balanceOf(from).toLocaleString("en-US")} {from}</p>
      <Field label="To">
        <select value={to} onChange={(event) => setTo(event.target.value as (typeof ASSETS)[number])}>
          {ASSETS.map((asset) => (
            <option key={asset}>{asset}</option>
          ))}
        </select>
      </Field>
      <Field label="Slippage %">
        <input value={slippage} inputMode="decimal" onChange={(event) => setSlippage(event.target.value)} />
      </Field>
      <div className="fee-box">
        {state === "quote" || state === "success"
          ? `Min received ${minOut.toFixed(4)} ${to}`
          : "Quote, pending, success, and error stay in mock mode."}
      </div>
      <div className="state-box">
        <strong>{state}</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="ghost wide" onClick={buildQuote}>
        Quote
      </button>
      <button type="button" className="primary wide" onClick={runSwap} disabled={state === "pending"}>
        {state === "pending" ? "Working…" : "Preview swap"}
      </button>
    </div>
  )

  if (compact) {
    return (
      <AppPage>
        <AppHead title="Swap" aside={<SampleBadge />}>
          <p>Sample quote only. Jupiter is not connected.</p>
        </AppHead>
        {swapForm}
      </AppPage>
    )
  }

  return (
    <AppPage>
      <AppHead title="DEX Terminal" aside={<SampleBadge />}>
        <p>{market.base}/{market.quote} · sample market</p>
      </AppHead>
      <div className="dex-layout">
        <div className="dex-side">
          <div className="pair-row">
            {SAMPLE_MARKETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={pair === item.id ? "chip on" : "chip"}
                onClick={() => {
                  setPair(item.id)
                  setFrom(item.base as (typeof ASSETS)[number])
                  setTo(item.quote as (typeof ASSETS)[number])
                }}
              >
                {item.base}/{item.quote}
              </button>
            ))}
          </div>
          <div className="stat-row">
            <div className="stat-card">
              <span>Price</span>
              <strong>{formatUsd(market.price)}</strong>
            </div>
            <div className="stat-card">
              <span>24h</span>
              <strong className={market.change >= 0 ? "up" : "down"}>{formatPct(market.change)}</strong>
            </div>
          </div>
          <CandleChart candles={SAMPLE_CANDLES} label="Sample SOL/USDC candles" />
          <p className="muted">Volume {market.volume} · sample series, not a live book</p>
        </div>
        {swapForm}
      </div>
    </AppPage>
  )
}

export function Swap() {
  return <DexTerminal compact />
}
