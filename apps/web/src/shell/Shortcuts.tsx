import { DESKTOP_SHORTCUTS, appName, type AppId } from "../apps/meta"
import { AppIcon } from "../icons"
import { useOs } from "../os/store"

export function Shortcuts() {
  const os = useOs()
  const ids: AppId[] = ["vault", ...DESKTOP_SHORTCUTS.filter((id) => id !== "vault")]
  return (
    <div className="shortcuts" onPointerDown={(event) => event.stopPropagation()}>
      {ids.map((id) => (
        <button key={id} type="button" className="shortcut" onClick={() => os.openApp(id)}>
          <AppIcon id={id} size={36} />
          <span>{appName(id)}</span>
        </button>
      ))}
    </div>
  )
}
