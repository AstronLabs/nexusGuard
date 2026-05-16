import type { NextApiRequest, NextApiResponse } from "next";
import { markAllAsRead } from "../../../lib/server/notifications-store";

function isValidAddress(addr: string) {
  return /^G[A-Z0-9]{55}$/.test(addr);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") return res.status(405).end();

  const stellarAddress = req.headers["x-stellar-address"] as string;
  if (!stellarAddress || !isValidAddress(stellarAddress)) {
    return res.status(401).json({ success: false, error: "Valid x-stellar-address header required" });
  }

  const count = markAllAsRead(stellarAddress);
  return res.json({
    success: true,
    data: { markedAsRead: count },
    timestamp: new Date().toISOString(),
  });
}
