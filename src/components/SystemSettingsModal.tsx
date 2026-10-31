import { useEffect, useRef, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { useOSStore } from '../store/useOSStore';
import { BRAND_ASSETS, ROOM_CONFIGS, type RoomId } from '../tokens/designTokens';
import { BUILT_IN_WALLPAPERS, DEFAULT_RPC_URL, downscaleImage, usePrefs, wallpaperCss } from '../lib/settings';
import { getSolBalance } from '../lib/rpc';
import { useErrorLog } from '../lib/errorLog';
import { ipcReadDiagLog, isTauriRuntime } from '../lib/tauriIpc';

const SECTIONS = ['General', 'Rooms', 'RPC & Wallet', 'Security', 'Appearance', 'Updates', 'Logs'] as const;
type Section = (typeof SECTIONS)[number];

const FIELD = 'h-[28px] w-full rounded-[6px] border border-white/[0.08] bg-white/[0.06] px-2 text-[12px] outline-none focus:border-[#0A84FF]';

export function SystemSettingsModal({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>('General');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={onClose}>
      <section
        onClick={(event) => event.stopPropagation()}
        className="flex h-[min(560px,calc(100%-48px))] w-[min(800px,calc(100%-48px))] overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#1e1e1e] shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_18px_54px_rgba(0,0,0,0.57)]"
      >
        <aside className="w-[200px] shrink-0 border-r border-white/[0.04] bg-[#141517] p-4 text-[13px]">
          <div className="mb-3 text-[11px] font-[700] uppercase tracking-wide text-[#8a8a8a]">System Settings</div>
          {SECTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSection(item)}
              className={`block w-full rounded-[6px] px-2 py-1.5 text-left ${item === section ? 'bg-white/[0.06] text-white' : 'text-[#8a8a8a] hover:text-white'}`}
            >
              {item}
            </button>
          ))}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-5 text-[13px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-[700]">{section}</h2>
            <button type="button" onClick={onClose} className="os-btn shrink-0">
              Done
            </button>
          </div>
          {section === 'General' && <General />}
          {section === 'Rooms' && <Rooms />}
          {section === 'RPC & Wallet' && <RpcWallet />}
          {section === 'Security' && <Security />}
          {section === 'Appearance' && <Appearance />}
          {section === 'Updates' && <Updates />}
          {section === 'Logs' && <Logs />}
        </div>
      </section>
    </div>
  );
}

function General() {
  const { vault, activeRoom } = useOSStore();
  return (
    <>
      <img src={BRAND_ASSETS.logoWhite} alt="SOLANA OS" width={2172} height={724} draggable={false} className="mb-3 block h-auto w-[180px]" />
      <SettingsRow label="Identity" value={vault.identity || 'Not unlocked'} />
      <SettingsRow label="Active room" value={ROOM_CONFIGS[activeRoom].label} />
      <SettingsRow label="Vault" value={vault.locked ? 'Locked' : `Unlocked · ${vault.cipherSuite}`} />
      <SettingsRow label="Key isolation ID" value={vault.keyIsolationId} />
    </>
  );
}

function Rooms() {
  const { activeRoom, switchRoom } = useOSStore();
  return (
    <>
      <p className="mb-3 text-[12px] leading-5 text-[#8a8a8a]">
        Each room keeps its own AppData, Solana CLI config and vault mount.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ROOM_CONFIGS) as RoomId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => void switchRoom(id)}
            className={`rounded-[10px] border px-3 py-3 text-left ${activeRoom === id ? 'border-[#0A84FF] bg-[#0A84FF]/15' : 'border-white/[0.08] bg-white/[0.03]'}`}
          >
            {ROOM_CONFIGS[id].label}
          </button>
        ))}
      </div>
    </>
  );
}

function RpcWallet() {
  const { rpcUrl, walletAddress, update } = usePrefs();
  const [url, setUrl] = useState(rpcUrl);
  const [address, setAddress] = useState(walletAddress);
  const [status, setStatus] = useState('');

  const save = async () => {
    const trimmed = url.trim() || DEFAULT_RPC_URL;
    update({ rpcUrl: trimmed, walletAddress: address.trim() });
    if (!address.trim()) return setStatus('Saved.');
    setStatus('Checking balance…');
    try {
      setStatus(`Saved. Balance: ${(await getSolBalance(trimmed, address.trim())).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`);
    } catch (err) {
      setStatus(`Saved, but the balance check failed: ${String(err)}`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[#8a8a8a]">RPC endpoint</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={DEFAULT_RPC_URL} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[#8a8a8a]">Wallet address (public key, read-only)</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Base58 address" className={`${FIELD} font-mono`} />
      </label>
      <p className="text-[12px] leading-5 text-[#8a8a8a]">
        The public mainnet endpoint is rate-limited. Use your own RPC URL for reliable balances and simulations.
      </p>
      <div className="flex items-center gap-3">
        <button type="button" className="os-btn os-btn-primary" onClick={() => void save()}>Save</button>
        <button type="button" className="os-btn" onClick={() => setUrl(DEFAULT_RPC_URL)}>Use default</button>
      </div>
      {status && <div className="text-[12px] text-white/80">{status}</div>}
    </div>
  );
}

function Security() {
  const { autoLockMinutes, idleFreezeMinutes, update } = usePrefs();
  return (
    <div className="flex flex-col gap-4">
      <MinutesSelect
        label="Auto-lock after idle"
        value={autoLockMinutes}
        options={[0, 1, 5, 10, 15, 30, 60]}
        onChange={(v) => update({ autoLockMinutes: v })}
      />
      <MinutesSelect
        label="Freeze apps in inactive rooms after"
        value={idleFreezeMinutes}
        options={[0, 5, 10, 15, 30, 60]}
        onChange={(v) => update({ idleFreezeMinutes: v })}
      />
      <p className="text-[12px] leading-5 text-[#8a8a8a]">
        Frozen apps are suspended, not closed. Resume them from Process Freeze in the menu bar.
      </p>
    </div>
  );
}

function MinutesSelect({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-white/[0.04] pb-3">
      <span className="text-[#8a8a8a]">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${FIELD} w-[140px]`}>
        {options.map((m) => (
          <option key={m} value={m} className="bg-[#1e1e1e]">
            {m === 0 ? 'Never' : `${m} min`}
          </option>
        ))}
      </select>
    </label>
  );
}

function Appearance() {
  const prefs = usePrefs();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      prefs.update({ wallpaperId: 'custom', customWallpaper: await downscaleImage(file) });
    } catch (err) {
      setError(String(err));
    }
  };

  const tiles = [...BUILT_IN_WALLPAPERS, ...(prefs.customWallpaper ? [{ id: 'custom', label: 'Custom' }] : [])];

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((w) => (
          <button key={w.id} type="button" onClick={() => prefs.update({ wallpaperId: w.id })} className="flex flex-col gap-1.5 text-left">
            <span
              className={`block aspect-[16/10] w-full rounded-[8px] border-2 ${prefs.wallpaperId === w.id ? 'border-[#0A84FF]' : 'border-transparent'}`}
              style={{ background: wallpaperCss({ wallpaperId: w.id, customWallpaper: prefs.customWallpaper }) }}
            />
            <span className="text-[12px] text-white/80">{w.label}</span>
          </button>
        ))}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
      <button type="button" className="os-btn mt-4 w-fit" onClick={() => input.current?.click()}>
        Choose image…
      </button>
      {error && <div className="mt-2 text-[12px] text-[#ff6961]">{error}</div>}
    </>
  );
}

function Updates() {
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isTauriRuntime()) void getVersion().then(setVersion).catch(() => undefined);
  }, []);

  const run = async () => {
    setBusy(true);
    setStatus('Checking…');
    try {
      const update = await check();
      if (!update) return setStatus('Solana OS is up to date.');
      setStatus(`Downloading ${update.version}…`);
      await update.downloadAndInstall();
      setStatus('Installed. Restarting…');
      await relaunch();
    } catch (err) {
      setStatus(`Update check failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SettingsRow label="Installed version" value={version || 'Unknown'} />
      <p className="text-[12px] leading-5 text-[#8a8a8a]">
        Updates come from signed GitHub releases. A signature that doesn't match the built-in public key is rejected.
      </p>
      <button type="button" disabled={busy} className="os-btn os-btn-primary w-fit" onClick={() => void run()}>
        Check for Updates
      </button>
      {status && <div className="text-[12px] text-white/80">{status}</div>}
    </div>
  );
}

function Logs() {
  const entries = useErrorLog((s) => s.entries);
  const [log, setLog] = useState('');

  const load = () => {
    if (!isTauriRuntime()) return setLog('The backend log is only available in the desktop app.');
    ipcReadDiagLog().then(setLog).catch((err) => setLog(String(err)));
  };
  useEffect(load, []);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="text-[11px] font-[700] uppercase text-[#8a8a8a]">UI errors this session ({entries.length})</div>
      {entries.length === 0 ? (
        <div className="text-[12px] text-[#8a8a8a]">None.</div>
      ) : (
        <pre className="max-h-[120px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-black/40 p-3 font-mono text-[11px] text-[#ff9f95]">
          {entries.map((e) => `[${e.at}] ${e.message}`).join('\n')}
        </pre>
      )}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-[700] uppercase text-[#8a8a8a]">solana-os.log</div>
        <div className="flex gap-2">
          <button type="button" className="os-btn" onClick={load}>Refresh</button>
          <button type="button" className="os-btn" onClick={() => void navigator.clipboard.writeText(log)}>Copy</button>
        </div>
      </div>
      <pre className="h-[260px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-black/40 p-3 font-mono text-[11px] text-white/80">{log}</pre>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] py-3">
      <span className="text-[#8a8a8a]">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
