import { afterEach, describe, expect, it, vi } from "vitest";
import { gstLegalNameMatches, verifyGstinLive } from "./gstVerifyApi";

describe("verifyGstinLive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("requires API key", async () => {
    vi.stubEnv("GST_VERIFY_API_KEY", "");
    const result = await verifyGstinLive("29AABCK3456M1Z4");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not configured/i);
    }
  });

  it("accepts active GSTIN from gstinapi.in", async () => {
    vi.stubEnv("GST_VERIFY_API_KEY", "gak_test_key");
    vi.stubEnv("GST_VERIFY_API_BASE_URL", "https://www.gstinapi.in");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          gstin: "29AABCK3456M1Z4",
          legal_name: "Example Industries Private Limited",
          trade_name: "Example Co",
          status: "Active",
          state_code: "29",
          address: "Bengaluru",
          taxpayer_type: "Regular",
          registration_date: "2017-07-01",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyGstinLive("29AABCK3456M1Z4");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.gstinapi.in/v1/gstin/29AABCK3456M1Z4",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "gak_test_key" }),
      }),
    );
    if (result.ok) {
      expect(result.record.legalName).toContain("Example");
      expect(result.record.status).toBe("Active");
    }
  });

  it("accepts active GSTIN from API", async () => {
    vi.stubEnv("GST_VERIFY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          cached: false,
          data: {
            gstin: "29AABCK3456M1Z4",
            legal_name: "Example Industries Private Limited",
            trade_name: "Example Co",
            status: "Active",
            pan: "AABCK3456M",
            state: "Karnataka",
            state_code: "29",
            address: "Bengaluru",
          },
        }),
      }),
    );

    const result = await verifyGstinLive("29AABCK3456M1Z4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.legalName).toContain("Example");
      expect(result.record.status).toBe("Active");
    }
  });

  it("rejects cancelled GSTIN", async () => {
    vi.stubEnv("GST_VERIFY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            gstin: "29AABCK3456M1Z4",
            legal_name: "Closed Co",
            status: "Cancelled",
          },
        }),
      }),
    );

    const result = await verifyGstinLive("29AABCK3456M1Z4");
    expect(result.ok).toBe(false);
  });
});

describe("gstLegalNameMatches", () => {
  it("matches similar legal names", () => {
    expect(
      gstLegalNameMatches(
        "Gujarat Textile Mills Private Limited",
        "GUJARAT TEXTILE MILLS PVT LTD",
      ),
    ).toBe(true);
  });
});
