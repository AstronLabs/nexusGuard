import type { NextApiRequest, NextApiResponse } from "next";
import {
  getPoolSummary,
  isPoolMemberActive,
  getPoolAllClaims,
  getAllFactoryPools,
} from "../../../lib/server/soroban";

function isValidAddress(addr: string) {
  return /^G[A-Z0-9]{55}$/.test(addr);
}

function isValidCid(cid: string) {
  return /^(Qm[a-zA-Z0-9]{44}|b[a-z2-7]{58,})$/.test(cid);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const stellarAddress = req.headers["x-stellar-address"] as string;
  if (!stellarAddress || !isValidAddress(stellarAddress)) {
    return res.status(401).json({ success: false, error: "Valid x-stellar-address header required" });
  }

  const { poolAddress, amount, evidenceCid } = req.body ?? {};
  if (!poolAddress || !amount) {
    return res.status(400).json({ success: false, error: "Missing poolAddress or amount" });
  }

  const amountBigInt = BigInt(amount);

  // ── Pre-submission check ──────────────────────────────────────
  const preCheckErrors: string[] = [];

  const [summary, isActive] = await Promise.all([
    getPoolSummary(poolAddress).catch(() => null),
    isPoolMemberActive(poolAddress, stellarAddress).catch(() => false),
  ]);

  if (!summary) preCheckErrors.push("Pool not found");
  else if (summary.phase !== "Active") preCheckErrors.push(`Pool is not active (phase: ${summary.phase})`);
  else if (summary.paused) preCheckErrors.push("Pool is currently paused");

  if (!isActive) preCheckErrors.push("You are not an active pool member (missed contribution?)");
  if (amountBigInt <= BigInt(0)) preCheckErrors.push("Claim amount must be positive");
  if (!evidenceCid || !isValidCid(evidenceCid)) preCheckErrors.push("Invalid or missing evidence IPFS CID");

  // ── Fraud analysis ────────────────────────────────────────────
  const flags: { rule: string; triggered: boolean; score: number; detail: string }[] = [];
  let fraudScore = 0;

  const claims = await getPoolAllClaims(poolAddress).catch(() => []);

  // Rule 1: Duplicate — same claimant, 2+ claims in 30 days
  const now = Math.floor(Date.now() / 1000);
  const userRecentClaims = claims.filter(
    (c) => c.claimant === stellarAddress && now - c.submittedAt < 30 * 86400
  );
  if (userRecentClaims.length >= 2) {
    const score = Math.min(userRecentClaims.length * 5, 20);
    flags.push({ rule: "duplicate_claim", triggered: true, score, detail: `${userRecentClaims.length} claims in last 30 days.` });
    fraudScore += score;
  }

  // Rule 2: Velocity — 3+ claims in 90 days
  const userVelocityClaims = claims.filter(
    (c) => c.claimant === stellarAddress && now - c.submittedAt < 90 * 86400
  );
  if (userVelocityClaims.length > 3) {
    const excess = userVelocityClaims.length - 3;
    const score = Math.min(Math.ceil((excess / 3) * 20), 20);
    flags.push({ rule: "velocity_check", triggered: true, score, detail: `${userVelocityClaims.length} claims in last 90 days.` });
    fraudScore += score;
  }

  // Rule 3: Inactive member
  if (!isActive) {
    flags.push({ rule: "inactive_member", triggered: true, score: 20, detail: "Claimant is not an active member." });
    fraudScore += 20;
  }

  // Rule 4: Amount anomaly — > 80% of assumed threshold
  const AMOUNT_THRESHOLD = BigInt(10_000_000);
  if (amountBigInt > (AMOUNT_THRESHOLD * BigInt(80)) / BigInt(100)) {
    const score = Math.min(Math.ceil((Number(amountBigInt) / Number(AMOUNT_THRESHOLD)) * 10), 20);
    flags.push({ rule: "amount_anomaly", triggered: true, score, detail: `Amount ${amountBigInt.toString()} stroops is unusually high.` });
    fraudScore += score;
  }

  // Rule 5: Multi-pool pattern
  try {
    const allPools = await getAllFactoryPools();
    let userCrossPoolClaims = 0;
    let totalCrossPoolClaims = 0;
    await Promise.allSettled(
      allPools
        .filter((p) => p.address !== poolAddress)
        .map(async (p) => {
          const c = await getPoolAllClaims(p.address);
          totalCrossPoolClaims += c.length;
          userCrossPoolClaims += c.filter((cl) => cl.claimant === stellarAddress).length;
        })
    );
    if (totalCrossPoolClaims > 0 && userCrossPoolClaims > 0) {
      const ratio = userCrossPoolClaims / totalCrossPoolClaims;
      if (ratio > 0.5) {
        const score = Math.min(Math.ceil(ratio * 20), 20);
        flags.push({ rule: "multi_pool_pattern", triggered: true, score, detail: `${Math.round(ratio * 100)}% of cross-pool claims from this address.` });
        fraudScore += score;
      }
    }
  } catch {}

  const riskLevel = fraudScore <= 30 ? "low" : fraudScore <= 60 ? "medium" : "high";
  const recommendation = riskLevel === "low" ? "auto-proceed" : riskLevel === "medium" ? "manual-review" : "reject";

  return res.status(200).json({
    success: true,
    data: {
      preCheck: { valid: preCheckErrors.length === 0, errors: preCheckErrors },
      fraudReport: {
        claimId: 0,
        riskScore: fraudScore,
        riskLevel,
        flags,
        recommendation,
        timestamp: new Date().toISOString(),
      },
    },
    timestamp: new Date().toISOString(),
  });
}
