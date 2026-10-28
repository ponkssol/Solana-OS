import { useEffect, useRef, useState } from "react"
import { Glyph, Mark } from "../icons"
import { baseName, isDir, listDir, parentDir, resolvePath } from "../os/fs"
import { inspectUrl } from "../os/guard"
import { CLUSTERS } from "../os/network"
import { useOs, type Space, type Win } from "../os/store"
import { Vault } from "./vault"
import { Bridge } from "./bridge"
import { DexTerminal, Swap } from "./dex"
import { TokenExplorer } from "./explorer"
import { Home } from "./home"
import { LaunchStudio } from "./launch"
import { NftManager } from "./nft"
import { Portfolio } from "./portfolio"
import { Wallet } from "./wallet"

export function AppView({ win }: { win: Win }) {
  if (win.app === "home") return <Home />
  if (win.app === "wallet") return <Wallet />
  if (win.app === "vault") return <Vault />
  if (win.app === "swap") return <Swap />
  if (win.app === "launch") return <LaunchStudio />
  if (win.app === "dex") return <DexTerminal />
  if (win.app === "portfolio") return <Portfolio />
  if (win.app === "explorer") return <TokenExplorer />
  if (win.app === "nft") return <NftManager />
  if (win.app === "bridge") return <Bridge />
  if (win.app === "files") return <Files space={win.space} />
  if (win.app === "terminal") return <Terminal space={win.space} />
  if (win.app === "editor") {
    return <Editor path={win.path ?? (win.space === "island" ? "/Island.txt" : "/Welcome.txt")} space={win.space} />
  }
  if (win.app === "browser") return <Browser win={win} />
  if (win.app === "settings") return <Settings />
  return <About />
}

function Files({ space }: { space: Space }) {
  const os = useOs()
  const [dir, setDir] = useState("/")
  const [selected, setSelected] = useState<string | null>(null)
  const entries = listDir(os.filesFor(space), dir)

  const open = (name: string, kind: "file" | "dir") => {
    const next = dir === "/" ? `/${name}` : `${dir}/${name}`
    if (kind === "dir") {
      setDir(next)
      setSelected(null)
      return
    }
    os.openApp("editor", next)
  }

  return (
    <div className="files">
      <nav>
        <button type="button" className={dir === "/" ? "on" : ""} onClick={() => setDir("/")}>
          Home
        </button>
        <button type="button" className={dir === "/Documents" ? "on" : ""} onClick={() => setDir("/Documents")}>
          Documents
        </button>
      </nav>
      <div className="file-main">
        <div className="file-path">
          {dir !== "/" && (
            <button type="button" onClick={() => setDir(parentDir(dir))}>
              Back
            </button>
          )}
          <span>{dir === "/" ? "Home" : dir}</span>
        </div>
        <div className="file-head">
          <span>Name</span>
          <span>Kind</span>
        </div>
        {entries.length === 0 && <p className="muted pad">This folder is empty.</p>}
        <ul>
          {entries.map((entry) => {
            const path = dir === "/" ? `/${entry.name}` : `${dir}/${entry.name}`
            return (
              <li key={path}>
                <button
                  type="button"
                  className={selected === path ? "row on" : "row"}
                  onClick={() => setSelected(path)}
                  onDoubleClick={() => open(entry.name, entry.kind)}
                >
                  <span>{entry.name}</span>
                  <span>{entry.kind === "dir" ? "Folder" : "Text"}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Terminal({ space }: { space: Space }) {
  const os = useOs()
  const [cwd, setCwd] = useState("/")
  const [lines, setLines] = useState<string[]>([
    space === "island" ? "Island terminal. Files here stay out of Mainland." : "Solana OS terminal. Type help.",
  ])
  const [value, setValue] = useState("")
  const end = useRef<HTMLDivElement>(null)
  const files = os.filesFor(space)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [lines])

  const run = (raw: string) => {
    const line = raw.trim()
    const shown = `${cwd} $ ${raw}`
    if (!line) {
      setLines((prev) => [...prev, shown])
      return
    }
    const redirectAt = line.indexOf(">")
    const left = (redirectAt === -1 ? line : line.slice(0, redirectAt)).trim()
    const redirect = redirectAt === -1 ? "" : line.slice(redirectAt + 1).trim()
    const splitAt = left.indexOf(" ")
    const cmd = splitAt === -1 ? left : left.slice(0, splitAt)
    const args = splitAt === -1 ? "" : left.slice(splitAt + 1).trim()
    const out: string[] = []

    if (cmd === "help") {
      out.push("help   show commands", "ls     list a directory", "cd     change directory", "cat    print a file", "echo   print text, or echo text > file", "pwd    print the working directory", "clear  clear the screen")
    } else if (cmd === "pwd") {
      out.push(cwd)
    } else if (cmd === "ls") {
      const target = resolvePath(cwd, args)
      if (files[target] !== undefined && !isDir(files, target)) out.push("Not a directory")
      else if (!isDir(files, target) && args) out.push("No such directory")
      else out.push(listDir(files, target).map((entry) => entry.name).join("  ") || "")
    } else if (cmd === "cd") {
      const target = resolvePath(cwd, args || "/")
      if (!isDir(files, target)) out.push("No such directory")
      else setCwd(target === "" ? "/" : target)
    } else if (cmd === "cat") {
      if (!args) out.push("Usage: cat file")
      else {
        const target = resolvePath(cwd, args)
        if (files[target] === undefined) out.push("No such file")
        else out.push(files[target])
      }
    } else if (cmd === "echo") {
      const text = args.replace(/^"|"$/g, "")
      if (redirect) {
        const target = resolvePath(cwd, redirect)
        os.writeFile(target, text.endsWith("\n") ? text : `${text}\n`, space)
        os.notify("File updated", baseName(target))
      } else out.push(text)
    } else if (cmd === "clear") {
      setLines([])
      return
    } else {
      out.push(`${cmd}: command not found`)
    }

    setLines((prev) => [...prev, shown, ...out.filter((item) => item !== "")])
  }

  return (
    <form
      className="terminal"
      onSubmit={(event) => {
        event.preventDefault()
        run(value)
        setValue("")
      }}
    >
      <div className="term-log">
        {lines.map((line, index) => (
          <pre key={`${index}-${line.slice(0, 12)}`}>{line}</pre>
        ))}
        <div ref={end} />
      </div>
      <label className="prompt">
        <span>{cwd}</span>
        <em>$</em>
        <input
          value={value}
          aria-label="Terminal input"
          spellCheck={false}
          autoCapitalize="off"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            run(value)
            setValue("")
          }}
        />
      </label>
    </form>
  )
}

function Editor({ path, space }: { path: string; space: Space }) {
  const os = useOs()
  const file = os.filesFor(space)[path] ?? ""
  const [draft, setDraft] = useState(file)
  const [source, setSource] = useState(file)
  if (file !== source) {
    setSource(file)
    setDraft(file)
  }

  const dirty = draft !== file

  return (
    <div className="editor">
      <div className="editor-bar">
        <span>{dirty ? `${baseName(path)} ·` : baseName(path)}</span>
        <button
          type="button"
          className="primary"
          disabled={!dirty}
          onClick={() => {
            os.writeFile(path, draft, space)
            os.notify("Saved", baseName(path))
          }}
        >
          Save
        </button>
      </div>
      <textarea
        value={draft}
        spellCheck={false}
        aria-label="Editor"
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  )
}

function Settings() {
  const os = useOs()
  const [page, setPage] = useState<"appearance" | "cluster">("appearance")
  return (
    <div className="settings settings-shell">
      <nav className="settings-nav" aria-label="Settings">
        <button type="button" className={page === "appearance" ? "on" : ""} onClick={() => setPage("appearance")}>
          <Glyph name="appearance" size={16} />
          Appearance
        </button>
        <button type="button" className={page === "cluster" ? "on" : ""} onClick={() => setPage("cluster")}>
          <Glyph name="network" size={16} />
          Network
        </button>
      </nav>
      <div className="settings-main">
        {page === "appearance" && (
          <section>
            <h2>Appearance</h2>
            <p className="muted">Mode and accent for this desktop.</p>
            <div className="segment" role="radiogroup" aria-label="Theme" style={{ marginTop: 12 }}>
              <button
                type="button"
                role="radio"
                aria-checked={os.theme === "light"}
                className={os.theme === "light" ? "on" : ""}
                onClick={() => os.setTheme("light")}
              >
                Light
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={os.theme === "dark"}
                className={os.theme === "dark" ? "on" : ""}
                onClick={() => os.setTheme("dark")}
              >
                Dark
              </button>
            </div>
            <div className="segment" role="radiogroup" aria-label="Accent" style={{ marginTop: 12 }}>
              <button
                type="button"
                role="radio"
                aria-checked={os.accent === "violet"}
                className={os.accent === "violet" ? "on" : ""}
                onClick={() => os.setAccent("violet")}
              >
                Blue
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={os.accent === "green"}
                className={os.accent === "green" ? "on" : ""}
                onClick={() => os.setAccent("green")}
              >
                Green
              </button>
            </div>
          </section>
        )}
        {page === "cluster" && (
          <section>
            <h2>Network</h2>
            <div className="segment" role="radiogroup" aria-label="Cluster" style={{ marginTop: 12 }}>
              {CLUSTERS.map((cluster) => (
                <button
                  key={cluster.id}
                  type="button"
                  role="radio"
                  aria-checked={os.cluster === cluster.id}
                  className={os.cluster === cluster.id ? "on" : ""}
                  onClick={() => os.setCluster(cluster.id)}
                >
                  {cluster.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 16 }}>
              Mainnet actions should be confirmed before they are sent. OsPad starts on devnet.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

function toAddress(input: string): string {
  const text = input.trim()
  if (!text) return ""
  if (/^https?:\/\//i.test(text)) return text
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(text)) return `https://${text}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`
}

function Browser({ win }: { win: Win }) {
  const os = useOs()
  const hole = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState("")
  const [stack, setStack] = useState<{ entries: string[]; index: number }>({ entries: [], index: -1 })
  const current = stack.index >= 0 ? stack.entries[stack.index] : ""
  const desktop = Boolean(window.solanaOs)

  const visit = (input: string) => {
    const next = toAddress(input)
    if (!next) return
    const verdict = inspectUrl(next)
    if (!verdict.ok) {
      os.notify("Blocked", verdict.warning)
      return
    }
    setDraft(next)
    window.solanaOs?.browser.navigate(next)
    setStack((prev) => {
      const entries = prev.entries.slice(0, prev.index + 1)
      entries.push(next)
      return { entries, index: entries.length - 1 }
    })
  }

  const go = (index: number) => {
    const next = stack.entries[index]
    if (!next) return
    setDraft(next)
    window.solanaOs?.browser.navigate(next)
    setStack((prev) => ({ ...prev, index }))
  }

  useEffect(() => {
    const bridge = window.solanaOs
    if (!bridge) return
    bridge.browser.onUrl((url) => {
      if (url.startsWith("http://") || url.startsWith("https://")) setDraft(url)
    })
    bridge.browser.onWarning?.((warning) => os.notify("Blocked", warning))
  }, [])

  useEffect(() => {
    const bridge = window.solanaOs
    const node = hole.current
    if (!bridge || !node) return
    let last = ""
    let frame = 0
    const tick = () => {
      const visible = Boolean(current) && os.activeId === win.id && !win.minimized
      const rect = node.getBoundingClientRect()
      const bounds = {
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      }
      const show = visible && bounds.width > 0 && bounds.height > 0
      const key = `${show}:${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`
      if (key !== last) {
        last = key
        bridge.browser.sync({ show, bounds })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      bridge.browser.sync({ show: false, bounds: { x: 0, y: 0, width: 0, height: 0 } })
    }
  }, [current, os.activeId, win.id, win.minimized])

  return (
    <div className="browser">
      <div className="browser-bar">
        <button type="button" className="nav" aria-label="Back" disabled={stack.index <= 0} onClick={() => go(stack.index - 1)}>
          ‹
        </button>
        <button
          type="button"
          className="nav"
          aria-label="Forward"
          disabled={stack.index >= stack.entries.length - 1}
          onClick={() => go(stack.index + 1)}
        >
          ›
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            visit(draft)
          }}
        >
          <input
            value={draft}
            placeholder="Search or enter an address"
            aria-label="Address"
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              visit(draft)
            }}
          />
        </form>
      </div>
      <div ref={hole} className="browser-frame">
        {!current && (
          <div className="browser-start">
            <Mark size={48} />
            <p>
              {desktop
                ? "Pages load in this window as their own document. Enter an address to open a site."
                : "This tab cannot host the browser. Open the OsPad application to load sites inside the desktop."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function About() {
  return (
    <div className="about">
      <Mark size={56} />
      <h2>OsPad</h2>
      <span>Version 0.2.0</span>
      <p>A Solana desktop. Windows, files, and wallets share one session in the browser.</p>
    </div>
  )
}
