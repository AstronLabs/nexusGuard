import type { NextApiRequest, NextApiResponse } from "next";

const PINATA_API_BASE = "https://api.pinata.cloud";
const GATEWAY = process.env.PINATA_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs";

function isValidCid(cid: string) {
  return /^(Qm[a-zA-Z0-9]{44}|b[a-z2-7]{58,})$/.test(cid);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const cid = Array.isArray(req.query.cid) ? req.query.cid[0] : req.query.cid ?? "";
  if (!isValidCid(cid)) {
    return res.status(400).json({ success: false, error: "Invalid CID format" });
  }

  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;

  let isPinned = false;
  if (apiKey && secretKey) {
    try {
      const r = await fetch(
        `${PINATA_API_BASE}/data/pinList?hashContains=${cid}&status=pinned`,
        { headers: { pinata_api_key: apiKey, pinata_secret_api_key: secretKey } as HeadersInit }
      );
      if (r.ok) {
        const body = await r.json() as { count: number };
        isPinned = body.count > 0;
      }
    } catch {}
  }

  return res.json({
    success: true,
    data: { cid, isPinned, gatewayUrl: `${GATEWAY}/${cid}` },
    timestamp: new Date().toISOString(),
  });
}
