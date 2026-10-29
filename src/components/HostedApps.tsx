import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { terminateSandbox } from '../lib/tauriBridge';
import {
  ipcContainmentClose,
  ipcContainmentFocus,
  ipcContainmentSetSlot,
  isTauriRuntime,
  type ContainmentEvent,
  type HostSlot,
} from '../lib/tauriIpc';
import { useOSStore, type HostedAppWindow } from '../store/useOSStore';
import { Stoplights } from './macosMaterials';

export function HostedApps() {
  const hosted = useOSStore((state) => state.hosted);
  const drag = useRef<
    | { mode: 'move'; key: string; dx: number; dy: number }
    | { mode: 'resize'; key: string; x: number; y: number; width: number; height: number }
    | null
  >(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void listen<ContainmentEvent>('containment-window', (event) => {
      useOSStore.getState().applyContainmentEvent(event.payload);
    }).then((stop) => {
      unlisten = stop;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const current = drag.current;
      if (!current) return;
      if (current.mode === 'move') {
        useOSStore.getState().moveHosted(current.key, event.clientX - current.dx, event.clientY - current.dy);
      } else {
        useOSStore.getState().resizeHosted(
          current.key,
          current.width + (event.clientX - current.x),
          current.height + (event.clientY - current.y),
        );
      }
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const topZ = hosted.reduce((max, win) => Math.max(max, win.isMinimized ? 0 : win.zIndex), 0);

  return (
    <>
      {hosted
        .filter((win) => !win.isMinimized)
        .map((win) => (
          <HostedFrame
            key={win.key}
            win={win}
            raise={win.zIndex === topZ}
            onDragStart={(event) => {
              const hwnd = useOSStore.getState().focusHosted(win.key);
              if (hwnd) void ipcContainmentFocus(hwnd);
              if (win.isMaximized) return;
              drag.current = {
                mode: 'move',
                key: win.key,
                dx: event.clientX - win.position.x,
                dy: event.clientY - win.position.y,
              };
            }}
            onResizeStart={(event) => {
              event.stopPropagation();
              drag.current = {
                mode: 'resize',
                key: win.key,
                x: event.clientX,
                y: event.clientY,
                width: win.size.width,
                height: win.size.height,
              };
            }}
            onClose={() => closeHosted(win)}
            onMinimize={() => useOSStore.getState().minimizeHosted(win.key)}
            onZoom={() => useOSStore.getState().toggleMaximizeHosted(win.key)}
          />
        ))}
    </>
  );
}

function closeHosted(win: HostedAppWindow) {
  const { hosted, removeHosted, removeHostedInstance } = useOSStore.getState();
  if (win.primary || !win.hwnd) {
    for (const item of hosted.filter((entry) => entry.instanceId === win.instanceId)) {
      if (item.hwnd) void ipcContainmentClose(item.hwnd);
    }
    if (!win.instanceId.startsWith('preview-')) void terminateSandbox(win.instanceId);
    removeHostedInstance(win.instanceId);
    return;
  }
  void ipcContainmentClose(win.hwnd);
  removeHosted(win.key);
}

function HostedFrame({
  win,
  raise,
  onDragStart,
  onResizeStart,
  onClose,
  onMinimize,
  onZoom,
}: {
  win: HostedAppWindow;
  raise: boolean;
  onDragStart: (event: React.MouseEvent) => void;
  onResizeStart: (event: React.MouseEvent) => void;
  onClose: () => void;
  onMinimize: () => void;
  onZoom: () => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const style: React.CSSProperties = win.isMaximized
    ? { top: 36, left: 16, right: 16, bottom: 76, zIndex: win.zIndex }
    : {
        top: win.position.y,
        left: win.position.x,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
      };

  return (
    <section
      className="absolute flex flex-col overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#1e1e1e] shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_18px_54px_rgba(0,0,0,0.57)]"
      style={style}
    >
      <header
        className="flex h-10 shrink-0 items-center gap-3 border-b border-white/[0.06] px-3"
        onMouseDown={onDragStart}
      >
        <Stoplights onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} />
        <div className="min-w-0 flex-1 truncate text-center text-[13px] font-[600] text-white/85">{win.title}</div>
        <div className="w-[52px]" />
      </header>
      <div className="relative min-h-0 flex-1">
        <div ref={slotRef} className="absolute inset-x-0 bottom-2 top-0 bg-black">
          {!win.hwnd && (
            <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-white/55">
              Opening {win.appName} inside Solana OS…
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Resize"
          onMouseDown={onResizeStart}
          className="absolute bottom-0 right-0 size-3 cursor-nwse-resize"
        />
        <SlotBridge hwnd={win.hwnd} visible node={slotRef} raise={raise} />
      </div>
    </section>
  );
}

function SlotBridge({
  hwnd,
  visible,
  node,
  raise,
}: {
  hwnd: string | null;
  visible: boolean;
  node: React.RefObject<HTMLDivElement | null>;
  raise: boolean;
}) {
  useLayoutEffect(() => {
    if (!hwnd) return;
    const push = () => {
      const target = node.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const slot: HostSlot = {
        hwnd,
        x: Math.round(rect.left * scale),
        y: Math.round(rect.top * scale),
        width: Math.round(Math.max(1, rect.width) * scale),
        height: Math.round(Math.max(1, rect.height) * scale),
        visible: visible && rect.width > 2 && rect.height > 2,
        raise,
      };
      void ipcContainmentSetSlot(slot);
    };
    push();
    const observer = new ResizeObserver(push);
    if (node.current) observer.observe(node.current);
    window.addEventListener('resize', push);
    const timer = window.setInterval(push, 200);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', push);
      window.clearInterval(timer);
    };
  }, [hwnd, visible, node, raise]);

  useEffect(() => {
    if (!hwnd) return;
    return () => {
      void ipcContainmentSetSlot({ hwnd, x: 0, y: 0, width: 1, height: 1, visible: false, raise: false });
    };
  }, [hwnd]);

  return null;
}
