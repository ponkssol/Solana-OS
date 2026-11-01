# Solana OS 1.0.0-alpha.7

## Fixes

- Hosted and cloned apps no longer lag or ignore clicks. The shell window was set as the owner of every captured window, which made Windows share one input queue between each app and the shell's webview thread. Any busy moment in the shell then stalled input in every hosted app. Captured windows now stay off the taskbar through `WS_EX_TOOLWINDOW` alone.
- The containment loop no longer re-sends z-order changes to every hosted window 12 times a second in windowed mode. It now raises a window only when it has fallen below the shell.
- Window moves and z-order changes sent to other processes are now asynchronous, so one unresponsive app cannot stall containment for all the others.
- Focusing a hosted app no longer attaches to that app's input thread.
- The fallback window sweep runs every 500 ms instead of every 80 ms. Live changes are still handled immediately through window events.

## Diagnostics

- The diagnostics log now records `input-probe` lines when a hosted window takes the foreground, and when Windows reports a hosted window as not responding.
