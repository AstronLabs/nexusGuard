/**
 * Server-side Soroban helpers (Next.js API routes only).
 * Do NOT import this from client-side pages.
 */
import * as StellarSdk from "@stellar/stellar-sdk";

const FACTORY = process.env.CONTRACT_FACTORY ?? "";
const RPC_URL =
  process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === "mainnet"
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;
const PUBLIC_KEY =
  process.env.STELLAR_PUBLIC_KEY ??
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

export type OnChainClaim = {
  id: number;
  claimant: string;
  amount: bigint;
  description: string;
  evidenceCid: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  submittedAt: number;
  deadline: number;
  updatedAt: number;
  executed: boolean;
};

export type OnChainPoolSummary = {
  name: string;
  description: string;
  creator: string;
  phase: string;
  balance: bigint;
  memberCount: number;
  minMembers: number;
  maxMembers: number;
  fixedContribution: bigint;
  claimCount: number;
  currentCycle: number;
  signerCount: number;
  createdAt: number;
  activatedAt: number;
  expiresAt: number;
  paused: boolean;
};

export type FactoryPoolRecord = {
  address: string;
  creator: string;
  metadataCid: string;
  createdAt: number;
  paused: boolean;
};

function getClient() {
  return new StellarSdk.rpc.Server(RPC_URL);
}

async function simulate(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<StellarSdk.xdr.ScVal | null> {
  const client = getClient();
  const account = await client.getAccount(PUBLIC_KEY);
  const contract = new StellarSdk.Contract(contractId);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await client.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationSuccess(sim)) {
    return sim.result?.retval ?? null;
  }
  return null;
}

export async function getAllFactoryPools(): Promise<FactoryPoolRecord[]> {
  if (!FACTORY) return [];
  try {
    const result = await simulate(FACTORY, "get_all_pools");
    if (!result) return [];
    const native = StellarSdk.scValToNative(result) as Record<string, unknown>[];
    return native.map((r) => ({
      address: String(r.address ?? ""),
      creator: String(r.creator ?? ""),
      metadataCid: String(r.metadata_cid ?? ""),
      createdAt: Number(r.created_at ?? 0),
      paused: Boolean(r.paused ?? false),
    }));
  } catch {
    return [];
  }
}

export async function getPoolSummary(
  poolAddress: string
): Promise<OnChainPoolSummary | null> {
  try {
    const result = await simulate(poolAddress, "get_summary");
    if (!result) return null;
    const r = StellarSdk.scValToNative(result) as Record<string, unknown>;
    const phaseRaw = r.phase;
    const phaseKey =
      typeof phaseRaw === "object" && phaseRaw !== null
        ? Object.keys(phaseRaw as object)[0]
        : String(phaseRaw ?? "Formation");
    return {
      name: String(r.name ?? ""),
      description: String(r.description ?? ""),
      creator: String(r.creator ?? ""),
      phase: phaseKey,
      balance: BigInt((r.balance as string | number) ?? 0),
      memberCount: Number(r.member_count ?? 0),
      minMembers: Number(r.min_members ?? 15),
      maxMembers: Number(r.max_members ?? 30),
      fixedContribution: BigInt((r.fixed_contribution as string | number) ?? 0),
      claimCount: Number(r.claim_count ?? 0),
      currentCycle: Number(r.current_cycle ?? 0),
      signerCount: Number(r.signer_count ?? 0),
      createdAt: Number(r.created_at ?? 0),
      activatedAt: Number(r.activated_at ?? 0),
      expiresAt: Number(r.expires_at ?? 0),
      paused: Boolean(r.paused ?? false),
    };
  } catch {
    return null;
  }
}

export async function isPoolMemberActive(
  poolAddress: string,
  address: string
): Promise<boolean> {
  try {
    const result = await simulate(poolAddress, "is_member_active", [
      StellarSdk.nativeToScVal(address, { type: "address" }),
    ]);
    if (!result) return false;
    return StellarSdk.scValToNative(result) as boolean;
  } catch {
    return false;
  }
}

export async function getPoolAllClaims(
  poolAddress: string
): Promise<OnChainClaim[]> {
  try {
    const result = await simulate(poolAddress, "get_all_claims");
    if (!result) return [];
    const native = StellarSdk.scValToNative(result) as Record<string, unknown>[];
    return native.map(parseOnChainClaim);
  } catch {
    return [];
  }
}

function parseOnChainClaim(r: Record<string, unknown>): OnChainClaim {
  const statusRaw = r.status;
  const statusKey =
    typeof statusRaw === "object" && statusRaw !== null
      ? Object.keys(statusRaw as object)[0]
      : String(statusRaw ?? "PendingReview");
  return {
    id: Number(r.id ?? 0),
    claimant: String(r.claimant ?? ""),
    amount: BigInt((r.amount as string | number) ?? 0),
    description: String(r.description ?? ""),
    evidenceCid: String(r.evidence_cid ?? ""),
    status: statusKey,
    votesFor: Number(r.votes_for ?? 0),
    votesAgainst: Number(r.votes_against ?? 0),
    submittedAt: Number(r.submitted_at ?? 0),
    deadline: Number(r.deadline ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
    executed: Boolean(r.executed ?? false),
  };
}
