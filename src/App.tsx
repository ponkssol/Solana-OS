import React, { useEffect } from 'react';
import { useOSStore } from './store/useOSStore';
import { BootScreen } from './components/BootScreen';
import { LockScreen } from './components/LockScreen';
import { TopMenuBar } from './components/TopMenuBar';
import { WindowManager } from './components/WindowManager';
import { FloatingDock } from './components/FloatingDock';
import { WallpaperSvg } from './components/WallpaperSvg';
import { Spotlight } from './components/Spotlight';

export const App: React.FC = () => {
  const {
    screen,
    activeRoom,
    syncVaultStatus,
    lockVault,
    spotlightOpen,
    setSpotlightOpen,
    displayBrightness,
  } = useOSStore();

  useEffect(() => {
    syncVaultStatus();
  }, [syncVaultStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockVault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === ' ') {
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
      className="relative flex h-screen w-screen select-none flex-col overflow-hidden text-white"
      style={{ filter: `brightness(${displayBrightness}%)` }}
    >
      <WallpaperSvg blurred={false} activeRoom={activeRoom} />
      <TopMenuBar />
      <WindowManager />
      <FloatingDock />
      {spotlightOpen && <Spotlight />}
    </div>
  );
};

export default App;
