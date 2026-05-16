import type { NextApiRequest, NextApiResponse } from "next";
import { getAllFactoryPools, getPoolSummary, type OnChainPoolSummary } from "../../../lib/server/soroban";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const pools = await getAllFactoryPools();
    const withSummaries = await Promise.all(
      pools.map(async (p) => {
        const summary = await getPoolSummary(p.address).catch(() => null);
        return { ...p, summary };
      })
    );
    return res.json({
      success: true,
      data: withSummaries,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}
