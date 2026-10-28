import { useEffect } from "react"
import { Mark } from "../icons"
import { useOs } from "../os/store"

export function Boot() {
  const { finishBoot } = useOs()

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const timer = window.setTimeout(finishBoot, reduce ? 240 : 1700)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") finishBoot()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
    }
  }, [finishBoot])

  return (
    <button className="boot" type="button" onClick={finishBoot}>
      <Mark size={72} />
      <h1>OsPad</h1>
      <p>Solana desktop</p>
      <span className="boot-bar" aria-hidden="true">
        <span />
      </span>
    </button>
  )
}
