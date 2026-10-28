import { Boot } from "./shell/Boot"
import { Desktop } from "./shell/Desktop"
import { Lock } from "./shell/Lock"
import { OsProvider, useOs } from "./os/store"

function Shell() {
  const { booted, unlocked } = useOs()
  if (!booted) return <Boot />
  if (!unlocked) return <Lock />
  return <Desktop />
}

export default function App() {
  return (
    <OsProvider>
      <Shell />
    </OsProvider>
  )
}
