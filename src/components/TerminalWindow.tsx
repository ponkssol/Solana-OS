import { useState } from 'react';
import { runSandboxedCliCommand, type ShellKind } from '../lib/tauriBridge';

// The sandboxed shells (ConPTY, PowerShell, cmd) exist only on the Windows build.
const IS_WINDOWS = typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
const STATUS = IS_WINDOWS
  ? 'Windows ConPTY Connected (PowerShell / CMD Bridge)'
  : 'Preview only: the sandboxed shell runs on Windows';

const TABS: { id: ShellKind; label: string }[] = IS_WINDOWS
  ? [
      { id: 'pwsh', label: 'pwsh.exe (ConPTY)' },
      { id: 'cmd', label: 'cmd.exe — Win32 Bridge' },
      { id: 'solana-cli', label: 'solana-cli' },
    ]
  : [
      { id: 'pwsh', label: 'PowerShell (Windows only)' },
      { id: 'cmd', label: 'cmd (Windows only)' },
      { id: 'solana-cli', label: 'solana-cli' },
    ];

const QUICK = IS_WINDOWS
  ? ['solana balance', 'solana config get', 'anchor build', 'winget list', 'dir', 'whoami', 'help', 'clear']
  : ['solana balance', 'solana config get', 'anchor build', 'help', 'clear'];

export function TerminalWindow({ roomId = 'treasury' }: { roomId?: string }) {
  const [shell, setShell] = useState<ShellKind>('pwsh');
  const [lines, setLines] = useState<string[]>([
    STATUS,
    'Zero-Exposure id.json Hook Active',
  ]);
  const [draft, setDraft] = useState('');
  const prompt = IS_WINDOWS
    ? `solana-os@windows-conpty C:\\VaultRooms\\${roomFolder(roomId)}>`
    : `solana-os@preview ~/VaultRooms/${roomFolder(roomId)}$`;

  const run = async (command: string) => {
    const text = command.trim();
    if (!text) return;
    if (text.toLowerCase() === 'clear') {
      setLines([]);
      setDraft('');
      return;
    }
    try {
      const result = await runSandboxedCliCommand(roomId, shell, text);
      setLines((prev) => [...prev, `${result.prompt} ${text}`, result.output].filter((line) => line.length > 0));
    } catch (error) {
      setLines((prev) => [...prev, `> ${text}`, String(error)]);
    }
    setDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#101114] text-[12px]">
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-2 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setShell(tab.id)}
            className={`h-[28px] rounded-[6px] border px-2 font-[510] ${
              shell === tab.id
                ? 'border-white/[0.06] bg-white/[0.08] text-white'
                : 'border-transparent text-[#8a8a8a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 px-3 py-2 text-[11px]">
        <span className="rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-2 py-1 text-[#8a8a8a]">
          {STATUS}
        </span>
        <span className="rounded-[6px] border border-[#0A84FF]/30 bg-[#0A84FF]/10 px-2 py-1 text-[#0A84FF]">
          Zero-Exposure id.json Hook Active
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 font-mono text-[12px] leading-5 text-[#d6d6d6]">
        {lines.map((line, index) => (
          <div key={`${index}-${line.slice(0, 12)}`}>{line}</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {QUICK.map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => void run(command)}
            className="h-[24px] rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-2 text-[11px] text-white/80"
          >
            {command}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2 font-mono"
        onSubmit={(event) => {
          event.preventDefault();
          void run(draft);
        }}
      >
        <span className="shrink-0 text-[#8a8a8a]">{prompt}</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Terminal command"
          className="w-full bg-transparent text-white outline-none"
          autoFocus
        />
      </form>
    </div>
  );
}

function roomFolder(roomId: string): string {
  if (roomId === 'defi') return 'DegenRoom';
  if (roomId === 'burner') return 'BurnerRoom';
  if (roomId === 'devnet') return 'DevRoom';
  return 'MainRoom';
}
