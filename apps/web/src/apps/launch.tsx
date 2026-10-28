import { useMemo, useState, type ChangeEvent } from "react"
import { SAMPLE_FEE_SOL } from "../os/mock"
import { useOs } from "../os/store"
import { AppHead, AppPage, Field, SampleBadge } from "./ui"

type Stage = "edit" | "preview" | "done"

export function LaunchStudio() {
  const os = useOs()
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [description, setDescription] = useState("")
  const [supply, setSupply] = useState("1000000000")
  const [decimals, setDecimals] = useState("6")
  const [mintAuth, setMintAuth] = useState(true)
  const [freezeAuth, setFreezeAuth] = useState(false)
  const [updateAuth, setUpdateAuth] = useState(true)
  const [image, setImage] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>("edit")
  const [error, setError] = useState("")

  const parsed = useMemo(() => {
    const supplyValue = Number(supply)
    const decimalValue = Number(decimals)
    return { supplyValue, decimalValue }
  }, [supply, decimals])

  const validate = () => {
    if (name.trim().length < 1 || name.trim().length > 32) return "Name must be 1–32 characters."
    if (!/^[A-Za-z0-9]{2,10}$/.test(symbol.trim())) return "Symbol must be 2–10 letters or numbers."
    if (!Number.isFinite(parsed.supplyValue) || parsed.supplyValue <= 0) return "Supply must be greater than zero."
    if (!Number.isInteger(parsed.decimalValue) || parsed.decimalValue < 0 || parsed.decimalValue > 9) {
      return "Decimals must be a whole number from 0 to 9."
    }
    return ""
  }

  const onImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const preview = () => {
    const next = validate()
    setError(next)
    if (next) return
    setStage("preview")
  }

  const confirm = () => {
    setStage("done")
    os.notify("Launch preview stored", "No transaction was sent.")
  }

  return (
    <AppPage>
      <AppHead title="Launch Studio" aside={<SampleBadge>Mock mode</SampleBadge>}>
        <p>Prepare a token. Nothing is submitted to Solana from this form.</p>
      </AppHead>
      <div className="scroll-pane">
        {stage === "edit" && (
          <>
            <div className="form-grid">
              <Field label="Token name">
                <input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Symbol">
                <input value={symbol} maxLength={10} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <Field label="Token image">
              <input type="file" accept="image/*" onChange={onImage} />
            </Field>
            {image && <img className="preview-art" src={image} alt="" />}
            <div className="form-grid">
              <Field label="Supply">
                <input value={supply} inputMode="numeric" onChange={(event) => setSupply(event.target.value)} />
              </Field>
              <Field label="Decimals">
                <input value={decimals} inputMode="numeric" onChange={(event) => setDecimals(event.target.value)} />
              </Field>
            </div>
            <div className="panel-card">
              <p className="kicker">Authorities</p>
              <label className="field">
                <span>
                  <input type="checkbox" checked={mintAuth} onChange={(event) => setMintAuth(event.target.checked)} /> Mint
                </span>
              </label>
              <label className="field">
                <span>
                  <input type="checkbox" checked={freezeAuth} onChange={(event) => setFreezeAuth(event.target.checked)} /> Freeze
                </span>
              </label>
              <label className="field">
                <span>
                  <input type="checkbox" checked={updateAuth} onChange={(event) => setUpdateAuth(event.target.checked)} /> Update
                </span>
              </label>
            </div>
            <div className="fee-box">
              Estimated fee {SAMPLE_FEE_SOL.toFixed(3)} SOL · sample
              <div>Creator rewards stay off until a launchpad is connected.</div>
            </div>
            {error && (
              <div className="state-box">
                <strong>Check the form</strong>
                <p>{error}</p>
              </div>
            )}
            <button type="button" className="primary wide" onClick={preview}>
              Review token
            </button>
          </>
        )}
        {stage === "preview" && (
          <>
            <div className="panel-card">
              <strong>{name}</strong> · {symbol}
              <p className="muted">{description || "No description"}</p>
              <p className="muted">
                Supply {parsed.supplyValue.toLocaleString("en-US")} · {parsed.decimalValue} decimals
              </p>
              <p className="muted">
                Mint {mintAuth ? "on" : "off"} · Freeze {freezeAuth ? "on" : "off"} · Update {updateAuth ? "on" : "off"}
              </p>
            </div>
            <div className="state-box">
              <strong>Confirmation</strong>
              <p>This is a preview. Confirming stores the draft in this session and does not send a transaction.</p>
            </div>
            <button type="button" className="primary wide" onClick={confirm}>
              Confirm draft
            </button>
            <button type="button" className="ghost wide" onClick={() => setStage("edit")}>
              Edit
            </button>
          </>
        )}
        {stage === "done" && (
          <>
            <div className="state-box">
              <strong>Draft saved</strong>
              <p>No transaction was sent. Connect a launch program later to publish {symbol || "this token"}.</p>
            </div>
            <button
              type="button"
              className="ghost wide"
              onClick={() => {
                setStage("edit")
                setError("")
              }}
            >
              New draft
            </button>
          </>
        )}
      </div>
    </AppPage>
  )
}
