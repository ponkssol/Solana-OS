import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ipcDiagLog, isTauriRuntime } from '../lib/tauriIpc';

const BTN = 'h-[30px] rounded-[6px] border border-white/[0.08] px-4 text-[13px] font-[590] disabled:opacity-40';

const useAvailableUpdate = create<{ update: Update | null }>(() => ({ update: null }));

export async function checkForUpdate(): Promise<Update | null> {
  const found = await check();
  useAvailableUpdate.setState({ update: found });
  return found;
}

export function UpdatePrompt() {
  const update = useAvailableUpdate((s) => s.update);
  const setUpdate = (next: Update | null) => useAvailableUpdate.setState({ update: next });
  const [status, setStatus] = useState('');

  // At launch a missing release feed, an unsigned build or no network just means no prompt.
  useEffect(() => {
    if (!isTauriRuntime()) return;
    checkForUpdate().catch((err) => void ipcDiagLog(`update check failed: ${String(err)}`).catch(() => undefined));
  }, []);

  if (!update) return null;

  const install = async () => {
    setStatus('Downloading…');
    try {
      await update.downloadAndInstall();
      setStatus('Restarting…');
      await relaunch();
    } catch (err) {
      setStatus(`Update failed: ${String(err)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/50">
      <div className="flex w-[480px] flex-col gap-3 rounded-[12px] border border-white/[0.08] bg-[#161616] p-5 text-[13px] text-white">
        <div className="text-[15px] font-[700]">Solana OS {update.version} is available</div>
        <div className="text-[12px] text-[#8a8a8a]">You have {update.currentVersion}.</div>
        <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-black/40 p-3 font-sans text-[12px] text-white/85">
          {update.body?.trim() || 'No release notes were published for this version.'}
        </pre>
        {status && <div className="text-[12px] text-[#8a8a8a]">{status}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className={`${BTN} bg-white/[0.05]`} disabled={Boolean(status) && !status.startsWith('Update failed')} onClick={() => setUpdate(null)}>
            Later
          </button>
          <button type="button" className={`${BTN} bg-[#0A84FF]`} disabled={Boolean(status) && !status.startsWith('Update failed')} onClick={() => void install()}>
            Install and restart
          </button>
        </div>
      </div>
    </div>
  );
}
