import { useState } from "react"
import { inspectSign } from "../os/guard"
import { shortenAddress } from "../os/network"
import { useOs } from "../os/store"
import { approveRequest, createVault, denyRequest, lockVault, unlockVault, useVault } from "../os/vault"
import { AppHead, AppPage, Field } from "./ui"

export function Vault() {
  const os = useOs()
  const vault = useVault()
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const frozen = os.frozen.includes("vault")

  const submit = async () => {
    setBusy(true)
    setError("")
    const result = vault.address ? await unlockVault(passphrase) : await createVault(passphrase)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPassphrase("")
    os.notify(vault.address ? "Vault unlocked" : "Vault created", "The key stays in Island.")
  }

  return (
    <AppPage>
      <AppHead title="Vault" aside={<span className="badge-live">Island</span>}>
        <p>The key stays in this OS. Windows does not receive it.</p>
      </AppHead>
      <div className="scroll-pane">
        {frozen && (
          <div className="state-box">
            <strong>Vault is frozen</strong>
            <p>Unfreeze Vault from the Island app list. The key stays encrypted until then.</p>
          </div>
        )}
        {!frozen && !vault.address && (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <p className="muted">
              Create the Island key. It is encrypted in this browser and is not written into Mainland files.
            </p>
            <Field label="Passphrase">
              <input
                type="password"
                value={passphrase}
                autoComplete="new-password"
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </Field>
            {error && <p className="down">{error}</p>}
            <button type="submit" className="primary wide" disabled={busy || passphrase.length < 8}>
              {busy ? "Creating…" : "Create Island key"}
            </button>
          </form>
        )}
        {!frozen && vault.address && !vault.unlocked && (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <p className="kicker">Public address</p>
            <p className="mono address-line">{vault.address}</p>
            <p className="muted">The key is locked. Unlock it here to approve a signature.</p>
            <Field label="Passphrase">
              <input
                type="password"
                value={passphrase}
                autoComplete="current-password"
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </Field>
            {error && <p className="down">{error}</p>}
            <button type="submit" className="primary wide" disabled={busy || passphrase.length < 8}>
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </form>
        )}
        {!frozen && vault.unlocked && vault.address && (
          <div className="stack">
            <p className="kicker">Unlocked</p>
            <p className="mono address-line">{shortenAddress(vault.address)}</p>
            <p className="muted">
              Lock or freeze drops the key from memory. A compromised operating system can still read an unlocked vault.
            </p>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                lockVault()
                os.notify("Vault locked", "The key is out of memory.")
              }}
            >
              Lock
            </button>
          </div>
        )}
        <div className="panel-card">
          <p className="kicker">Signature requests</p>
          {vault.requests.length === 0 && <p className="muted">No signature requests.</p>}
          <ul className="request-list">
            {vault.requests.map((item) => {
              const warnings = inspectSign(item.message)
              return (
              <li key={item.id}>
                <b>{item.label}</b>
                <p className="muted">{item.message}</p>
                {warnings.map((warning) => (
                  <p key={warning} className="down">{warning}</p>
                ))}
                {item.status === "pending" && (
                  <div className="action-row">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        void approveRequest(item.id, warnings.length > 0).then((result) => {
                          if (result === "locked") setError("Unlock the vault before signing.")
                          if (result === "review") setError("Review the warning, then sign again.")
                        })
                      }}
                    >
                      {warnings.length > 0 ? "Sign anyway" : "Sign"}
                    </button>
                    <button type="button" className="ghost" onClick={() => denyRequest(item.id)}>
                      Deny
                    </button>
                  </div>
                )}
                {item.status === "signed" && <p className="mono address-line">{item.signature}</p>}
                {item.status === "denied" && <p className="muted">Denied</p>}
              </li>
              )
            })}
          </ul>
        </div>
      </div>
    </AppPage>
  )
}
