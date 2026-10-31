import React, { useEffect } from 'react';
import { useOSStore } from './store/useOSStore';
import { BootScreen } from './components/BootScreen';
import { LockScreen } from './components/LockScreen';
import { TopMenuBar } from './components/TopMenuBar';
import { WindowManager } from './components/WindowManager';
import { FloatingDock } from './components/FloatingDock';
import { Spotlight } from './components/Spotlight';
import { Launchpad } from './components/Launchpad';
import { NotificationStack } from './components/NotificationStack';
import { usePrefs, wallpaperCss } from './lib/settings';
import { useIdleGuards } from './lib/useIdleGuards';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { ShieldReview } from './components/ShieldReview';
import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './lib/tauriIpc';
import { listen } from '@tauri-apps/api/event';
import { queueExternal, type ExternalTx } from './lib/wallet';
import { UpdatePrompt } from './components/UpdatePrompt';

export const App: React.FC = () => {
  const {
    screen,
    syncVaultStatus,
    lockVault,
    spotlightOpen,
    setSpotlightOpen,
    launchpadOpen,
    displayBrightness,
    settingsOpen,
    setSettingsOpen,
  } = useOSStore();
  const wallpaper = usePrefs((s) => wallpaperCss(s));
  useIdleGuards();

  useEffect(() => {
    syncVaultStatus();
  }, [syncVaultStatus]);

  const rpcUrl = usePrefs((s) => s.rpcUrl);
  useEffect(() => {
    if (isTauriRuntime()) void invoke('shield_proxy_set_upstream', { url: rpcUrl }).catch(() => undefined);
  }, [rpcUrl]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const off = listen<ExternalTx>('shield://external-tx', (e) => queueExternal(e.payload));
    return () => {
      void off.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
      }
      if (e.key === 'F11') {
        e.preventDefault();
        if (!e.repeat) void useOSStore.getState().toggleShellMode();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockVault();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === ' ' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSpotlightOpen(!useOSStore.getState().spotlightOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockVault, setSpotlightOpen]);

  if (screen === 'boot') {
    return <BootScreen />;
  }

  if (screen === 'lock') {
    return <LockScreen />;
  }

  return (
    <div
      className="relative flex h-full w-full select-none flex-col overflow-hidden text-white"
      style={{ filter: `brightness(${displayBrightness}%)` }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: wallpaper }} />
      <TopMenuBar />
      <WindowManager />
      <NotificationStack />
      <FloatingDock />
      {settingsOpen && <SystemSettingsModal onClose={() => setSettingsOpen(false)} />}
      {spotlightOpen && <Spotlight />}
      {launchpadOpen && <Launchpad />}
      <ShieldReview />
      <UpdatePrompt />
    </div>
  );
};

export default App;
