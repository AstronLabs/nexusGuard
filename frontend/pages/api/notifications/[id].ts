import type { NextApiRequest, NextApiResponse } from "next";
import {
  markAsRead,
  deleteNotification,
} from "../../../lib/server/notifications-store";

function isValidAddress(addr: string) {
  return /^G[A-Z0-9]{55}$/.test(addr);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const stellarAddress = req.headers["x-stellar-address"] as string;
  if (!stellarAddress || !isValidAddress(stellarAddress)) {
    return res.status(401).json({ success: false, error: "Valid x-stellar-address header required" });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id ?? "";

  if (req.method === "PATCH") {
    const updated = markAsRead(id);
    if (!updated) return res.status(404).json({ success: false, error: "Notification not found" });
    return res.json({ success: true, data: { id, read: true }, timestamp: new Date().toISOString() });
  }

  if (req.method === "DELETE") {
    const deleted = deleteNotification(id);
    if (!deleted) return res.status(404).json({ success: false, error: "Notification not found" });
    return res.json({ success: true, data: { id, deleted: true }, timestamp: new Date().toISOString() });
  }

  return res.status(405).end();
}
