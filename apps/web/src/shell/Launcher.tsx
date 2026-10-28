import { useEffect, useState } from "react"
import { APPS, appName, type AppId } from "../apps/meta"
import { AppIcon } from "../icons"
import { useOs } from "../os/store"

type HostApp = {
  id: string
  name: string
  kind: "exe" | "store"
  cloned: boolean
  frozen: boolean
  running: boolean
}

export function Launcher() {
  const os = useOs()
  return (
    <div className="overlay" onPointerDown={() => os.setLauncher(false)}>
      <div className="launcher" onPointerDown={(event) => event.stopPropagation()}>
        <div className="launcher-intro">
          <strong>Apps</strong>
          <p>Built-in apps open here. Windows apps can be cloned into this OS, with a separate folder.</p>
        </div>
        {APPS.map((app) => (
          <LaunchTile key={app.id} id={app.id} />
        ))}
        <HostApps />
      </div>
    </div>
  )
}

function LaunchTile({ id }: { id: AppId }) {
  const os = useOs()
  const frozen = os.frozen.includes(id)
  return (
    <div className={frozen ? "launch is-frozen" : "launch"}>
      <button type="button" className="launch-open" disabled={frozen} onClick={() => os.openApp(id)}>
        <AppIcon id={id} size={52} />
        <span>{appName(id)}</span>
      </button>
      <div className="launch-actions">
        <button type="button" onClick={() => (frozen ? os.thawApp(id) : os.freezeApp(id))}>
          {frozen ? "Unfreeze" : "Freeze"}
        </button>
      </div>
    </div>
  )
}

async function hostList(): Promise<{ available: boolean; apps: HostApp[] }> {
  if (window.solanaOs?.host) return window.solanaOs.host.list()
  const response = await fetch("/api/host/apps")
  return response.json() as Promise<{ available: boolean; apps: HostApp[] }>
}

function hostAction(name: "clone" | "open" | "freeze" | "thaw" | "remove", id: string) {
  if (window.solanaOs?.host) return window.solanaOs.host[name](id)
  return fetch(`/api/host/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  }).then((response) => response.json() as Promise<{ ok: boolean; error?: string }>)
}

function HostApps() {
  const os = useOs()
  const [apps, setApps] = useState<HostApp[] | null>(null)
  const [note, setNote] = useState("")

  const refresh = async () => {
    try {
      const result = await hostList()
      setApps(result.apps)
      setNote(result.available ? "" : "Windows app cloning runs on Windows.")
    } catch {
      setApps([])
      setNote("Installed apps could not be read. Restart the dev server, then open Apps again.")
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const run = async (action: Promise<{ ok: boolean; error?: string }>) => {
    const result = await action
    if (!result.ok && result.error) os.notify("Windows app", result.error)
    await refresh()
  }

  return (
    <div className="host-apps">
      <strong>Installed on Windows</strong>
      {note && <p>{note}</p>}
      {apps === null && <p>Reading installed apps…</p>}
      {apps?.length === 0 && !note && <p>No installed apps were found.</p>}
      <ul>
        {apps?.map((app) => (
          <li key={app.id}>
            <span>{app.name}</span>
            <span className="launch-actions">
              {!app.cloned && (
                <button type="button" onClick={() => void run(hostAction("clone", app.id))}>
                  Clone
                </button>
              )}
              {app.cloned && (
                <button type="button" disabled={app.frozen} onClick={() => void run(hostAction("open", app.id))}>
                  Open
                </button>
              )}
              {app.cloned && (
                <button
                  type="button"
                  onClick={() => void run(app.frozen ? hostAction("thaw", app.id) : hostAction("freeze", app.id))}
                >
                  {app.frozen ? "Unfreeze" : "Freeze"}
                </button>
              )}
              {app.cloned && (
                <button type="button" onClick={() => void run(hostAction("remove", app.id))}>
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
