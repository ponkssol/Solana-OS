import { useState } from "react"
import { SAMPLE_FEE_SOL } from "../os/mock"
import { useOs } from "../os/store"
import { AppHead, AppPage, Field, SampleBadge } from "./ui"

const CHAINS = ["Solana", "Ethereum", "Base"]

export function Bridge() {
  const os = useOs()
  const [from, setFrom] = useState("Solana")
  const [to, setTo] = useState("Ethereum")
  const [amount, setAmount] = useState("1")
  const [stage, setStage] = useState<"edit" | "preview" | "done" | "error">("edit")
  const [note, setNote] = useState("")

  const preview = () => {
    const value = Number(amount)
    if (from === to) {
      setStage("error")
      setNote("Choose two different networks.")
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setStage("error")
      setNote("Enter an amount greater than zero.")
      return
    }
    setStage("preview")
    setNote(`Sample route ${from} → ${to} for ${value} SOL. Fee ${SAMPLE_FEE_SOL} SOL.`)
  }

  return (
    <AppPage>
      <AppHead title="Bridge" aside={<SampleBadge>Mock mode</SampleBadge>}>
        <p>Preview a route. No funds move until a bridge is connected.</p>
      </AppHead>
      <Field label="From">
        <select value={from} onChange={(event) => setFrom(event.target.value)}>
          {CHAINS.map((chain) => (
            <option key={chain}>{chain}</option>
          ))}
        </select>
      </Field>
      <Field label="To">
        <select value={to} onChange={(event) => setTo(event.target.value)}>
          {CHAINS.map((chain) => (
            <option key={chain}>{chain}</option>
          ))}
        </select>
      </Field>
      <Field label="Amount">
        <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
      </Field>
      {note && (
        <div className="state-box">
          <strong>{stage}</strong>
          <p>{note}</p>
        </div>
      )}
      {stage !== "done" && (
        <button type="button" className="primary wide" onClick={stage === "preview" ? () => {
          setStage("done")
          setNote("No bridge transfer was sent.")
          os.notify("Bridge preview", "No transfer was sent.")
        } : preview}>
          {stage === "preview" ? "Confirm preview" : "Preview route"}
        </button>
      )}
      {stage !== "edit" && (
        <button type="button" className="ghost wide" onClick={() => { setStage("edit"); setNote("") }}>
          Reset
        </button>
      )}
    </AppPage>
  )
}
