/**
 * Live GSTIN verification via gstinapi.in (default) or GSTVerify (legacy).
 * Requires GST_VERIFY_API_KEY in environment — never expose to the browser.
 */

import { GST_STATE_CODES, normalizeGstin, validateGstin } from "./gstin";

const DEFAULT_GSTINAPI_BASE = "https://www.gstinapi.in";
const DEFAULT_GSTVERIFY_BASE = "https://gstverify.co.in";

export type GstLiveRecord = {
  gstin: string;
  legalName: string;
  tradeName: string | null;
  status: string;
  pan: string | null;
  state: string | null;
  stateCode: string | null;
  address: string | null;
  constitution: string | null;
  taxpayerType: string | null;
  registrationDate: string | null;
  cached: boolean;
};

export type GstLiveVerifyResult =
  | { ok: true; record: GstLiveRecord }
  | { ok: false; error: string; httpStatus?: number };

type GstProvider = "gstinapi" | "gstverify";

function apiKey(): string | null {
  const key = process.env.GST_VERIFY_API_KEY?.trim();
  return key || null;
}

function apiBase(): string {
  return (process.env.GST_VERIFY_API_BASE_URL?.trim() || DEFAULT_GSTINAPI_BASE).replace(/\/$/, "");
}

function provider(): GstProvider {
  const explicit = process.env.GST_VERIFY_PROVIDER?.trim().toLowerCase();
  if (explicit === "gstverify" || explicit === "gstinapi") {
    return explicit;
  }
  const base = apiBase().toLowerCase();
  const key = apiKey() ?? "";
  if (base.includes("gstverify") || base.includes("gstverify.co.in")) {
    return "gstverify";
  }
  if (base.includes("gstinapi") || key.startsWith("gak_")) {
    return "gstinapi";
  }
  return "gstinapi";
}

export function isGstLiveVerifyConfigured(): boolean {
  return Boolean(apiKey());
}

function isActiveGstStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "active" || s === "active (regular)" || s.startsWith("active ");
}

type GstApiData = {
  gstin?: string;
  legal_name?: string;
  trade_name?: string;
  status?: string;
  pan?: string;
  state?: string;
  state_code?: string;
  address?: string;
  constitution?: string;
  business_constitution?: string;
  taxpayer_type?: string;
  registration_date?: string;
};

type GstApiPayload = {
  success?: boolean;
  error?: string;
  message?: string;
  cached?: boolean;
  data?: GstApiData;
};

function buildRequest(gstin: string, key: string): { url: string; headers: Record<string, string> } {
  if (provider() === "gstverify") {
    const base = apiBase().includes("gstverify") ? apiBase() : DEFAULT_GSTVERIFY_BASE;
    return {
      url: `${base}/api/v1/verify/${encodeURIComponent(gstin)}`,
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
      },
    };
  }

  const base = apiBase().includes("gstinapi") ? apiBase() : DEFAULT_GSTINAPI_BASE;
  return {
    url: `${base}/v1/gstin/${encodeURIComponent(gstin)}`,
    headers: {
      "x-api-key": key,
      Accept: "application/json",
    },
  };
}

function mapRecord(data: GstApiData, formatPan: string, formatStateCode: string): GstLiveRecord | null {
  if (!data.gstin || !data.status) return null;

  const status = String(data.status).trim();
  const stateCode = data.state_code?.trim() || formatStateCode;

  return {
    gstin: normalizeGstin(data.gstin),
    legalName: String(data.legal_name ?? "").trim() || "—",
    tradeName: data.trade_name?.trim() || null,
    status,
    pan: data.pan?.trim() || formatPan,
    state: data.state?.trim() || GST_STATE_CODES[stateCode] || null,
    stateCode,
    address: data.address?.trim() || null,
    constitution: data.constitution?.trim() || data.business_constitution?.trim() || null,
    taxpayerType: data.taxpayer_type?.trim() || null,
    registrationDate: data.registration_date?.trim() || null,
    cached: false,
  };
}

function authErrorMessage(): string {
  if (provider() === "gstinapi") {
    return "GSTIN API rejected the key — check x-api-key at gstinapi.in dashboard.";
  }
  return "GSTVerify rejected the API key — generate a new key at gstverify.co.in/dev-api.";
}

export async function verifyGstinLive(rawGstin: string): Promise<GstLiveVerifyResult> {
  const format = validateGstin(rawGstin);
  if (!format.ok) {
    return { ok: false, error: format.error };
  }

  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      error:
        "Live GST verification is not configured on the server. Set GST_VERIFY_API_KEY.",
    };
  }

  const gstin = format.gstin;
  const { url, headers } = buildRequest(gstin, key);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return {
      ok: false,
      error: "Could not reach GST verification service. Try again in a moment.",
    };
  }

  let body: GstApiPayload;
  try {
    body = (await res.json()) as GstApiPayload;
  } catch {
    return {
      ok: false,
      error: "GST verification returned an invalid response",
      httpStatus: res.status,
    };
  }

  if (res.status === 401) {
    return { ok: false, error: authErrorMessage(), httpStatus: 401 };
  }
  if (res.status === 402) {
    return { ok: false, error: "GST verification credits exhausted — contact support", httpStatus: 402 };
  }
  if (res.status === 404) {
    return {
      ok: false,
      error: body.error || body.message || "GSTIN not found in GSTN records",
      httpStatus: 404,
    };
  }
  if (res.status === 422 || res.status === 400) {
    return { ok: false, error: body.error || body.message || "Invalid GSTIN", httpStatus: res.status };
  }
  if (res.status === 429) {
    return { ok: false, error: "Too many GST checks — wait a minute and try again", httpStatus: 429 };
  }
  if (res.status === 502) {
    return { ok: false, error: "Government GST service is temporarily unavailable", httpStatus: 502 };
  }
  if (!res.ok || body.success === false) {
    return {
      ok: false,
      error: body.error || body.message || `GST verification failed (${res.status})`,
      httpStatus: res.status,
    };
  }

  const data = body.data;
  if (!data?.gstin || !data.status) {
    return { ok: false, error: "GST verification returned incomplete data", httpStatus: res.status };
  }

  const status = String(data.status).trim();
  if (!isActiveGstStatus(status)) {
    return {
      ok: false,
      error: `GSTIN is registered but status is "${status}" — only Active GSTINs can onboard`,
      httpStatus: 400,
    };
  }

  const record = mapRecord(data, format.pan, format.stateCode);
  if (!record) {
    return { ok: false, error: "GST verification returned incomplete data", httpStatus: res.status };
  }

  return { ok: true, record: { ...record, cached: Boolean(body.cached) } };
}

/** Optional: warn when form legal name diverges from GSTN legal name. */
export function gstLegalNameMatches(formLegalName: string, apiLegalName: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(private|limited|pvt|ltd|llp|inc|co|company)\b/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = norm(formLegalName);
  const b = norm(apiLegalName);
  if (!a || !b) return true;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aTokens = new Set(a.split(" ").filter((t) => t.length > 2));
  const bTokens = new Set(b.split(" ").filter((t) => t.length > 2));
  let overlap = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) overlap += 1;
  }
  return overlap >= Math.min(2, Math.min(aTokens.size, bTokens.size));
}
