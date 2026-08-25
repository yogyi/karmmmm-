import type { QueryClient } from "@tanstack/react-query";
import { getListRfqsQueryKey, getGetRfqQueryKey } from "@workspace/api-client-react";

const RFQ_BROADCAST = "karmbaba-rfq-updated";

/** Invalidate every RFQ list/detail/dashboard query so buyer + seller UIs stay in sync. */
export async function invalidateRfqQueries(
  qc: QueryClient,
  opts?: { rfqId?: number; broadcast?: boolean },
) {
  await Promise.all([
    qc.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        const root = String(key[0]);
        return (
          root === "/api/rfq" ||
          root.startsWith("/api/rfq?") ||
          root.includes("/api/rfq") ||
          root.includes("/dashboard")
        );
      },
      refetchType: "active",
    }),
    // Explicit list key variants (with and without params)
    qc.invalidateQueries({ queryKey: getListRfqsQueryKey(), refetchType: "active" }),
    qc.invalidateQueries({ queryKey: ["/api/rfq"], refetchType: "active" }),
  ]);

  if (opts?.rfqId != null) {
    await qc.invalidateQueries({
      queryKey: getGetRfqQueryKey(opts.rfqId),
      refetchType: "active",
    });
  }

  if (opts?.broadcast !== false && typeof window !== "undefined") {
    try {
      const bc = new BroadcastChannel(RFQ_BROADCAST);
      bc.postMessage({ type: "rfq-updated", rfqId: opts?.rfqId ?? null, at: Date.now() });
      bc.close();
    } catch {
      // BroadcastChannel unavailable — polling still covers other tabs/users
    }
  }
}

/** Subscribe to RFQ updates from other tabs in this browser. */
export function subscribeRfqBroadcast(onUpdate: () => void): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }
  const bc = new BroadcastChannel(RFQ_BROADCAST);
  bc.onmessage = () => onUpdate();
  return () => bc.close();
}
