import { DOCK_PINS, appName, type AppId } from "../apps/meta"
import { AppIcon } from "../icons"
import { useOs } from "../os/store"

export function Dock() {
  const os = useOs()
  const here = os.windows.filter((win) => win.space === os.space)
  const pins: AppId[] = ["vault", ...DOCK_PINS.filter((id) => id !== "vault")]
  const extras = here
    .map((win) => win.app)
    .filter((id, index, list) => !pins.includes(id) && list.indexOf(id) === index)
  const ids: AppId[] = [...pins, ...extras]

  const activate = (id: AppId) => {
    const win = here.find((item) => item.app === id)
    if (!win) {
      os.openApp(id)
      return
    }
    if (os.activeId === win.id && !win.minimized && win.workspace === os.workspace) {
      os.minimizeWindow(win.id)
      return
    }
    os.focusWindow(win.id)
  }

  return (
    <nav className="dock" onPointerDown={(event) => event.stopPropagation()} aria-label="Dock">
      {ids.map((id) => {
        const win = here.find((item) => item.app === id)
        const on = Boolean(win && os.activeId === win.id && !win.minimized && win.workspace === os.workspace)
        return (
          <button
            key={id}
            type="button"
            className={on ? "dock-item on" : "dock-item"}
            title={appName(id)}
            aria-label={appName(id)}
            onClick={() => activate(id)}
          >
            <AppIcon id={id} size={50} />
            {win && <i />}
          </button>
        )
      })}
      <div className="dock-spaces" role="group" aria-label="Workspaces">
        {([1, 2] as const).map((space) => (
          <button
            key={space}
            type="button"
            className={os.workspace === space ? "space-btn on" : "space-btn"}
            aria-pressed={os.workspace === space}
            onClick={() => os.setWorkspace(space)}
          >
            {space}
          </button>
        ))}
      </div>
    </nav>
  )
}
