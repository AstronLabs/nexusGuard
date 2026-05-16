import type { NextApiRequest, NextApiResponse } from "next";
import { getAllFactoryPools, getPoolSummary } from "../../../lib/server/soroban";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const pools = await getAllFactoryPools();
    const summaries = await Promise.allSettled(pools.map((p) => getPoolSummary(p.address)));

    let totalBalance = BigInt(0);
    let totalMembers = 0;
    let totalClaims = 0;
    let activePools = 0;
    let formationPools = 0;

    for (const r of summaries) {
      if (r.status === "fulfilled" && r.value) {
        const s = r.value;
        totalBalance += s.balance;
        totalMembers += s.memberCount;
        totalClaims += s.claimCount;
        if (s.phase === "Active") activePools++;
        if (s.phase === "Formation") formationPools++;
      }
    }

    return res.json({
      success: true,
      data: {
        totalPools: pools.length,
        activePools,
        formationPools,
        totalBalance: totalBalance.toString(),
        totalMembers,
        totalClaims,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}
