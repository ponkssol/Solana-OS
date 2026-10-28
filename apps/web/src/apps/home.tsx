import { APPS, DESKTOP_SHORTCUTS, appAbout } from "./meta"
import { AppIcon } from "../icons"
import { SAMPLE_SOL, samplePortfolioUsd } from "../os/mock"
import { clusterLabel, formatUsd, useNetwork } from "../os/network"
import { useOs } from "../os/store"
import { AppHead, AppPage, LiveBadge, SampleBadge } from "./ui"

export function Home() {
  const os = useOs()
  const { rpcState, price } = useNetwork(os.cluster)
  const pinned = APPS.filter((app) => DESKTOP_SHORTCUTS.includes(app.id))

  return (
    <AppPage>
      <AppHead title="Home" aside={<LiveBadge>{clusterLabel(os.cluster)}</LiveBadge>}>
        <p>This desktop sits on top of your computer. Its files stay separate from Windows.</p>
      </AppHead>
      <div className="home-grid">
        <div className="panel-card">
          <p className="kicker">Session</p>
          <p className="hero-value">{os.windows.length}</p>
          <p className="muted">Open windows on this desktop</p>
          <div className="stat-row" style={{ marginTop: 12 }}>
            <div className="stat-card">
              <span>Network</span>
              <strong>{rpcState}</strong>
            </div>
            <div className="stat-card">
              <span>Workspace</span>
              <strong>{os.workspace}</strong>
            </div>
          </div>
        </div>
        <div className="panel-card">
          <p className="kicker">
            Portfolio snapshot <SampleBadge />
          </p>
          <p className="hero-value">{formatUsd(samplePortfolioUsd())}</p>
          <p className="muted">
            Live SOL {price === null ? "unavailable" : formatUsd(price)} · sample holdings {formatUsd(SAMPLE_SOL.usd)}
          </p>
        </div>
      </div>
      <div className="action-row">
        {pinned.map((app) => (
          <button key={app.id} type="button" className="soft" onClick={() => os.openApp(app.id)}>
            {app.name}
          </button>
        ))}
      </div>
      <ul className="token-list">
        {pinned.map((app) => (
          <li key={app.id}>
            <button type="button" className="token-row" onClick={() => os.openApp(app.id)}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <AppIcon id={app.id} size={28} />
                <div>
                  <b>{app.name}</b>
                  <small>{appAbout(app.id)}</small>
                </div>
              </div>
              <span />
              <span className="muted">Open</span>
            </button>
          </li>
        ))}
      </ul>
    </AppPage>
  )
}
