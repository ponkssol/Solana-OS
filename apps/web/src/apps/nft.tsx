import { useState } from "react"
import { SAMPLE_NFTS } from "../os/mock"
import { useOs } from "../os/store"
import { AppHead, AppPage, EmptyState, SampleBadge } from "./ui"

export function NftManager() {
  const os = useOs()
  const [hidden, setHidden] = useState<string[]>([])
  const items = SAMPLE_NFTS.filter((item) => !hidden.includes(item.id))

  return (
    <AppPage>
      <AppHead title="NFT Manager" aside={<SampleBadge />}>
        <p>Collectibles in this session. Nothing is minted or transferred.</p>
      </AppHead>
      {items.length === 0 && (
        <EmptyState title="No collectibles" body="The sample set is hidden. Restore it to keep working here." />
      )}
      <div className="nft-grid">
        {items.map((item) => (
          <article key={item.id} className="nft-card">
            <div className="nft-art" style={{ background: item.tone }} />
            <b>{item.name}</b>
            <p className="muted">{item.collection}</p>
            <button
              type="button"
              className="ghost wide"
              onClick={() => {
                setHidden((prev) => [...prev, item.id])
                os.notify("Hidden", `${item.name} is hidden in this window.`)
              }}
            >
              Hide
            </button>
          </article>
        ))}
      </div>
      {hidden.length > 0 && (
        <button type="button" className="soft" onClick={() => setHidden([])}>
          Restore sample set
        </button>
      )}
    </AppPage>
  )
}
