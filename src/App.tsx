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
import { WALLPAPER } from './components/macosMaterials';
import { SystemSettingsModal } from './components/SystemSettingsModal';

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

  useEffect(() => {
    syncVaultStatus();
  }, [syncVaultStatus]);

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
      <img src={WALLPAPER} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
      <TopMenuBar />
      <WindowManager />
      <NotificationStack />
      <FloatingDock />
      {settingsOpen && <SystemSettingsModal onClose={() => setSettingsOpen(false)} />}
      {spotlightOpen && <Spotlight />}
      {launchpadOpen && <Launchpad />}
    </div>
  );
};

export default App;
