import { useEffect } from "react"
import { AppView } from "../apps/views"
import { useOs } from "../os/store"
import { Dock } from "./Dock"
import { Launcher } from "./Launcher"
import { Notifications } from "./Notifications"
import { Panel } from "./Panel"
import { Search } from "./Search"
import { Shortcuts } from "./Shortcuts"
import { Widgets } from "./Widgets"
import { WindowFrame } from "./WindowFrame"

export function Desktop() {
  const os = useOs()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        os.setSearch(!os.searchOpen)
        return
      }
      if (event.altKey && event.key === "1") {
        event.preventDefault()
        os.setWorkspace(1)
        return
      }
      if (event.altKey && event.key === "2") {
        event.preventDefault()
        os.setWorkspace(2)
        return
      }
      if (event.key === "Escape") os.dismissOverlays()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [os])

  return (
    <div className="desktop" data-accent={os.accent} data-theme={os.theme} data-space={os.space} onPointerDown={() => os.blur()}>
      <div className="wallpaper" />
      <Shortcuts />
      <Widgets />
      {os.windows.map((win) => (
        <WindowFrame key={win.id} win={win}>
          <AppView win={win} />
        </WindowFrame>
      ))}
      <Panel />
      <Dock />
      {os.launcherOpen && <Launcher />}
      {os.searchOpen && <Search />}
      {os.notesOpen && <Notifications />}
    </div>
  )
}
