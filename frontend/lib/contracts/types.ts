/** Mirrors the Soroban Pool contract data structures */

export enum PoolPhase {
  Formation = "Formation",
  Active = "Active",
  Closed = "Closed",
}

/** @deprecated use PoolPhase */
export type PoolStatus = PoolPhase;

export enum ClaimStatus {
  PendingReview = "PendingReview",
  Approved = "Approved",
  Rejected = "Rejected",
  Expired = "Expired",
  PaidOut = "PaidOut",
}

export enum Role {
  Creator = "Creator",
  Manager = "Manager",
  Member = "Member",
}

export type PoolSummary = {
  name: string;
  description: string;
  creator: string;
  phase: PoolPhase;
  /** @deprecated use phase */
  status: PoolPhase;
  totalFunds: bigint;
  memberCount: number;
  minMembers: number;
  maxMembers: number;
  contributionAmount: bigint;
  claimCount: number;
  currentCycle: number;
  signerCount: number;
  createdAt: number;
  activatedAt: number;
  expiresAt: number;
  paused: boolean;
};

export type Claim = {
  id: number;
  claimant: string;
  amount: bigint;
  description: string;
  evidenceCid: string;
  status: ClaimStatus;
  votesFor: number;
  votesAgainst: number;
  submittedAt: number;
  deadline: number;
  updatedAt: number;
  executed: boolean;
};

export type FactoryPoolInfo = {
  id: number;
  address: string;
  creator: string;
  metadataCid: string;
  createdAt: number;
  active: boolean;
};

/** Pool category enum matching contract's PoolCategory */
export const POOL_CATEGORY_MAP: Record<string, number> = {
  Health: 0,
  Crop: 1,
  Property: 2,
  Vehicle: 3,
  Travel: 4,
  Business: 5,
  Other: 6,
};

/** Configuration passed when creating a pool via Factory */
export type CreatePoolParams = {
  name: string;
  description: string;
  category: number;
  contributionAmount: bigint;
  maxMembers: number;
  metadataCid: string;
};
