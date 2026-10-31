import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { usePrefs } from '../lib/settings';
import { getLamports, simulateWithAccounts, type AccountSimulation } from '../lib/rpc';
import { LAMPORTS_PER_SOL, SYSTEM_PROGRAM, toBase64 } from '../lib/solanaTx';
import { approvePending, rejectPending, useWallet, type SignRequest } from '../lib/wallet';

interface LocalVerdict {
  riskLevel: 'safe' | 'warning' | 'criticalBlock';
  blocked: boolean;
  riskScore: number;
  detectedThreats: string[];
  recommendation: string;
}

interface Analysis {
  simulation?: AccountSimulation;
  simulationError?: string;
  preLamports?: number;
  verdict?: LocalVerdict;
}

const BTN = 'h-[30px] rounded-[6px] border border-white/[0.08] px-4 text-[13px] font-[590] disabled:opacity-40';

async function analyze(request: SignRequest, rpcUrl: string, address: string): Promise<Analysis> {
  const out: Analysis = {};
  if (request.kind !== 'transaction' || !request.unsignedTx) return out;
  const [pre, sim] = await Promise.allSettled([
    getLamports(rpcUrl, address),
    simulateWithAccounts(rpcUrl, toBase64(request.unsignedTx), [address]),
  ]);
  if (pre.status === 'fulfilled') out.preLamports = pre.value;
  if (sim.status === 'fulfilled') out.simulation = sim.value;
  else out.simulationError = String(sim.reason);
  out.verdict = await invoke<LocalVerdict>('simulate_transaction', {
    request: {
      originUrl: request.origin,
      signerWallet: address,
      walletSolBalanceLamports: out.preLamports ?? 0,
      instructions: request.transfer
        ? [
            {
              programId: SYSTEM_PROGRAM,
              instructionType: 'transfer',
              destination: request.transfer.destination,
              amount: request.transfer.lamports,
            },
          ]
        : [],
      rawPayloadPreview: null,
    },
  }).catch(() => undefined);
  return out;
}

function sol(lamports: number) {
  return `${(lamports / LAMPORTS_PER_SOL).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`;
}

export function ShieldReview() {
  const pending = useWallet((s) => s.pending);
  const address = useWallet((s) => s.address);
  const rpcUrl = usePrefs((p) => p.rpcUrl);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);

  const request = pending?.request;
  useEffect(() => {
    if (!request || !address) return;
    let live = true;
    setAnalysis(null);
    analyze(request, rpcUrl, address).then((a) => live && setAnalysis(a));
    return () => {
      live = false;
    };
  }, [request, rpcUrl, address]);

  if (!request) return null;

  const sim = analysis?.simulation;
  const post = sim?.postLamports[0];
  const delta = post != null && analysis?.preLamports !== undefined ? post - analysis.preLamports : undefined;
  const blocked = analysis?.verdict?.blocked ?? false;
  const failed = Boolean(sim?.err);
  const ready = request.kind === 'message' || analysis !== null;

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      await (approve ? approvePending() : rejectPending());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60">
      <div className="flex max-h-[80vh] w-[520px] flex-col gap-3 overflow-y-auto rounded-[12px] border border-white/[0.08] bg-[#161616] p-5 text-[13px] text-white">
        <div className="text-[15px] font-[700]">Shield review</div>
        <div className="text-[12px] text-[#8a8a8a]">
          {request.origin} wants a {request.kind === 'transaction' ? 'transaction' : 'message'} signature from {address}.
        </div>
        <div className="rounded-[8px] bg-white/[0.04] p-3">{request.summary}</div>

        {request.kind === 'message' && (
          <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-black/40 p-3 font-mono text-[11px]">
            {new TextDecoder().decode(request.bytes)}
          </pre>
        )}

        {request.kind === 'transaction' && !analysis && <div className="text-[#8a8a8a]">Simulating against {rpcUrl}…</div>}
        {analysis && request.kind === 'transaction' && (
          <div className="flex flex-col gap-2">
            {analysis.simulationError ? (
              <div className="text-[#ff9f0a]">Simulation unavailable: {analysis.simulationError}</div>
            ) : (
              <div className={failed ? 'text-[#ff6961]' : 'text-[#30d158]'}>
                {failed ? `Simulation says it would fail: ${JSON.stringify(sim?.err)}` : 'Simulation says it would succeed.'}
              </div>
            )}
            {delta !== undefined && <div>Your SOL balance would change by {delta >= 0 ? '+' : '−'}{sol(Math.abs(delta))} (includes fee).</div>}
            {analysis.verdict && (
              <div>
                Local inspection: {analysis.verdict.riskLevel} (score {analysis.verdict.riskScore}).{' '}
                {analysis.verdict.detectedThreats.join(' ')}
              </div>
            )}
            {sim?.logs && sim.logs.length > 0 && (
              <pre className="max-h-[140px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-black/40 p-3 font-mono text-[11px] text-white/80">
                {sim.logs.join('\n')}
              </pre>
            )}
          </div>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className={`${BTN} bg-white/[0.05]`} disabled={busy} onClick={() => void decide(false)}>
            Reject
          </button>
          <button
            type="button"
            className={`${BTN} bg-[#0A84FF] text-white`}
            disabled={busy || !ready || blocked}
            title={blocked ? 'Shield blocked this request.' : undefined}
            onClick={() => void decide(true)}
          >
            {blocked ? 'Blocked' : 'Approve & sign'}
          </button>
        </div>
      </div>
    </div>
  );
}
