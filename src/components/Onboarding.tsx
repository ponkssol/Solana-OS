import { useMemo, useState } from 'react';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { createVault } from '../lib/vaultBlob';
import { useOSStore } from '../store/useOSStore';
import { ROOM_CONFIGS, type RoomId } from '../tokens/designTokens';

type Step = 'recover' | 'passphrase' | 'phrase' | 'confirm' | 'room';

function pickChecks(): number[] {
  const picks = new Set<number>();
  while (picks.size < 3) picks.add(Math.floor(Math.random() * 24));
  return [...picks].sort((a, b) => a - b);
}

export function Onboarding({ mode = 'create', onDone, onCancel, onRestore }: { mode?: 'create' | 'restore'; onDone: () => void; onCancel?: () => void; onRestore?: () => void }) {
  const { unlockVault, switchRoom } = useOSStore();
  const generated = useMemo(() => generateMnemonic(wordlist, 256).split(' '), []);
  const [phraseInput, setPhraseInput] = useState('');
  const restored = phraseInput.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const words = mode === 'restore' ? restored : generated;
  const checks = useMemo(pickChecks, []);
  const [step, setStep] = useState<Step>(mode === 'restore' ? 'recover' : 'passphrase');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [room, setRoom] = useState<RoomId>('main');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const next = async () => {
    setError('');
    if (step === 'recover') {
      if (restored.length !== 24) return setError(`Enter all 24 words. You entered ${restored.length}.`);
      const unknown = restored.find((w) => !wordlist.includes(w));
      if (unknown) return setError(`"${unknown}" is not a BIP39 English word.`);
      if (!validateMnemonic(restored.join(' '), wordlist)) return setError('The checksum is wrong. Check the word order and spelling.');
      return setStep('passphrase');
    }
    if (step === 'passphrase') {
      if (pass.length < 8) return setError('Use at least 8 characters.');
      if (pass !== pass2) return setError("The passphrases don't match.");
      return setStep(mode === 'restore' ? 'room' : 'phrase');
    }
    if (step === 'phrase') return setStep('confirm');
    if (step === 'confirm') {
      const ok = checks.every((i, k) => answers[k].trim().toLowerCase() === words[i]);
      return ok ? setStep('room') : setError("Those words don't match. Check your written copy.");
    }
    setBusy(true);
    try {
      await createVault(pass, words.join(' '));
      if (!(await unlockVault(pass))) throw new Error('The new vault could not be opened.');
      await switchRoom(room);
      onDone();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const field = 'h-[30px] w-full rounded-[8px] border border-white/[0.08] bg-white/10 px-3 text-[13px] outline-none';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
      <div
        className="flex w-[min(460px,calc(100%-32px))] flex-col gap-4 rounded-[16px] border border-white/[0.06] p-6 text-[13px]"
        style={{ background: 'rgba(30,30,30,0.9)', backdropFilter: 'blur(40px)' }}
      >
        <h2 className="text-[15px] font-[700]">
          {step === 'recover' && 'Restore from recovery phrase'}
          {step === 'passphrase' && (mode === 'restore' ? 'Set a new passphrase' : 'Create vault.solos')}
          {step === 'phrase' && 'Your 24-word recovery phrase'}
          {step === 'confirm' && 'Confirm the recovery phrase'}
          {step === 'room' && 'Pick a starting room'}
        </h2>

        {step === 'recover' && (
          <>
            <p className="text-[12px] leading-5 text-white/70">
              Enter the 24 words from setup, in order, separated by spaces. Restoring replaces any vault on this machine.
            </p>
            <textarea
              autoFocus
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              spellCheck={false}
              className="h-[110px] resize-none rounded-[8px] border border-white/[0.08] bg-white/10 p-3 font-mono text-[12px] outline-none"
            />
          </>
        )}

        {step === 'passphrase' && (
          <>
            <p className="text-[12px] leading-5 text-white/70">
              The passphrase unlocks this vault on this machine. It is stretched with Argon2id and never leaves the device.
            </p>
            <input type="password" autoFocus placeholder="Passphrase" value={pass} onChange={(e) => setPass(e.target.value)} className={field} />
            <input type="password" placeholder="Repeat passphrase" value={pass2} onChange={(e) => setPass2(e.target.value)} className={field} />
          </>
        )}

        {step === 'phrase' && (
          <>
            <p className="text-[12px] leading-5 text-white/70">
              Write these words down in order and keep them offline. They are the only way to restore the vault elsewhere.
            </p>
            <ol className="grid grid-cols-3 gap-2 font-mono text-[12px]">
              {words.map((w, i) => (
                <li key={i} className="rounded-[6px] bg-white/[0.05] px-2 py-1">
                  <span className="text-white/40">{i + 1}.</span> {w}
                </li>
              ))}
            </ol>
          </>
        )}

        {step === 'confirm' &&
          checks.map((i, k) => (
            <label key={i} className="flex items-center gap-3">
              <span className="w-[64px] text-white/60">Word {i + 1}</span>
              <input
                autoFocus={k === 0}
                value={answers[k]}
                onChange={(e) => setAnswers((a) => a.map((v, j) => (j === k ? e.target.value : v)))}
                className={field}
              />
            </label>
          ))}

        {step === 'room' && (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(ROOM_CONFIGS) as RoomId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRoom(id)}
                className={`rounded-[10px] border px-3 py-3 text-left ${room === id ? 'border-[#0A84FF] bg-[#0A84FF]/15' : 'border-white/[0.08] bg-white/[0.03]'}`}
              >
                {ROOM_CONFIGS[id].label}
              </button>
            ))}
          </div>
        )}

        {error && <div className="text-[12px] text-[#ff6961]">{error}</div>}
        <div className="flex justify-end gap-2">
          {onRestore && step === 'passphrase' && (
            <button type="button" className="os-btn mr-auto" onClick={onRestore}>
              Restore from recovery phrase
            </button>
          )}
          {onCancel && (
            <button type="button" className="os-btn mr-auto" onClick={onCancel}>
              Cancel
            </button>
          )}
          {step !== 'passphrase' && step !== 'recover' && (
            <button
              type="button"
              className="os-btn"
              onClick={() => setStep(step === 'room' ? (mode === 'restore' ? 'passphrase' : 'confirm') : step === 'confirm' ? 'phrase' : 'passphrase')}
            >
              Back
            </button>
          )}
          <button type="button" className="os-btn os-btn-primary" disabled={busy} onClick={() => void next()}>
            {step === 'phrase' ? "I've written it down" : step === 'room' ? (busy ? 'Sealing…' : mode === 'restore' ? 'Restore vault' : 'Create vault') : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
