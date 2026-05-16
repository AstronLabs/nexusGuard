import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.json({
    success: true,
    data: {
      status: "ok",
      service: "nexusguard-api",
      network: process.env.STELLAR_NETWORK ?? "testnet",
      factory: process.env.CONTRACT_FACTORY ? "configured" : "missing",
      ipfs: process.env.PINATA_API_KEY ? "configured" : "missing",
    },
    timestamp: new Date().toISOString(),
  });
}
