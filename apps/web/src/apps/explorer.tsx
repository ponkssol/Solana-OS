import { useMemo, useState } from "react"
import { SAMPLE_EXPLORE, formatPct } from "../os/mock"
import { formatUsd } from "../os/network"
import { AppHead, AppPage, EmptyState, Field, SampleBadge } from "./ui"

export function TokenExplorer() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(SAMPLE_EXPLORE[0].symbol)
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return SAMPLE_EXPLORE.filter(
      (token) => token.symbol.toLowerCase().includes(needle) || token.name.toLowerCase().includes(needle),
    )
  }, [query])
  const current = rows.find((token) => token.symbol === selected) ?? rows[0]

  return (
    <AppPage>
      <AppHead title="Token Explorer" aside={<SampleBadge />}>
        <p>Search a sample market list. Prices are fixtures.</p>
      </AppHead>
      <Field label="Search">
        <input value={query} placeholder="Name or symbol" onChange={(event) => setQuery(event.target.value)} />
      </Field>
      {rows.length === 0 && <EmptyState title="No tokens" body="Nothing in the sample list matches that search." />}
      <ul className="token-list">
        {rows.map((token) => (
          <li key={token.symbol}>
            <button
              type="button"
              className={current?.symbol === token.symbol ? "token-row on" : "token-row"}
              onClick={() => setSelected(token.symbol)}
            >
              <div>
                <b>{token.symbol}</b>
                <small>{token.name}</small>
              </div>
              <span>{formatUsd(token.price)}</span>
              <span className={token.change >= 0 ? "up" : "down"}>{formatPct(token.change)}</span>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <div className="panel-card">
          <strong>{current.name}</strong>
          <p className="muted">
            Market cap {current.mcap} · Liquidity {current.liq} · sample
          </p>
        </div>
      )}
    </AppPage>
  )
}
