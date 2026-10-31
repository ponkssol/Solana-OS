# Solana OS Design System

This is the dark desktop system used by the shell. The companion file [`docs/figma/solana-os-design-system.svg`](figma/solana-os-design-system.svg) is a vector board. In Figma, use **File → Place image** or drag the SVG onto the canvas. It is vectors (rectangles, text, paths), so the swatches and icons stay editable.

## Wordmark

`public/assets/logo-white.png` is the official 2172×724 RGBA wordmark (white mark and “SOLANA OS” on a transparent background). The boot screen, lock screen, and Settings header display that file. Width is set in CSS and height is `auto`, so the browser downscales it. Do not trace it, recompress it, or set `image-rendering: pixelated`. The square installer icons in `src-tauri/icons` are Lanczos reductions of the mark from that same file, at 16, 24, 32, 48, 64, 128, and 256.

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
| Accent | `#0A84FF` | Focus, primary buttons, slider fill, sidebar symbols |
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

Tokens live on `:root` in `src/index.css`: `--os-type-body`, `--os-type-label`, `--os-type-secondary`, `--os-type-title`, `--os-type-sheet`, `--os-type-menu`, `--os-type-clock`, `--os-control-height`, `--os-accent`, `--os-hairline`. `body` is 13px so unlabeled controls do not inherit the browser's 16px. `rem` stays 16px.

| Role | Token | Size | Weight |
| --- | --- | --- | --- |
| Body, menu, buttons | `--os-type-body` | 13px | 510 |
| Sheet title | `--os-type-sheet` | 13px | 600 |
| Window title | `--os-type-title` | 13–15px | 600 |
| Secondary | `--os-type-secondary` | 12px | 400 |
| Labels, sidebar, section header | `--os-type-label` | 11px | 500–700 |
| Lock clock | `--os-type-clock` | 96px | 600 |
| Terminal | — | 12px mono | 400 |

Buttons and selects use `--os-control-height` (26px), inside the 24–28px range. Classes: `.os-btn`, `.os-btn-primary`, `.os-field`, `.os-sheet-title`, `.os-label`, `.os-secondary`.

## Window chrome

- Frame: 16px radius, `#1E1E1E`, hairline `white/7`, dark 1px ring, shadow `0 18px 54px rgba(0,0,0,0.57)`.
- Sidebar: 240px, luminosity `#141517` plus saturation layer, divider `white/4`.
- Stoplights: flat 12px circles, no bevel. Close `#F06E6A`, minimize `#FFCD30`, zoom `#58C73B`.
- Surfaces are flat. No gradients, gloss, bevels, or specular inset highlights on buttons, sliders, cards, or panels. Fill is a solid translucent dark, hairline `border-white/[0.06]`, accent fill `#0A84FF`.
- Sliders: 4px track, solid `#0A84FF` fill, plain 12px knob. No capsule gloss.
- Toolbar controls are **not** pills. Search and segmented groups are `h-[26px] rounded-[6px] bg-white/5 border-white/6`. The active segment is `rounded-[5px] bg-white/14`. Focus uses a `#0A84FF` border.
- Footer buttons: `.os-btn`, 26px, `rounded-[6px]`. Primary is `.os-btn-primary`.
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

The Windows installer workflow publishes a pre-release tagged `v<version>` from `tauri.conf.json`, currently `v1.0.0-alpha.4`, with `Solana-OS_<version>_x64-setup.exe` (NSIS) and `Solana-OS_<version>_x64_en-US.msi` (WiX). Earlier tags are left as they were. When the `TAURI_SIGNING_PRIVATE_KEY` secret is set, the run also signs the NSIS installer for the updater and refreshes `latest.json` on the `updater` release.
