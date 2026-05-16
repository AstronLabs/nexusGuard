import type { NextApiRequest, NextApiResponse } from "next";
import { getByRecipient, getUnreadCount } from "../../../lib/server/notifications-store";

function isValidAddress(addr: string) {
  return /^G[A-Z0-9]{55}$/.test(addr);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const stellarAddress = req.headers["x-stellar-address"] as string;
  if (!stellarAddress || !isValidAddress(stellarAddress)) {
    return res.status(401).json({ success: false, error: "Valid x-stellar-address header required" });
  }

  const limit = parseInt(req.query.limit as string, 10) || 50;
  const unreadOnly = req.query.unreadOnly === "true";

  const notifications = getByRecipient(stellarAddress, limit, unreadOnly);
  const unreadCount = getUnreadCount(stellarAddress);

  return res.json({
    success: true,
    data: { notifications, unreadCount },
    timestamp: new Date().toISOString(),
  });
}
