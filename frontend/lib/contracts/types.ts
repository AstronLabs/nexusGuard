/** Mirrors the Soroban Pool contract data structures */

export enum PoolStatus {
  Active = "Active",
  Paused = "Paused",
  Matured = "Matured",
  Closed = "Closed",
}

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
  status: PoolStatus;
  totalFunds: bigint;
  memberCount: number;
  maxMembers: number;
  contributionAmount: bigint;
  claimCount: number;
  createdAt: number;
  expiresAt: number;
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
