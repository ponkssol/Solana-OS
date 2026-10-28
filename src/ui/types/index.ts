import type { ReactNode } from 'react';

export type GlassIntensity = 'subtle' | 'regular' | 'heavy' | 'ultra' | 'control-center';

export type GlassTint =
  | 'dark'
  | 'light'
  | 'obsidian'
  | 'solana-purple'
  | 'solana-emerald'
  | 'cyan-ice'
  | 'rose-alert';

export type RpcEndpointId = 'mainnet-beta' | 'helius-staked' | 'triton-one' | 'custom-rpc';

export interface RpcEndpointOption {
  id: RpcEndpointId;
  label: string;
  provider: string;
  url: string;
  latencyMs: number;
  slotHeight: number;
  tps: number;
  status: 'optimal' | 'degraded' | 'custom';
}

export interface ControlCenterState {
  activeRpc: RpcEndpointId;
  customRpcUrl?: string;
  antiDrainerShield: boolean;
  processFreezeActive: boolean;
  frozenProcessCount: number;
  isolatedClipboard: boolean;
  clipboardScrubCountdownSec: number;
  displayBrightness: number; // 0 - 100
  systemAudioVolume: number; // 0 - 100
  hapticFeedback: boolean;
  enclaveLocked: boolean;
}

export type AppCloneTemplateId =
  | 'phantom'
  | 'solflare'
  | 'backpack'
  | 'isolated-browser'
  | 'cursor-ide'
  | 'discord-web3';

export type CloneSandboxStatus = 'running' | 'frozen' | 'isolated-enclave';

export interface ClonedAppInstance {
  id: string;
  appId: AppCloneTemplateId;
  instanceName: string;
  profileTag: string;
  namespacePid: number;
  boundWalletLabel: string;
  boundAddressShort: string;
  rpcRoute: string;
  status: CloneSandboxStatus;
  cpuPercent: number;
  memoryMb: number;
  networkKbps: number;
  isolatedFilesystemPath: string;
  clipboardSandboxed: boolean;
}

export type WalletBrand = 'phantom' | 'solflare' | 'backpack';

export interface SplTokenHolding {
  symbol: string;
  name: string;
  mintShort: string;
  balance: string;
  usdValue: string;
  change24h: string;
  isPositive: boolean;
  accentColor: string;
}

export interface SafeTxSimulation {
  txId: string;
  dappOrigin: string;
  programName: string;
  programIdShort: string;
  instructionSummary: string;
  estimatedFeeSol: string;
  priorityFeeMicroLamports: string;
  balanceChanges: Array<{
    asset: string;
    delta: string;
    direction: 'in' | 'out';
    verifiedMint: boolean;
  }>;
  antiDrainerChecks: {
    ownerAuthorityUnchanged: boolean;
    noHiddenSetAuthority: boolean;
    knownProgramVerified: boolean;
    cpiDepthSafe: boolean;
  };
  riskScore: 'SAFE' | 'WARN' | 'BLOCKED';
}

export interface StandaloneWalletProfile {
  brand: WalletBrand;
  title: string;
  version: string;
  accountName: string;
  addressShort: string;
  solBalance: string;
  usdTotal: string;
  change24hUsd: string;
  hardwareSigner: {
    connected: boolean;
    model: string;
    enclaveMode: string;
  };
  tokens: SplTokenHolding[];
  pendingSimulation: SafeTxSimulation;
}

export interface VaultItemRecord {
  id: string;
  label: string;
  category: 'seed-24' | 'keypair-json' | 'hardware-shard' | 'passkey';
  cipherSuite: 'ML-KEM-1024 + AES-256-GCM' | 'CRYSTALS-Dilithium5' | 'Shamir-2of3-PQ';
  derivationPath?: string;
  publicKeyShort: string;
  createdAt: string;
  lastVerified: string;
  biometricRequired: boolean;
  yubikeySlot?: string;
  maskedPreview: string[];
}

export interface AnchorProgramTarget {
  name: string;
  programId: string;
  binarySizeKb: number;
  computeUnitsAvg: number;
  rentExemptSol: string;
  idlMethods: Array<{
    name: string;
    accountsCount: number;
    argsSignature: string;
    mutability: 'writable' | 'readonly';
  }>;
  buildStatus: 'verified-sbf' | 'building' | 'ready';
}

export interface WindowControlProps {
  id?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeTone?: 'emerald' | 'purple' | 'cyan' | 'amber' | 'rose';
  icon?: ReactNode;
  isFocused?: boolean;
  isFrozen?: boolean;
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onToggleFreeze?: () => void;
  headerRight?: ReactNode;
  embedded?: boolean;
  children: ReactNode;
}
