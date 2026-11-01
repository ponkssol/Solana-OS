import { useEffect } from 'react';
import { useOSStore } from '../store/useOSStore';
import { usePrefs } from './settings';
import { getEnclaveStatus, toggleFreezeProcess } from './tauriBridge';
import { isTauriRuntime } from './tauriIpc';

export function useIdleGuards() {
  const screen = useOSStore((s) => s.screen);
  const activeRoom = useOSStore((s) => s.activeRoom);
  const autoLockMinutes = usePrefs((s) => s.autoLockMinutes);
  const idleFreezeMinutes = usePrefs((s) => s.idleFreezeMinutes);

  useEffect(() => {
    if (screen !== 'desktop' || autoLockMinutes <= 0) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - last >= autoLockMinutes * 60_000) void useOSStore.getState().lockVault();
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(timer);
    };
  }, [screen, autoLockMinutes]);

  useEffect(() => {
    if (screen !== 'desktop' || idleFreezeMinutes <= 0 || !isTauriRuntime()) return;
    const leftAt: Record<string, number> = {};
    const timer = window.setInterval(async () => {
      try {
        const now = Date.now();
        const { sandboxes } = await getEnclaveStatus();
        const stale = sandboxes.filter((s) => {
          if (s.status !== 'Running' || s.roomId === activeRoom) return false;
          leftAt[s.roomId] ??= now;
          return now - leftAt[s.roomId] >= idleFreezeMinutes * 60_000;
        });
        await Promise.all(stale.map((s) => toggleFreezeProcess(s.instanceId)));
      } catch {
        // The next tick retries; a missing sandbox list is not worth a notification.
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [screen, activeRoom, idleFreezeMinutes]);
}
