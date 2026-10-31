import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { ipcContainmentSetDesk, isTauriRuntime, type ContainmentEvent } from '../lib/tauriIpc';
import { useOSStore } from '../store/useOSStore';

// Hosted apps are real native windows drawn by their own process; this component only reports
// the desk area they may occupy (between the menu bar and the dock) and shows launch progress.
export function HostedApps() {
  const hosted = useOSStore((state) => state.hosted);
  const pending = hosted.filter((win) => win.hwnd === null);
  const desk = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const stop = listen<ContainmentEvent>('containment-window', (event) => {
      useOSStore.getState().applyContainmentEvent(event.payload);
    });
    return () => {
      void stop.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const node = desk.current;
    if (!node) return;
    const push = () => {
      const rect = node.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      void ipcContainmentSetDesk({
        x: Math.round(rect.left * scale),
        y: Math.round(rect.top * scale),
        width: Math.round(rect.width * scale),
        height: Math.round(rect.height * scale),
      }).catch(() => undefined);
    };
    push();
    const observer = new ResizeObserver(push);
    observer.observe(node);
    window.addEventListener('resize', push);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', push);
    };
  }, []);

  return (
    <>
      <div ref={desk} aria-hidden className="pointer-events-none fixed inset-x-0 bottom-[64px] top-[42px]" />
      {pending.length > 0 && (
        <div className="pointer-events-none fixed bottom-[76px] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
          {pending.map((win) => (
            <div key={win.key} className="rounded-[10px] bg-black/70 px-4 py-2 text-[13px] text-white/85">
              Opening {win.appName}…
            </div>
          ))}
        </div>
      )}
    </>
  );
}
