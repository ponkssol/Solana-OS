import type { ReactNode } from "react"

export function SampleBadge({ children = "Sample data" }: { children?: string }) {
  return <span className="badge-sample">{children}</span>
}

export function LiveBadge({ children }: { children: ReactNode }) {
  return <span className="badge-live">{children}</span>
}

export function AppPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`app-page ${className}`.trim()}>{children}</div>
}

export function AppHead({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="app-head">
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      {aside}
    </header>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="state-box">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

export function LineChart({ values, label }: { values: number[]; label: string }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 220
      const y = 64 - ((value - min) / span) * 52
      return `${x},${y}`
    })
    .join(" ")
  const area = `0,68 ${points} 220,68`
  return (
    <figure className="chart-box" aria-label={label}>
      <svg viewBox="0 0 220 68" role="img">
        <title>{label}</title>
        <polygon points={area} fill="rgba(59, 158, 255, 0.18)" />
        <polyline points={points} fill="none" stroke="#3B9EFF" strokeWidth="2" />
      </svg>
    </figure>
  )
}

export function CandleChart({
  candles,
  label,
}: {
  candles: { o: number; h: number; l: number; c: number }[]
  label: string
}) {
  const highs = candles.map((item) => item.h)
  const lows = candles.map((item) => item.l)
  const min = Math.min(...lows)
  const max = Math.max(...highs)
  const span = max - min || 1
  const width = 220
  const step = width / candles.length
  return (
    <figure className="chart-box candle-chart" aria-label={label}>
      <svg viewBox={`0 0 ${width} 88`} role="img">
        <title>{label}</title>
        {candles.map((item, index) => {
          const x = index * step + step / 2
          const yHigh = 8 + ((max - item.h) / span) * 72
          const yLow = 8 + ((max - item.l) / span) * 72
          const yOpen = 8 + ((max - item.o) / span) * 72
          const yClose = 8 + ((max - item.c) / span) * 72
          const top = Math.min(yOpen, yClose)
          const height = Math.max(2, Math.abs(yClose - yOpen))
          const up = item.c >= item.o
          return (
            <g key={`${item.o}-${index}`}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={up ? "#2DD4A7" : "#F87171"} strokeWidth="1" />
              <rect
                x={x - 3}
                y={top}
                width="6"
                height={height}
                fill={up ? "#2DD4A7" : "#F87171"}
                rx="1"
              />
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
