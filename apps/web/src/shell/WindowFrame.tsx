import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { APP_MIN, appName } from "../apps/meta"
import { Glyph } from "../icons"
import { baseName } from "../os/fs"
import { DOCK_H, PANEL_H, useOs, type Win } from "../os/store"

export function windowTitle(win: Win): string {
  if (win.app === "editor") return baseName(win.path ?? "/Welcome.txt")
  return appName(win.app)
}

export function WindowFrame({ win, children }: { win: Win; children: ReactNode }) {
  const os = useOs()
  const hidden = win.minimized || win.workspace !== os.workspace || win.space !== os.space
  const active = os.activeId === win.id && !hidden
  const frame = useRef<HTMLElement>(null)
  const min = APP_MIN[win.app]

  useEffect(() => {
    if (active) frame.current?.focus()
  }, [active, win.id])

  const onTitlePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("button")) return
    os.focusWindow(win.id)
    if (win.maximized) return
    const startX = event.clientX
    const startY = event.clientY
    const originX = win.x
    const originY = win.y
    const move = (ev: PointerEvent) => {
      const x = originX + ev.clientX - startX
      const y = originY + ev.clientY - startY
      os.moveWindow(
        win.id,
        Math.min(window.innerWidth - 140, Math.max(-win.w + 160, x)),
        Math.min(window.innerHeight - DOCK_H, Math.max(PANEL_H, y)),
      )
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const onResize = (event: ReactPointerEvent<HTMLDivElement>, edge: "e" | "s" | "se") => {
    event.stopPropagation()
    event.preventDefault()
    os.focusWindow(win.id)
    const startX = event.clientX
    const startY = event.clientY
    const originW = win.w
    const originH = win.h
    const move = (ev: PointerEvent) => {
      const w = edge === "s" ? originW : Math.max(min.w, Math.min(window.innerWidth - win.x - 8, originW + ev.clientX - startX))
      const h = edge === "e" ? originH : Math.max(min.h, Math.min(window.innerHeight - win.y - 8, originH + ev.clientY - startY))
      os.resizeWindow(win.id, w, h)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <section
      ref={frame}
      className={hidden ? "window is-min" : active ? "window is-active" : "window"}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      tabIndex={-1}
      aria-label={windowTitle(win)}
      aria-hidden={hidden}
      onPointerDown={(event) => {
        event.stopPropagation()
        os.focusWindow(win.id)
      }}
    >
      <header
        className="titlebar"
        onPointerDown={onTitlePointer}
        onDoubleClick={() => os.maximizeWindow(win.id)}
      >
        <Glyph name={win.app} size={16} />
        <span>{windowTitle(win)}</span>
        <div className="win-controls">
          <button type="button" className="win-ctrl" aria-label="Minimize" onClick={() => os.minimizeWindow(win.id)}>
            <i />
          </button>
          <button type="button" className="win-ctrl" aria-label="Maximize" onClick={() => os.maximizeWindow(win.id)}>
            <b />
          </button>
          <button type="button" className="win-ctrl close" aria-label="Close" onClick={() => os.closeWindow(win.id)}>
            <s />
          </button>
        </div>
      </header>
      <div className="window-body">{children}</div>
      {!win.maximized && (
        <>
          <div className="resize e" onPointerDown={(event) => onResize(event, "e")} />
          <div className="resize s" onPointerDown={(event) => onResize(event, "s")} />
          <div className="resize se" onPointerDown={(event) => onResize(event, "se")} />
        </>
      )}
    </section>
  )
}
