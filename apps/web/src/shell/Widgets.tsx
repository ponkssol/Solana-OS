import { useState } from "react"
import { LiveBadge, SampleBadge } from "../apps/ui"
import { SAMPLE_ACTIVITY, SAMPLE_SOL, formatAmount } from "../os/mock"
import { clusterLabel, formatSol, formatUsd, useBalance, useNetwork } from "../os/network"
import { useOs } from "../os/store"

function CalendarWidget() {
  const [now] = useState(() => new Date())
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const first = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(first).fill(0), ...Array.from({ length: days }, (_, index) => index + 1)]
  return (
    <section className="widget">
      <h3>{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
      <div className="cal-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <b key={`${day}-${index}`}>{day}</b>
        ))}
        {cells.map((day, index) => (
          <span key={`${day}-${index}`} className={day === today ? "today" : ""}>
            {day || ""}
          </span>
        ))}
      </div>
    </section>
  )
}

export function Widgets() {
  const os = useOs()
  const { rpcState, price } = useNetwork(os.cluster)
  const { balance, status } = useBalance(os.cluster, os.address)
  const liveSol = status === "ready" && balance !== null
  const walletValue = liveSol ? formatSol(balance) : formatAmount(SAMPLE_SOL.amount)

  return (
    <aside className="widgets" onPointerDown={(event) => event.stopPropagation()}>
      <section className="widget">
        <div className="widget-stats">
          <div>
            <h3>
              Wallet
              {liveSol ? <LiveBadge>{clusterLabel(os.cluster)}</LiveBadge> : <SampleBadge />}
            </h3>
            <p className="widget-value">
              {walletValue} <small>SOL</small>
            </p>
          </div>
          <div>
            <h3>
              SOL
              {price === null ? <SampleBadge>Off</SampleBadge> : <LiveBadge>Live</LiveBadge>}
            </h3>
            <p className="widget-value">
              {price === null ? formatUsd(SAMPLE_SOL.usd / SAMPLE_SOL.amount) : formatUsd(price)}
            </p>
          </div>
        </div>
        <p>
          {clusterLabel(os.cluster)} · {rpcState}
        </p>
      </section>
      <CalendarWidget />
      <section className="widget">
        <h3>
          Activity
          <SampleBadge />
        </h3>
        <ul className="widget-list">
          {SAMPLE_ACTIVITY.slice(0, 3).map((item) => (
            <li key={item.id}>
              <span>{item.title}</span>
              <small>{item.time}</small>
            </li>
          ))}
        </ul>
        <div className="widget-actions">
          <button type="button" onClick={() => os.openApp("wallet")}>
            Wallet
          </button>
          <button type="button" onClick={() => os.openApp("swap")}>
            Swap
          </button>
          <button type="button" onClick={() => os.openApp("launch")}>
            Launch
          </button>
          <button type="button" onClick={() => os.openApp("dex")}>
            DEX
          </button>
        </div>
      </section>
    </aside>
  )
}
