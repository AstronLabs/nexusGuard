import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { type File } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const PINATA_API_BASE = "https://api.pinata.cloud";

function isValidAddress(addr: string) {
  return /^G[A-Z0-9]{55}$/.test(addr);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const stellarAddress = req.headers["x-stellar-address"] as string;
  if (!stellarAddress || !isValidAddress(stellarAddress)) {
    return res.status(401).json({ success: false, error: "Valid x-stellar-address header required" });
  }

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
  let fields: formidable.Fields;
  let files: formidable.Files;

  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ success: false, error: "Failed to parse form data" });
  }

  const fileArr = files.file;
  const file: File | undefined = Array.isArray(fileArr) ? fileArr[0] : fileArr;
  if (!file) {
    return res.status(400).json({ success: false, error: "No file provided" });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "video/mp4", "video/webm"];
  if (!allowed.includes(file.mimetype ?? "")) {
    return res.status(400).json({ success: false, error: `File type ${file.mimetype} not allowed` });
  }

  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;
  if (!apiKey || !secretKey) {
    return res.status(503).json({ success: false, error: "IPFS service not configured" });
  }

  const fileBuffer = fs.readFileSync(file.filepath);
  const blob = new Blob([fileBuffer], { type: file.mimetype ?? "application/octet-stream" });
  const formData = new FormData();
  formData.append("file", blob, file.originalFilename ?? "upload");
  formData.append("pinataMetadata", JSON.stringify({
    name: file.originalFilename ?? "upload",
    keyvalues: {
      source: "nexusguard",
      uploader: stellarAddress,
      ...(fields.poolId ? { pool_id: String(fields.poolId) } : {}),
      ...(fields.claimId ? { claim_id: String(fields.claimId) } : {}),
    },
  }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  try {
    const pinRes = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
      } as HeadersInit,
      body: formData,
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
  } finally {
    fs.unlinkSync(file.filepath);
  }
}
