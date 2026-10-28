import { useOs } from "../os/store"

function when(time: number): string {
  const seconds = Math.round((Date.now() - time) / 1000)
  if (seconds < 15) return "Just now"
  if (seconds < 60) return `${seconds}s ago`
  return new Date(time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function Notifications() {
  const os = useOs()
  return (
    <aside className="notes" onPointerDown={(event) => event.stopPropagation()} aria-label="Notifications">
      <header>
        <strong>Notifications</strong>
      </header>
      {os.notes.length === 0 && <p>No notifications</p>}
      <ul>
        {os.notes.map((note) => (
          <li key={note.id}>
            <strong>{note.title}</strong>
            <span>{note.body}</span>
            <small>{when(note.time)}</small>
          </li>
        ))}
      </ul>
    </aside>
  )
}
