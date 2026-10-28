const BRANDS = [
  { name: "Phantom", hosts: ["phantom.app"], hints: [/phantom/i, /phant0m/i] },
  { name: "Solflare", hosts: ["solflare.com"], hints: [/solflare/i, /soiflare/i] },
  { name: "Jupiter", hosts: ["jup.ag"], hints: [/jupiter/i] },
  { name: "Raydium", hosts: ["raydium.io"], hints: [/raydium/i] },
  { name: "Backpack", hosts: ["backpack.app", "backpack.exchange"], hints: [/backpack/i] },
]

const BAIT = [/airdrop/i, /claim[-.]?sol/i, /seed[-.]?phrase/i, /wallet[-.]?connect/i, /bonus[-.]?sol/i]
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

function hostOf(input: string): string {
  try {
    return new URL(input).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function official(host: string, brand: (typeof BRANDS)[number]): boolean {
  return brand.hosts.some((item) => host === item || host.endsWith(`.${item}`))
}

export function inspectUrl(input: string): { ok: boolean; warning: string } {
  const host = hostOf(input)
  if (!host) return { ok: false, warning: "That address is not a web page." }
  if (host.startsWith("xn--") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { ok: false, warning: "This site uses a disguised address. It was not opened." }
  }
  for (const brand of BRANDS) {
    if (official(host, brand)) continue
    if (brand.hints.some((hint) => hint.test(host))) {
      return { ok: false, warning: `This site imitates ${brand.name}. It was not opened.` }
    }
  }
  if (BAIT.some((hint) => hint.test(host))) {
    return { ok: false, warning: "This site looks like a phishing page. It was not opened." }
  }
  return { ok: true, warning: "" }
}

export function inspectSign(message: string): string[] {
  const warnings: string[] = []
  if (/setauthority/i.test(message)) warnings.push("This signature changes a token authority.")
  if (/approve/i.test(message) && /unlimited|max|all/i.test(message)) {
    warnings.push("This signature approves spending.")
  }
  if (/transfer/i.test(message) && /all|entire|drain/i.test(message)) {
    warnings.push("This signature can move the whole balance.")
  }
  return warnings
}

export async function copyWatched(text: string, warn: (body: string) => void) {
  await navigator.clipboard.writeText(text)
  window.setTimeout(() => {
    void navigator.clipboard.readText().then((now) => {
      if (ADDRESS.test(text) && ADDRESS.test(now) && now !== text) {
        warn("The copied address changed on the clipboard. Do not paste it.")
      }
    }).catch(() => undefined)
  }, 400)
}
