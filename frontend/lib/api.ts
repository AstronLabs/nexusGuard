/**
 * NexusGuard API client.
 * All endpoints are Next.js API routes at /api/* (same origin — no external backend needed).
 */

const BASE = "";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  timestamp: string;
};

async function request<T>(
  path: string,
  options: RequestInit & { stellarAddress?: string } = {}
): Promise<T> {
  const { stellarAddress, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string>),
  };
  if (stellarAddress) headers["x-stellar-address"] = stellarAddress;

  const res = await fetch(`${BASE}${path}`, { ...fetchOpts, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body?.error ?? body?.message ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const body: ApiResponse<T> = await res.json();
  if (!body.success) throw new Error("API returned success=false");
  return body.data;
}

// ── IPFS ──────────────────────────────────────────────────────────

export type UploadResult = {
  cid: string;
  url: string;
  size?: number;
};

/** Upload evidence file to IPFS via the backend proxy. */
export async function uploadEvidenceFile(
  file: File,
  stellarAddress: string,
  poolAddress?: string,
  claimId?: number
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (poolAddress) form.append("poolId", poolAddress);
  if (claimId !== undefined) form.append("claimId", String(claimId));

  return request<UploadResult>("/api/ipfs/upload", {
    method: "POST",
    body: form,
    stellarAddress,
  });
}

/** Upload JSON metadata to IPFS (used for pool creation). */
export async function uploadMetadataJson(
  data: Record<string, unknown>,
  name: string,
  stellarAddress: string
): Promise<UploadResult> {
  return request<UploadResult>("/api/ipfs/upload-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, name }),
    stellarAddress,
  });
}

/** Check if a CID is pinned. */
export async function checkCidPinned(
  cid: string
): Promise<{ cid: string; isPinned: boolean; gatewayUrl: string }> {
  return request(`/api/ipfs/pin/${cid}`);
}

// ── Claims precheck ───────────────────────────────────────────────

export type PreCheckResult = {
  valid: boolean;
  errors: string[];
};

export type FraudFlag = {
  rule: string;
  triggered: boolean;
  score: number;
  detail: string;
};

export type FraudReport = {
  claimId: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  flags: FraudFlag[];
  recommendation: "auto-proceed" | "manual-review" | "reject";
  timestamp: string;
};

/** Run pre-submission validation + fraud analysis against the backend. */
export async function preCheckClaim(
  poolAddress: string,
  amount: bigint,
  evidenceCid: string,
  stellarAddress: string
): Promise<{ preCheck: PreCheckResult; fraudReport: FraudReport }> {
  return request<{ preCheck: PreCheckResult; fraudReport: FraudReport }>(
    "/api/claims/precheck",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poolAddress,
        amount: amount.toString(),
        evidenceCid,
      }),
      stellarAddress,
    }
  );
}

// ── Pools ─────────────────────────────────────────────────────────

export type PoolListItem = {
  address: string;
  creator: string;
  createdAt: number;
  summary: Record<string, unknown> | null;
};

/** List all pools with summaries from the backend. */
export async function listPools(): Promise<PoolListItem[]> {
  return request<PoolListItem[]>("/api/pools");
}

// ── Notifications ─────────────────────────────────────────────────

export type Notification = {
  id: number;
  recipient: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

/** Fetch notifications for the connected wallet. */
export async function getNotifications(
  stellarAddress: string
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  return request<{ notifications: Notification[]; unreadCount: number }>("/api/notifications", { stellarAddress });
}

/** Mark a notification as read. */
export async function markNotificationRead(
  id: number,
  stellarAddress: string
): Promise<void> {
  await request<void>(`/api/notifications/${id}/read`, {
    method: "PATCH",
    stellarAddress,
  });
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead(
  stellarAddress: string
): Promise<void> {
  await request<void>("/api/notifications/read-all", {
    method: "PATCH",
    stellarAddress,
  });
}
