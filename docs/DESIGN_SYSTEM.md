# Solana OS Design System

This is the dark desktop system used by the shell. The companion file [`docs/figma/solana-os-design-system.svg`](figma/solana-os-design-system.svg) is a vector board. In Figma, use **File → Place image** or drag the SVG onto the canvas. It is vectors (rectangles, text, paths), so the swatches and icons stay editable.

## Color

| Token | Value | Use |
| --- | --- | --- |
| Window | `#1E1E1E` | Window body |
| Sidebar | `#141517` | Vibrancy base |
| Terminal | `#101114` | ConPTY surface |
| Hairline | `rgba(255,255,255,0.06)` | Search, segmented control, ghost buttons |
| Window stroke | `rgba(255,255,255,0.07)` | Window, dock, notifications, alerts |
| Dark ring | `0 0 0 1px rgba(0,0,0,0.75)` | Sits outside the hairline so the edge does not glow |
| Label | `#F5F5F5` | Primary text |
| Secondary | `#8A8A8A` | Section headers, hints |
| Accent | `#0A84FF` | Sidebar symbols, focus, primary button `#0088FF` |
| Danger | `#FF383C` | Terminate / reject |
| Close / min / zoom | `#F06E6A` / `#FFCD30` / `#58C73B` | 14px stoplights |

Do not use bright white borders (`white/20` or stronger) or inset specular rims (`#E6E6E6`, `#A6A6A6`) on the dark shell. Those read as a glowing stroke.

## Typography

The page loads Inter and JetBrains Mono from `@fontsource`, then uses:

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif;
letter-spacing: -0.011em;
-webkit-font-smoothing: antialiased;
```

On macOS this resolves to SF Pro. On Linux and Windows it resolves to Inter, so screenshots stay tight instead of falling back to a default sans. Addresses and the terminal use JetBrains Mono.

| Role | Size | Weight |
| --- | --- | --- |
| Menu item | 13px | 590 |
| App name | 13px | 860 |
| Window title | 13px / 15px | 700 |
| Sidebar item | 11px | 510 |
| Section header | 11px | 700 |
| Terminal | 12px mono | 400 |

## Window chrome

- Frame: 16px radius, `#1E1E1E`, hairline `white/7`, dark 1px ring, shadow `0 18px 54px rgba(0,0,0,0.57)`.
- Sidebar: 240px, luminosity `#141517` plus saturation layer, divider `white/4`.
- Stoplights: 14×14, gap 9px, five-layer inner shadow from the Figma kit. Close `#F06E6A`, minimize `#FFCD30`, zoom `#58C73B`.
- Toolbar controls are **not** pills. Search and segmented groups are `h-[28px] rounded-[6px] bg-white/5 border-white/6`. The active segment is `rounded-[5px] bg-white/14`. Focus ring `#0088FF` appears only while the search field is focused.
- Footer buttons: `h-[28px] px-3 rounded-[6px]`.
- Outline rows: 28px, alternating `rounded-[8px]` at `white/4`. Folder marks are flat `#0A84FF` vectors with no blur and no drop shadow.
- Sidebar navigation uses 15×15 SF-style symbols in `#0A84FF` (layers, folder, lock, shield, terminal, globe). No dots.

## Views

| Surface | Opens from | Contains |
| --- | --- | --- |
| Universal App Cloner | Sidebar rooms, Dock, Sandbox menu | Filterable sandbox table, clone sheet, freeze, terminate, launch wallet |
| Quantum Vault | Sidebar or Dock | Argon2id, XChaCha20-Poly1305, ML-KEM-1024 slot, RAM enclave, hardware shard, lock / export / rotate |
| Anti-Drainer | Sidebar or Dock | Blocked domains, ClickFix status, simulation log, alert modal |
| Builder Suite | Devnet Builder, Builder menu | Toolchain, local validator, zero-exposure `id.json`, terminal button |
| Standalone wallet | Launch in Enclave, Dock, Spotlight | Phantom, Solflare, or Backpack balance and token list |
| Terminal | Dock `>_`, sidebar, Builder | Tabs for `pwsh.exe`, `cmd.exe`, `solana-cli`. Prompt `solana-os@windows-conpty C:\VaultRooms\…>`. Badge: Windows ConPTY Connected and Zero-Exposure id.json Hook |
| Bento Control Center | Menu-bar switches icon | RPC, shield, freeze, sliders |
| Spotlight | Menu search or `Cmd/Ctrl+K` | Jump to any view |
| System Settings | Solana OS menu | Rooms, RPC, post-quantum, wallpaper |

## Terminal bridge

`run_sandboxed_cli_command(room_id, shell_type, command)` is the host command. On Windows it starts `powershell.exe` or `cmd.exe` with `CREATE_NO_WINDOW` and points `APPDATA`, `LOCALAPPDATA`, and `SOLANA_CONFIG` at the room mount. `shell_type` is `pwsh`, `cmd`, or `solana-cli`. The browser preview answers the built-in commands (`solana balance`, `solana config get`, `anchor build`, `winget list`, `dir`, `whoami`, `help`, `clear`) without leaving the page.

## Installers

Tag `v1.0.0-alpha.1` carries `Solana-OS_1.0.0_x64-setup.exe` (NSIS) and `Solana-OS_1.0.0_x64_en-US.msi` (WiX), built by `.github/workflows/build-windows-installer.yml`.
