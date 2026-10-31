import { create } from 'zustand';
import { ipcDiagLog } from './tauriIpc';

interface ErrorEntry {
  at: string;
  message: string;
}

export const useErrorLog = create<{ entries: ErrorEntry[] }>(() => ({ entries: [] }));

function record(message: string) {
  const entry = { at: new Date().toLocaleTimeString(), message };
  useErrorLog.setState((s) => ({ entries: [entry, ...s.entries].slice(0, 200) }));
  void ipcDiagLog(`ui error: ${message}`).catch(() => undefined);
}

export function installErrorCapture() {
  window.addEventListener('error', (e) => record(e.error?.stack ?? e.message));
  window.addEventListener('unhandledrejection', (e) => record(String(e.reason?.stack ?? e.reason)));
}
