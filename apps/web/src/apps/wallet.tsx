import { useState } from "react"
import {
  SAMPLE_ACTIVITY,
  SAMPLE_CHART,
  SAMPLE_SOL,
  SAMPLE_TOKENS,
  formatAmount,
  formatPct,
} from "../os/mock"
import { clusterLabel, formatSol, formatUsd, shortenAddress, useBalance, useNetwork } from "../os/network"
import { useOs } from "../os/store"
import { copyWatched } from "../os/guard"
import { requestSignature, useVault } from "../os/vault"
import { AppHead, AppPage, Field, LineChart, LiveBadge, SampleBadge } from "./ui"

type Panel = "overview" | "send" | "receive" | "buy"

export function Wallet() {
  const os = useOs()
  const vault = useVault()
  const { price } = useNetwork(os.cluster)
  const { balance, status } = useBalance(os.cluster, os.address)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>("overview")
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [sendNote, setSendNote] = useState("")

  const live = status === "ready" && balance !== null
  const solAmount = live ? balance : SAMPLE_SOL.amount
  const solUsd = price !== null ? solAmount * price : live ? null : SAMPLE_SOL.usd
  const sampleUsd = SAMPLE_TOKENS.reduce((sum, token) => sum + token.usd, 0)

  const connect = async () => {
    const provider = window.phantom?.solana ?? window.solana ?? window.solflare
    if (!provider?.connect) {
      os.notify("No wallet found", "Install Phantom or Solflare, then refresh.")
      return
    }
    setBusy(true)
    try {
      const result = await provider.connect()
      const address = result.publicKey?.toString() ?? provider.publicKey?.toString()
      if (!address) throw new Error("Missing address")
      os.setAddress(address)
      os.notify("Wallet connected", shortenAddress(address))
    } catch {
      os.notify("Connection cancelled", "The wallet did not connect.")
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    const provider = window.phantom?.solana ?? window.solana ?? window.solflare
    await provider?.disconnect?.()
    os.setAddress(null)
  }

  const previewSend = () => {
    const value = Number(amount)
    if (!to.trim() || !Number.isFinite(value) || value <= 0) {
      setSendNote("Enter a destination and an amount greater than zero.")
      return
    }
    setSendNote("Preview only. No transaction is sent.")
    os.notify("Send preview", "No transaction is sent in this desktop.")
  }

  return (
    <AppPage>
      <AppHead
        title="Wallet"
        aside={live ? <LiveBadge>{clusterLabel(os.cluster)}</LiveBadge> : <SampleBadge />}
      >
        <p>{clusterLabel(os.cluster)} · {os.address ? shortenAddress(os.address) : "Not connected"}</p>
      </AppHead>
      <div className="scroll-pane">
        {panel === "overview" && (
          <>
            <div className="panel-card">
              <p className="kicker">Upper OS vault</p>
              {vault.address ? (
                <>
                  <p className="mono address-line">{vault.address}</p>
                  <p className="muted">Public address only. The key stays in this OS, not in Windows.</p>
                </>
              ) : (
                <p className="muted">No key yet. Create one in the Vault. Windows apps do not receive it.</p>
              )}
              <div className="action-row">
                <button type="button" className="soft" onClick={() => os.openApp("vault")}>
                  {vault.address ? "Open vault" : "Create vault"}
                </button>
                {vault.address && (
                  <button
                    type="button"
                    className="soft"
                    onClick={() => {
                      requestSignature(
                        "Signature request",
                        "Solana OS asked the vault to sign this text. No transaction is sent.",
                      )
                      os.notify("Request sent", "Open the Vault to approve it.")
                    }}
                  >
                    Ask Island to sign
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="kicker">{live ? "Live SOL on this cluster" : "Sample portfolio value"}</p>
              <p className="hero-value">
                {live ? `${formatSol(solAmount)} ` : `${formatUsd(SAMPLE_SOL.usd + sampleUsd)} `}
                <small>{live ? "SOL" : "USD"}</small>
              </p>
              {!live && <p className="muted">Sample holdings only. Connect a wallet to load a live SOL balance.</p>}
              {live && solUsd !== null && <p className="muted">{formatUsd(solUsd)} at the live SOL price</p>}
            </div>
            <LineChart values={SAMPLE_CHART} label="Sample seven-day SOL path" />
            <div className="action-row">
              <button type="button" className="soft" onClick={() => setPanel("send")}>Send</button>
              <button type="button" className="soft" onClick={() => setPanel("receive")}>Receive</button>
              <button type="button" className="soft" onClick={() => os.openApp("swap")}>Swap</button>
              <button type="button" className="soft" onClick={() => setPanel("buy")}>Buy</button>
            </div>
            <ul className="token-list">
              <li>
                <div className="token-row">
                  <div>
                    <b>SOL</b>
                    <small>{live ? `Live on ${clusterLabel(os.cluster)}` : "Sample balance"}</small>
                  </div>
                  <span className="mono">{formatAmount(solAmount)}</span>
                  <span className={SAMPLE_SOL.change >= 0 ? "up" : "down"}>{formatPct(SAMPLE_SOL.change)}</span>
                </div>
              </li>
              {SAMPLE_TOKENS.map((token) => (
                <li key={token.mint}>
                  <div className="token-row">
                    <div>
                      <b>{token.symbol}</b>
                      <small>Sample · {formatUsd(token.usd)}</small>
                    </div>
                    <span className="mono">{formatAmount(token.amount)}</span>
                    <span className={token.change >= 0 ? "up" : "down"}>{formatPct(token.change)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="panel-card">
              <p className="kicker">Recent activity</p>
              <ul className="widget-list">
                {SAMPLE_ACTIVITY.map((item) => (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    <small>{item.time}</small>
                  </li>
                ))}
              </ul>
              <SampleBadge>Activity is sample data</SampleBadge>
            </div>
            {os.address ? (
              <>
                <div className="address">
                  <code>{os.address}</code>
                  <button
                    type="button"
                    onClick={() => {
                      void copyWatched(os.address ?? "", (body) => os.notify("Clipboard changed", body))
                      os.notify("Copied", "Address copied.")
                    }}
                  >
                    Copy
                  </button>
                </div>
                <button type="button" className="ghost wide" onClick={() => void disconnect()}>
                  Disconnect
                </button>
              </>
            ) : (
              <button type="button" className="primary wide" disabled={busy} onClick={() => void connect()}>
                {busy ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </>
        )}
        {panel === "send" && (
          <>
            <Field label="Destination">
              <input value={to} spellCheck={false} onChange={(event) => setTo(event.target.value)} />
            </Field>
            <Field label="Amount (SOL)">
              <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
            </Field>
            {sendNote && <div className="state-box"><p>{sendNote}</p></div>}
            <button type="button" className="primary wide" onClick={previewSend}>Preview send</button>
            <button type="button" className="ghost wide" onClick={() => setPanel("overview")}>Back</button>
          </>
        )}
        {panel === "receive" && (
          <>
            <div className="state-box">
              <strong>Receive</strong>
              <p>{os.address ? "Share this address. Funds stay on the selected cluster." : "Connect a wallet to show a receive address."}</p>
            </div>
            {os.address && (
              <div className="address">
                <code>{os.address}</code>
                <button
                  type="button"
                  onClick={() => {
                    void copyWatched(os.address ?? "", (body) => os.notify("Clipboard changed", body))
                    os.notify("Copied", "Address copied.")
                  }}
                >
                  Copy
                </button>
              </div>
            )}
            <button type="button" className="ghost wide" onClick={() => setPanel("overview")}>Back</button>
          </>
        )}
        {panel === "buy" && (
          <>
            <div className="state-box">
              <strong>Buy</strong>
              <p>Buying is not connected. This desktop stays in mock mode until a payment venue is configured.</p>
            </div>
            <button type="button" className="ghost wide" onClick={() => setPanel("overview")}>Back</button>
          </>
        )}
      </div>
    </AppPage>
  )
}

