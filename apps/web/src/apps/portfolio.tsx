import { SAMPLE_SOL, SAMPLE_TOKENS, formatAmount, formatPct, samplePortfolioUsd } from "../os/mock"
import { formatUsd } from "../os/network"
import { AppHead, AppPage, SampleBadge } from "./ui"

export function Portfolio() {
  const rows = [SAMPLE_SOL, ...SAMPLE_TOKENS]
  const total = samplePortfolioUsd()
  return (
    <AppPage>
      <AppHead title="Portfolio" aside={<SampleBadge />}>
        <p>Holdings and allocation from sample balances.</p>
      </AppHead>
      <div className="stat-row">
        <div className="stat-card">
          <span>Total</span>
          <strong>{formatUsd(total)}</strong>
        </div>
        <div className="stat-card">
          <span>24h</span>
          <strong className="up">+2.10%</strong>
        </div>
      </div>
      <ul className="token-list">
        {rows.map((token) => (
          <li key={token.mint}>
            <div className="token-row">
              <div>
                <b>{token.symbol}</b>
                <small>{((token.usd / total) * 100).toFixed(1)}% · {formatAmount(token.amount)}</small>
              </div>
              <span>{formatUsd(token.usd)}</span>
              <span className={token.change >= 0 ? "up" : "down"}>{formatPct(token.change)}</span>
            </div>
          </li>
        ))}
      </ul>
    </AppPage>
  )
}
