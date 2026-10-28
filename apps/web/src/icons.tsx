import type { ReactNode } from "react"
import type { AppId } from "./apps/meta"

export function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#3B9EFF" />
      <path
        d="M22.2 11.2H13.4c-1.7 0-2.8 1.1-2.8 2.5s1.1 2.4 2.8 2.4h5.2c1.7 0 2.8 1.1 2.8 2.5s-1.1 2.5-2.8 2.5H9.8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="20.5" y="22.6" width="5.2" height="3.1" rx="1" fill="#FFFFFF" />
    </svg>
  )
}

function stroke() {
  return {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.55,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
}

export type GlyphName = AppId | "search" | "bell" | "appearance" | "network"

export function Glyph({
  name,
  size = 22,
}: {
  name: GlyphName
  size?: number
}) {
  const p = stroke()
  let body: ReactNode = null
  if (name === "home") {
    body = (
      <>
        <path {...p} d="M4.6 11.2 12 5.4l7.4 5.8" />
        <path {...p} d="M7.2 10.6V18.6h9.6v-8" />
        <path {...p} d="M10.4 18.6v-4.2h3.2v4.2" />
      </>
    )
  } else if (name === "files") {
    body = (
      <path
        {...p}
        d="M4.4 9.1h5.8l1.7 1.8h7.7v8.1H4.4V9.1Zm0 0V7.4h5l1.4 1.7"
      />
    )
  } else if (name === "terminal") {
    body = (
      <>
        <path {...p} d="M6.6 8.8 10.6 12 6.6 15.2" />
        <path {...p} d="M12.4 16.4h5.2" />
      </>
    )
  } else if (name === "editor") {
    body = (
      <>
        <path {...p} d="M7.2 4.8h6.6L18 9.1v10.1a1.4 1.4 0 0 1-1.4 1.4H7.2A1.4 1.4 0 0 1 5.8 19.2V6.2A1.4 1.4 0 0 1 7.2 4.8Z" />
        <path {...p} d="M13.6 4.9V9h4.2" />
        <path {...p} d="M8.4 12.6h6.6M8.4 15.6h4.4" />
      </>
    )
  } else if (name === "browser") {
    body = (
      <>
        <circle {...p} cx="12" cy="12" r="7" />
        <path {...p} d="M12 5.2c1.9 2.1 2.9 4.3 2.9 6.8s-1 4.7-2.9 6.8c-1.9-2.1-2.9-4.3-2.9-6.8s1-4.7 2.9-6.8Z" />
        <path {...p} d="M5.2 12h13.6" />
      </>
    )
  } else if (name === "wallet") {
    body = (
      <>
        <rect {...p} x="3.8" y="6.8" width="16.4" height="11.2" rx="2.2" />
        <path {...p} d="M3.8 10.2h16.4" />
        <circle {...p} cx="16.2" cy="14.2" r="1" />
      </>
    )
  } else if (name === "swap") {
    body = (
      <>
        <path {...p} d="M7 9h10.2M14.4 6.4 17.2 9l-2.8 2.5" />
        <path {...p} d="M17 15.2H6.8M9.6 12.6 6.8 15.2l2.8 2.5" />
      </>
    )
  } else if (name === "launch") {
    body = (
      <>
        <path {...p} d="M12 19.4V7.4M8.6 10.6 12 7.2l3.4 3.4" />
        <path {...p} d="M8.2 19.4h7.6" />
      </>
    )
  } else if (name === "dex") {
    body = (
      <>
        <path {...p} d="M5 18.2V6.2M5 18.2h14" />
        <path {...p} d="m5.4 14.2 3.8-3.8 3 2.2 6.2-6" />
      </>
    )
  } else if (name === "portfolio") {
    body = (
      <>
        <circle {...p} cx="12" cy="12" r="7" />
        <path {...p} d="M12 5v7h7" />
      </>
    )
  } else if (name === "explorer" || name === "search") {
    body = (
      <>
        <circle {...p} cx="11" cy="11" r="5.1" />
        <path {...p} d="m15.1 15.1 3.5 3.5" />
      </>
    )
  } else if (name === "nft") {
    body = (
      <>
        <rect {...p} x="4.6" y="6.4" width="14.8" height="11.4" rx="2" />
        <path {...p} d="m5 15.4 3.8-3.4 3.2 2.4 2.2-1.8 4.6 3.8" />
        <circle {...p} cx="9.1" cy="10" r="1" />
      </>
    )
  } else if (name === "bridge") {
    body = <path {...p} d="M5 15.6c3.4-5.1 10.6-5.1 14 0M7.4 12.2 5 15.6l3.2.1M16.6 12.2 19 15.6l-3.2.1" />
  } else if (name === "settings") {
    body = (
      <>
        <circle {...p} cx="12" cy="12" r="2.4" />
        <path
          {...p}
          d="M10.2 3.9h3.6l.4 2 1.9.8 1.8-1.1 2.5 2.5-1.1 1.8.8 1.9 2 .4v3.6l-2 .4-.8 1.9 1.1 1.8-2.5 2.5-1.8-1.1-1.9.8-.4 2h-3.6l-.4-2-1.9-.8-1.8 1.1-2.5-2.5 1.1-1.8-.8-1.9-2-.4V10.2l2-.4.8-1.9-1.1-1.8 2.5-2.5 1.8 1.1 1.9-.8Z"
        />
      </>
    )
  } else if (name === "about") {
    body = (
      <>
        <circle {...p} cx="12" cy="12" r="7" />
        <path {...p} d="M12 11.1V16.4" />
        <circle cx="12" cy="8.4" r="0.8" fill="currentColor" />
      </>
    )
  } else if (name === "vault") {
    body = (
      <>
        <rect {...p} x="6" y="10.4" width="12" height="8.2" rx="1.7" />
        <path {...p} d="M8.6 10.4V8.2a3.4 3.4 0 0 1 6.8 0v2.2" />
      </>
    )
  } else if (name === "appearance") {
    body = (
      <path
        {...p}
        d="M14.6 5.8 18.2 9.4 9 18.6H5.4v-3.6Z"
      />
    )
  } else if (name === "network") {
    body = (
      <>
        <path {...p} d="M4.6 10.2a10.4 10.4 0 0 1 14.8 0" />
        <path {...p} d="M7.2 13.2a6.8 6.8 0 0 1 9.6 0" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
      </>
    )
  } else {
    body = (
      <>
        <path {...p} d="M6.2 9.5a5.8 5.8 0 0 1 11.6 0c0 3.7 1.2 4.7 1.2 4.7H5s1.2-1 1.2-4.7Z" />
        <path {...p} d="M10.1 16.8a1.9 1.9 0 0 0 3.8 0" />
      </>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {body}
    </svg>
  )
}

export function AppIcon({ id, size = 48 }: { id: AppId; size?: number }) {
  const glyph = size <= 28 ? Math.max(14, size - 4) : Math.round(size * 0.56)
  return (
    <span className={`app-icon app-icon-${id}`} style={{ width: size, height: size }}>
      <Glyph name={id} size={glyph} />
    </span>
  )
}
