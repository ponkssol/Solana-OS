const BRANDS = [
  { name: "Phantom", hosts: ["phantom.app"], hints: [/phantom/i, /phant0m/i] },
  { name: "Solflare", hosts: ["solflare.com"], hints: [/solflare/i, /soiflare/i] },
  { name: "Jupiter", hosts: ["jup.ag"], hints: [/jupiter/i] },
  { name: "Raydium", hosts: ["raydium.io"], hints: [/raydium/i] },
  { name: "Backpack", hosts: ["backpack.app", "backpack.exchange"], hints: [/backpack/i] },
]

const BAIT = [/airdrop/i, /claim[-.]?sol/i, /seed[-.]?phrase/i, /wallet[-.]?connect/i, /bonus[-.]?sol/i]

function hostOf(input) {
  try {
    return new URL(input).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function official(host, brand) {
  return brand.hosts.some((item) => host === item || host.endsWith(`.${item}`))
}

function inspectUrl(input) {
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

function inspectSign(message) {
  const warnings = []
  const text = String(message || "")
  if (/setauthority/i.test(text)) warnings.push("This signature changes a token authority.")
  if (/approve/i.test(text) && /unlimited|max|all/i.test(text)) warnings.push("This signature approves spending.")
  if (/transfer/i.test(text) && /all|entire|drain/i.test(text)) warnings.push("This signature can move the whole balance.")
  return warnings
}

module.exports = { inspectUrl, inspectSign }
