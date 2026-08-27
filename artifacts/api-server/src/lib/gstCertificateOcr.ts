/**
 * GST Certificate OCR via RapidAPI (IDfy).
 * Env: GST_CERTIFICATE_OCR_RAPIDAPI_KEY (never expose to the browser).
 *
 * Supports JPEG/PNG and multi-page PDF (GST REG certificates are often 3 pages).
 * PDFs: try native PDF OCR first; on failure, rasterize each page and retry.
 */

import { randomUUID } from "node:crypto";
import { normalizeGstin, validateGstin } from "./gstin";
import { gstLegalNameMatches } from "./gstVerifyApi";

const DEFAULT_HOST = "gst-certificate-ocr.p.rapidapi.com";
const DEFAULT_PATH = "/v3/tasks/sync/extract/ind_gst_certificate";
const MAX_PDF_PAGES = 5;

/** Phrases that appear on official GST registration certificates (Form GST REG-06 etc.). */
const GST_CERTIFICATE_MARKERS = [
  /goods\s+and\s+services\s+tax/i,
  /gst\s*in\s*india/i,
  /form\s*gst\s*reg[-\s]?0?6/i,
  /registration\s+certificate/i,
  /certificate\s+of\s+registration/i,
  /central\s+board\s+of\s+indirect\s+taxes/i,
  /gstn\s+portal/i,
  /provisional\s+registration/i,
  /valid\s+upto/i,
  /date\s+of\s+liability/i,
  /principal\s+place\s+of\s+business/i,
  /gstin\s*\/\s*uin/i,
];

export type GstCertificateOcrFields = {
  gstin: string | null;
  legalName: string | null;
  tradeName: string | null;
  address: string | null;
  pan: string | null;
  status: string | null;
};

export type GstCertificateOcrResult =
  | { ok: true; fields: GstCertificateOcrFields; raw: unknown }
  | { ok: false; error: string; httpStatus?: number; raw?: unknown };

function apiKey(): string | null {
  return (
    process.env.GST_CERTIFICATE_OCR_RAPIDAPI_KEY?.trim() ||
    process.env.RAPIDAPI_GST_CERTIFICATE_OCR_KEY?.trim() ||
    null
  );
}

function apiHost(): string {
  return (
    process.env.GST_CERTIFICATE_OCR_RAPIDAPI_HOST?.trim() || DEFAULT_HOST
  ).replace(/^https?:\/\//, "");
}

export function isGstCertificateOcrConfigured(): boolean {
  return Boolean(apiKey());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

const GSTIN_RE = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b/i;

export type NormalizedOcrDoc =
  | { ok: true; value: string; kind: "url" | "base64"; mime: string | null; isPdf: boolean }
  | { ok: false; error: string };

/** Normalize document payload for IDfy: raw base64 or https URL. PDF allowed. */
export function normalizeOcrDocumentPayload(input: string): NormalizedOcrDoc {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "GST certificate document is empty" };

  if (/^https?:\/\//i.test(raw)) {
    const isPdf = /\.pdf(\?|$)/i.test(raw);
    return { ok: true, value: raw, kind: "url", mime: isPdf ? "application/pdf" : null, isPdf };
  }

  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrl) {
    const mime = dataUrl[1].toLowerCase();
    const b64 = dataUrl[2].replace(/\s+/g, "");
    if (!b64) return { ok: false, error: "GST certificate document is empty" };
    return {
      ok: true,
      value: b64,
      kind: "base64",
      mime,
      isPdf: mime.includes("pdf"),
    };
  }

  // Raw base64 — detect PDF magic (%PDF) after decode when possible
  const cleaned = raw.replace(/\s+/g, "");
  let isPdf = false;
  try {
    const head = Buffer.from(cleaned.slice(0, 32), "base64").toString("utf8");
    isPdf = head.startsWith("%PDF");
  } catch {
    /* ignore */
  }
  return {
    ok: true,
    value: cleaned,
    kind: "base64",
    mime: isPdf ? "application/pdf" : null,
    isPdf,
  };
}

function walkForGstin(node: unknown, depth = 0): string | null {
  if (depth > 8 || node == null) return null;
  if (typeof node === "string") {
    const m = node.toUpperCase().match(GSTIN_RE);
    return m ? m[1].toUpperCase() : null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = walkForGstin(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const rec = asRecord(node);
  if (!rec) return null;
  for (const [k, v] of Object.entries(rec)) {
    if (/gstin|gst_in|gst.?number/i.test(k) && typeof v === "string") {
      const norm = normalizeGstin(v) || v.toUpperCase().match(GSTIN_RE)?.[1];
      if (norm) return norm.toUpperCase();
    }
  }
  for (const v of Object.values(rec)) {
    const found = walkForGstin(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function walkForField(node: unknown, keys: RegExp, depth = 0): string | null {
  if (depth > 8 || node == null) return null;
  const rec = asRecord(node);
  if (!rec) return null;
  for (const [k, v] of Object.entries(rec)) {
    if (keys.test(k)) {
      const s = pickString(v);
      if (s) return s;
    }
  }
  for (const v of Object.values(rec)) {
    if (typeof v === "object") {
      const found = walkForField(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Walk common IDfy / RapidAPI response shapes for extracted GST fields. */
export function parseGstCertificateOcrPayload(raw: unknown): GstCertificateOcrFields {
  const root = asRecord(raw) ?? {};
  const result =
    asRecord(root.result) ||
    asRecord(root.data) ||
    asRecord(root.ocr_output) ||
    asRecord(asRecord(root.result)?.extraction_output) ||
    asRecord(asRecord(root.result)?.details) ||
    root;

  const nested =
    asRecord(result.extraction_output) ||
    asRecord(result.details) ||
    asRecord(result.document) ||
    result;

  const gstin =
    pickString(
      nested.gstin,
      nested.GSTIN,
      nested.gst_in,
      nested.gstNumber,
      nested.gst_number,
    ) || walkForGstin(raw);

  return {
    gstin: gstin ? gstin.toUpperCase() : null,
    legalName:
      pickString(
        nested.legal_name,
        nested.legalName,
        nested.LegalName,
        nested.name_of_business,
        nested.business_name,
      ) || walkForField(raw, /legal.?name|name_of_business|business_name/i),
    tradeName:
      pickString(nested.trade_name, nested.tradeName, nested.TradeName) ||
      walkForField(raw, /trade.?name/i),
    address:
      pickString(nested.address, nested.Address, nested.principal_place) ||
      walkForField(raw, /address|principal_place/i),
    pan:
      pickString(nested.pan, nested.pan_number, nested.PAN) ||
      walkForField(raw, /^pan$|pan_number/i),
    status: pickString(
      nested.status,
      nested.gst_status,
      nested.registration_status,
      root.status,
    ),
  };
}

function humanizeRapidApiError(raw: unknown, httpStatus: number): string {
  const root = asRecord(raw) ?? {};
  const code = pickString(root.error, root.error_code)?.toUpperCase() || "";
  const message = pickString(root.message, root.error_message) || "";

  if (code === "INVALID_IMAGE" || /non compliant|quality/i.test(message)) {
    return "Certificate file was rejected by OCR — use a clear official GST certificate PDF or full-page JPEG/PNG scan.";
  }
  if (code === "BAD_REQUEST" || /malformed/i.test(message)) {
    return "OCR could not read this file — re-upload the GST certificate PDF/photo and try again.";
  }
  if (message) return message;
  return `GST certificate OCR failed (${httpStatus})`;
}

async function callRapidApiOcr(
  documentPayload: string,
): Promise<GstCertificateOcrResult> {
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      error: "GST certificate OCR is not configured (missing RapidAPI key)",
      httpStatus: 503,
    };
  }

  const host = apiHost();
  const url = `https://${host}${DEFAULT_PATH}`;
  const body = {
    task_id: randomUUID(),
    group_id: randomUUID(),
    data: {
      document1: documentPayload,
      consent: "yes",
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": host,
        "x-rapidapi-key": key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error && e.name === "TimeoutError"
          ? "GST certificate OCR timed out — try again"
          : "Could not reach GST certificate OCR service",
      httpStatus: 502,
    };
  }

  const raw = (await res.json().catch(() => null)) as unknown;
  const root = asRecord(raw) ?? {};

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: "GST certificate OCR key was rejected — check RapidAPI subscription",
      httpStatus: res.status,
      raw,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: humanizeRapidApiError(raw, res.status),
      httpStatus: res.status >= 400 && res.status < 600 ? res.status : 400,
      raw,
    };
  }

  const status = pickString(root.status)?.toLowerCase();
  if (status === "failed" || root.error) {
    return {
      ok: false,
      error: humanizeRapidApiError(raw, 400),
      httpStatus: 400,
      raw,
    };
  }

  const fields = parseGstCertificateOcrPayload(raw);
  const authenticity = assertGstCertificateOcrAuthentic(fields, raw);
  if (!authenticity.ok) {
    return {
      ok: false,
      error: authenticity.error,
      httpStatus: 400,
      raw,
    };
  }

  return { ok: true, fields: authenticity.fields, raw };
}

/**
 * Reject random PDFs/photos that are not a GST registration certificate.
 * Requires a checksum-valid GSTIN, a business legal name, and GST-certificate
 * markers in the OCR payload (or enough structured GST fields).
 */
export function assertGstCertificateOcrAuthentic(
  fields: GstCertificateOcrFields,
  raw: unknown,
): { ok: true; fields: GstCertificateOcrFields } | { ok: false; error: string } {
  if (!fields.gstin) {
    return {
      ok: false,
      error:
        "OCR could not find a GSTIN on this file — upload the official GST registration certificate (Form GST REG-06), not a random PDF",
    };
  }

  const gst = validateGstin(fields.gstin);
  if (!gst.ok) {
    return {
      ok: false,
      error:
        "OCR found an invalid GSTIN — this does not look like a genuine GST registration certificate",
    };
  }

  const legalName = fields.legalName?.trim() || null;
  if (!legalName || legalName.length < 3) {
    return {
      ok: false,
      error:
        "OCR could not read the legal business name — upload a clear official GST certificate PDF (all pages)",
    };
  }

  // Reject generic junk names often returned when the model invents fields.
  if (/^(n\/?a|null|none|test|unknown|undefined)$/i.test(legalName)) {
    return {
      ok: false,
      error:
        "OCR did not extract a real legal name — upload the official GST registration certificate",
    };
  }

  const panFromGstin = gst.pan;
  if (fields.pan) {
    const pan = fields.pan.replace(/\s+/g, "").toUpperCase();
    if (pan.length === 10 && pan !== panFromGstin) {
      return {
        ok: false,
        error:
          "PAN on the certificate does not match the GSTIN — upload the correct GST registration certificate",
      };
    }
  }

  const blob = collectOcrTextBlob(raw);
  const markerHits = GST_CERTIFICATE_MARKERS.filter((re) => re.test(blob)).length;
  const structuredScore =
    (fields.address ? 1 : 0) +
    (fields.tradeName ? 1 : 0) +
    (fields.pan ? 1 : 0) +
    (fields.status ? 1 : 0);

  // Need either clear GST-certificate language in the OCR text, or enough
  // structured GST fields that only a real REG certificate OCR returns.
  if (markerHits < 1 && structuredScore < 2) {
    return {
      ok: false,
      error:
        "This file does not look like a GST registration certificate. Upload Form GST REG-06 / official GSTN certificate PDF — invoices, Aadhaar, or random PDFs are rejected.",
    };
  }

  return {
    ok: true,
    fields: {
      ...fields,
      gstin: gst.gstin,
      legalName,
      pan: fields.pan ? fields.pan.replace(/\s+/g, "").toUpperCase() : panFromGstin,
    },
  };
}

function collectOcrTextBlob(raw: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown, depth: number) => {
    if (depth > 10 || node == null) return;
    if (typeof node === "string") {
      if (node.length > 0 && node.length < 4000) parts.push(node);
      return;
    }
    if (typeof node === "number" || typeof node === "boolean") {
      parts.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    for (const [k, v] of Object.entries(rec)) {
      parts.push(k);
      walk(v, depth + 1);
    }
  };
  walk(raw, 0);
  return parts.join(" ");
}

/** Rasterize PDF pages to JPEG base64 strings (for OCR fallback). */
export async function pdfPagesToJpegBase64(
  pdfBytes: Buffer,
  maxPages = MAX_PDF_PAGES,
): Promise<string[]> {
  const { pdf } = await import("pdf-to-img");
  const document = await pdf(pdfBytes, { scale: 2 });
  const pages: string[] = [];
  let i = 0;
  for await (const image of document) {
    pages.push(Buffer.from(image).toString("base64"));
    i += 1;
    if (i >= maxPages) break;
  }
  return pages;
}

function shouldRetryPdfAsImages(result: GstCertificateOcrResult): boolean {
  if (result.ok) return false;
  const err = result.error.toLowerCase();
  return (
    err.includes("rejected") ||
    err.includes("quality") ||
    err.includes("malformed") ||
    err.includes("could not find a gstin") ||
    err.includes("could not read") ||
    result.httpStatus === 422
  );
}

/**
 * Extract GST fields from certificate image/PDF (base64 data URL or https URL).
 * Multi-page PDF: tries PDF as-is, then page-by-page JPEG OCR if needed.
 */
export async function extractGstCertificateOcr(
  documentBase64OrUrl: string,
): Promise<GstCertificateOcrResult> {
  const normalized = normalizeOcrDocumentPayload(documentBase64OrUrl);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error, httpStatus: 400 };
  }

  const primary = await callRapidApiOcr(normalized.value);
  if (primary.ok) return primary;

  // PDF fallback: rasterize each page and OCR until GSTIN is found.
  if (normalized.isPdf && normalized.kind === "base64" && shouldRetryPdfAsImages(primary)) {
    try {
      const pdfBytes = Buffer.from(normalized.value, "base64");
      const pages = await pdfPagesToJpegBase64(pdfBytes);
      if (pages.length === 0) {
        return {
          ok: false,
          error: "Could not read pages from the GST certificate PDF — re-export and try again",
          httpStatus: 400,
          raw: primary.raw,
        };
      }
      let last: GstCertificateOcrResult = primary;
      for (const pageB64 of pages) {
        last = await callRapidApiOcr(pageB64);
        if (last.ok) return last;
      }
      return {
        ok: false,
        error:
          last.error ||
          "OCR could not find a GSTIN in the PDF pages — upload a clearer GST certificate PDF",
        httpStatus: last.httpStatus ?? 400,
        raw: last.raw,
      };
    } catch {
      return {
        ok: false,
        error:
          primary.error ||
          "Could not process GST certificate PDF — try again or upload a clearer scan",
        httpStatus: primary.httpStatus ?? 400,
        raw: primary.raw,
      };
    }
  }

  return primary;
}

/** True when OCR GSTIN matches the seller-entered GSTIN. */
export function gstCertificateMatchesEntered(
  ocrGstin: string | null | undefined,
  enteredGstin: string,
): boolean {
  const a = normalizeGstin(ocrGstin ?? "");
  const b = normalizeGstin(enteredGstin);
  return Boolean(a && b && a === b);
}

/**
 * After GSTIN match, optionally require OCR legal/trade name to align with
 * the live GSTN legal name already stored on the supplier.
 */
export function gstCertificateNameConsistentWithLive(args: {
  ocrLegalName: string | null | undefined;
  ocrTradeName: string | null | undefined;
  liveLegalName: string | null | undefined;
  liveTradeName: string | null | undefined;
}): boolean {
  const liveLegal = args.liveLegalName?.trim() || "";
  const liveTrade = args.liveTradeName?.trim() || "";
  if (!liveLegal && !liveTrade) return true; // no live name to compare

  const ocrLegal = args.ocrLegalName?.trim() || "";
  const ocrTrade = args.ocrTradeName?.trim() || "";
  if (!ocrLegal && !ocrTrade) return false;

  const candidates = [ocrLegal, ocrTrade].filter(Boolean);
  const targets = [liveLegal, liveTrade].filter(Boolean);
  for (const c of candidates) {
    for (const t of targets) {
      if (gstLegalNameMatches(c, t)) return true;
    }
  }
  return false;
}
