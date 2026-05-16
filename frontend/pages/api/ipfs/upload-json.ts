import type { NextApiRequest, NextApiResponse } from "next";

const PINATA_API_BASE = "https://api.pinata.cloud";

function isValidAddress(addr: string) {
  return /^G[A-Z0-9]{55}$/.test(addr);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const stellarAddress = req.headers["x-stellar-address"] as string;
  if (!stellarAddress || !isValidAddress(stellarAddress)) {
    return res.status(401).json({ success: false, error: "Valid x-stellar-address header required" });
  }

  const { data, name } = req.body ?? {};
  if (!data || !name) {
    return res.status(400).json({ success: false, error: "Missing required fields: data, name" });
  }

  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;
  if (!apiKey || !secretKey) {
    return res.status(503).json({ success: false, error: "IPFS service not configured" });
  }

  try {
    const pinRes = await fetch(`${PINATA_API_BASE}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
      } as HeadersInit,
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: {
          name,
          keyvalues: { source: "nexusguard", uploader: stellarAddress },
        },
        pinataOptions: { cidVersion: 1 },
      }),
    });

    if (!pinRes.ok) {
      const errBody = await pinRes.text();
      return res.status(502).json({ success: false, error: `Pinata error: ${errBody}` });
    }

    const result = await pinRes.json() as { IpfsHash: string; PinSize: number };
    return res.status(201).json({
      success: true,
      data: {
        cid: result.IpfsHash,
        url: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
        size: result.PinSize,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}
