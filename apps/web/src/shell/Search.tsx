import { useEffect, useMemo, useRef, useState } from "react"
import { APPS, type AppId } from "../apps/meta"
import { AppIcon } from "../icons"
import { CLUSTERS } from "../os/network"
import { useOs } from "../os/store"

type Item = { key: string; label: string; hint: string; app?: AppId; run: () => void }

export function Search() {
  const os = useOs()
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(0)
  const [indexedQuery, setIndexedQuery] = useState(query)
  const input = useRef<HTMLInputElement>(null)
  if (query !== indexedQuery) {
    setIndexedQuery(query)
    setIndex(0)
  }

  const items = useMemo<Item[]>(() => {
    const apps: Item[] = APPS.map((app) => ({
      key: app.id,
      label: app.name,
      hint: "Application",
      app: app.id,
      run: () => os.openApp(app.id),
    }))
    const clusters: Item[] = CLUSTERS.map((cluster) => ({
      key: cluster.id,
      label: `Use ${cluster.label}`,
      hint: "Cluster",
      run: () => {
        os.setCluster(cluster.id)
        os.notify("Cluster", `${cluster.label} is now active.`)
        os.setSearch(false)
      },
    }))
    const needle = query.trim().toLowerCase()
    return [...apps, ...clusters].filter((item) => item.label.toLowerCase().includes(needle))
  }, [os, query])

  useEffect(() => {
    input.current?.focus()
  }, [])

  const choose = (item: Item | undefined) => {
    if (!item) return
    item.run()
  }

  return (
    <div className="overlay search-overlay" onPointerDown={() => os.setSearch(false)}>
      <div
        className="search"
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Search"
      >
        <input
          ref={input}
          value={query}
          placeholder="Search apps and commands"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setIndex((value) => Math.min(items.length - 1, value + 1))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setIndex((value) => Math.max(0, value - 1))
            } else if (event.key === "Enter") {
              event.preventDefault()
              choose(items[index])
            }
          }}
        />
        <ul>
          {items.length === 0 && <li className="empty">No matches</li>}
          {items.map((item, itemIndex) => (
            <li key={item.key}>
              <button
                type="button"
                className={itemIndex === index ? "hit on" : "hit"}
                onMouseEnter={() => setIndex(itemIndex)}
                onClick={() => choose(item)}
              >
                {item.app ? <AppIcon id={item.app} size={22} /> : <span className="hit-mark" />}
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
