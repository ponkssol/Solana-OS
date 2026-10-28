import { useEffect, useState } from "react"
import { Glyph, Mark } from "../icons"
import { clusterLabel, formatUsd, shortenAddress, useNetwork } from "../os/network"
import { useOs } from "../os/store"

export function Panel() {
  const os = useOs()
  const { rpcState, price } = useNetwork(os.cluster)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const clock = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  return (
    <header className="panel" onPointerDown={(event) => event.stopPropagation()}>
      <div className="panel-side">
        <Mark size={18} />
        <button
          type="button"
          className={os.launcherOpen ? "panel-btn on" : "panel-btn"}
          onClick={() => os.setLauncher(!os.launcherOpen)}
        >
          Apps
        </button>
      </div>
      <time className="clock" dateTime={now.toISOString()} title={date}>
        {clock}
      </time>
      <div className="panel-side end">
        <button type="button" className="icon-btn" aria-label="Search" onClick={() => os.setSearch(true)}>
          <Glyph name="search" size={16} />
        </button>
        <button type="button" className="status" onClick={() => os.openApp("settings")}>
          <i className={`dot ${rpcState}`} />
          {clusterLabel(os.cluster)}
        </button>
        <span className="price" title={price === null ? "Live price unavailable" : "Live SOL price"}>
          {price === null ? "SOL" : formatUsd(price)}
        </span>
        <button type="button" className="status wallet-chip" onClick={() => os.openApp("wallet")}>
          {os.address ? shortenAddress(os.address) : "Wallet"}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Notifications"
          onClick={() => os.setNotes(!os.notesOpen)}
        >
          <Glyph name="bell" size={16} />
          {os.unread > 0 && <em>{os.unread}</em>}
        </button>
      </div>
    </header>
  )
}
