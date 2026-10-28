import { useEffect, useState } from "react"
import { Mark } from "../icons"
import { useOs } from "../os/store"
import { adoptAddress, createVault, unlockVault, useVault } from "../os/vault"

export function Lock() {
  const os = useOs()
  const vault = useVault()
  const desktop = Boolean(window.solanaOs?.space)
  const [created, setCreated] = useState<boolean | null>(desktop ? null : Boolean(vault.address))
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const bridge = window.solanaOs?.space
    if (!bridge) return
    void bridge.status().then((result) => setCreated(result.created))
  }, [])

  const submit = async () => {
    if (created === null) return
    setBusy(true)
    setError("")
    if (desktop && window.solanaOs) {
      const result = created
        ? await window.solanaOs.space.unlock(passphrase)
        : await window.solanaOs.space.create(passphrase)
      setBusy(false)
      if (!result.ok) {
        setError(result.error || "Could not open this OS.")
        return
      }
      adoptAddress(result.address ?? null, true)
      if (result.files) os.hydrateFiles(result.files)
      else os.markUnlocked()
      return
    }
    const result = created ? await unlockVault(passphrase) : await createVault(passphrase)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    os.markUnlocked()
  }

  return (
    <form
      className="lock"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Mark size={72} />
      <h1>Solana OS</h1>
      <p>This is the upper OS. Windows stays underneath, with its own files.</p>
      {created === null ? (
        <p>Checking the lock…</p>
      ) : (
        <>
          <input
            type="password"
            value={passphrase}
            autoFocus
            autoComplete={created ? "current-password" : "new-password"}
            aria-label="Passphrase"
            placeholder={created ? "Passphrase" : "Create a passphrase"}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          {error && <p className="down">{error}</p>}
          <button type="submit" className="primary" disabled={busy || passphrase.length < 8}>
            {busy ? "Opening…" : created ? "Unlock" : "Create this OS"}
          </button>
          {!desktop && <p>The desktop app adds post-quantum encryption. Windows apps are listed in Apps.</p>}
        </>
      )}
    </form>
  )
}
