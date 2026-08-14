import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth as useClerkAuth } from "@clerk/react";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Phone,
  Mail,
  Building2,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Lead = {
  id: number;
  karmId: string;
  rfqId: number | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  productInterest: string | null;
  avgMonthlyQty: string | null;
  leadSource: string | null;
  requirementStatus: string;
  dealStatus: string;
  quotationSent: boolean;
  followUpAt: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeadDetail = Lead & {
  activities: Array<{
    id: number;
    mode: string;
    subject: string | null;
    summary: string;
    nextAction: string | null;
    followUpAt: string | null;
    handledBy: string | null;
    createdAt: string;
  }>;
  quotations: Array<{
    id: number;
    productName: string;
    quantity: number | null;
    unitPrice: number | null;
    currency: string;
    status: string;
    createdAt: string;
  }>;
};

const STATUSES = ["new", "contacted", "quoted", "negotiation", "won", "lost"];

/**
 * Seller CRM — leads inbox (from RFQs + share card inquiries).
 */
export function SellerLeadsPage() {
  const [, navigate] = useLocation();
  const { user, isLoaded, isLoggedIn } = useAuth();
  const { getToken } = useClerkAuth();
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getToken]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const headers = await authHeaders();
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/leads${q}`, { headers });
      if (!res.ok) {
        setLoadError(`Could not load leads (${res.status}).`);
        setItems([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as { items: Lead[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setLoadError("Could not load leads. Check your connection.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, statusFilter]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isLoggedIn) {
      navigate("/login?mode=seller&redirect=/seller/leads");
      return;
    }
    if (user?.role !== "seller" && user?.role !== "admin") {
      navigate("/buyer");
      return;
    }
    void loadList();
  }, [isLoaded, isLoggedIn, user?.role, loadList, navigate]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const headers = await authHeaders();
      const res = await fetch(`/api/leads/${selectedId}`, { headers });
      if (!cancelled && res.ok) {
        setDetail((await res.json()) as LeadDetail);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, authHeaders]);

  async function updateStatus(id: number, requirementStatus: string) {
    setSaving(true);
    setSaveFeedback(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ requirementStatus }),
      });
      if (!res.ok) {
        setSaveFeedback("Could not update status. Try again.");
        return;
      }
      setSaveFeedback("Status saved.");
      await loadList();
      if (selectedId === id) {
        const detailRes = await fetch(`/api/leads/${id}`, { headers });
        if (detailRes.ok) setDetail((await detailRes.json()) as LeadDetail);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !note.trim()) return;
    setSaving(true);
    setSaveFeedback(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/leads/${selectedId}/activities`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: "note", summary: note.trim() }),
      });
      if (!res.ok) {
        setSaveFeedback("Could not save note. Try again.");
        return;
      }
      setNote("");
      setSaveFeedback("Note saved.");
      const detailRes = await fetch(`/api/leads/${selectedId}`, { headers });
      if (detailRes.ok) setDetail((await detailRes.json()) as LeadDetail);
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded || !isLoggedIn) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      <div className="bg-secondary text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <button
            type="button"
            onClick={() => navigate("/seller")}
            className="inline-flex items-center gap-1 text-white/70 text-sm mb-3 hover:text-white"
          >
            <ArrowLeft size={14} /> Seller Central
          </button>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">CRM Leads</h1>
          <p className="text-white/65 text-sm mt-1">
            Buyer inquiries from RFQs and shareable profile cards · {total} total
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4">
          <label className="sm:hidden block text-xs font-semibold text-muted-foreground mb-1.5">
            Status filter
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="sm:hidden w-full min-h-11 border border-border rounded-xl px-3 text-sm bg-white capitalize"
            aria-label="Filter leads by status"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="hidden sm:flex flex-wrap gap-2">
            <FilterChip
              active={!statusFilter}
              label="All"
              onClick={() => setStatusFilter("")}
            />
            {STATUSES.map((s) => (
              <FilterChip
                key={s}
                active={statusFilter === s}
                label={s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          <div
            className={`lg:col-span-2 bg-white rounded-xl border border-border overflow-hidden ${
              selectedId != null ? "hidden lg:block" : ""
            }`}
          >
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <div className="p-8 text-center text-sm space-y-4">
                <p className="text-red-600">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadList()}
                  className="inline-flex items-center justify-center bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90"
                >
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground space-y-4">
                <p>No leads yet. Share your profile card or wait for RFQs.</p>
                <button
                  type="button"
                  onClick={() => navigate("/seller/plans")}
                  className="inline-flex items-center justify-center bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90"
                >
                  Share profile card
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
                {items.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(lead.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                        selectedId === lead.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{lead.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {lead.productInterest || lead.company || lead.karmId}
                          </div>
                        </div>
                        <StatusBadge status={lead.requirementStatus} />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex gap-2">
                        <span>{lead.leadSource || "—"}</span>
                        <span>·</span>
                        <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className={`lg:col-span-3 bg-white rounded-xl border border-border p-5 min-h-[320px] ${
              selectedId == null ? "hidden lg:block" : ""
            }`}
          >
            {!detail ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select a lead to view details
              </div>
            ) : (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground min-h-11"
                >
                  <ArrowLeft size={14} /> Back to leads
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{detail.karmId}</p>
                    <h2 className="font-heading text-xl font-bold">{detail.name}</h2>
                    {detail.company && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 size={13} /> {detail.company}
                        {detail.country ? ` · ${detail.country}` : ""}
                      </p>
                    )}
                  </div>
                  <select
                    value={detail.requirementStatus}
                    disabled={saving}
                    onChange={(e) => void updateStatus(detail.id, e.target.value)}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 capitalize"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {saveFeedback && (
                  <p
                    className={`text-sm rounded-lg px-3 py-2 ${
                      saveFeedback.startsWith("Could")
                        ? "bg-red-50 text-red-700 border border-red-100"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                    }`}
                    role="status"
                  >
                    {saveFeedback}
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  {detail.email && (
                    <a href={`mailto:${detail.email}`} className="flex items-center gap-2 text-primary">
                      <Mail size={14} /> {detail.email}
                    </a>
                  )}
                  {detail.phone && (
                    <a href={`tel:${detail.phone}`} className="flex items-center gap-2 text-primary">
                      <Phone size={14} /> {detail.phone}
                    </a>
                  )}
                  {detail.productInterest && (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Interest: </span>
                      {detail.productInterest}
                      {detail.avgMonthlyQty ? ` · ${detail.avgMonthlyQty}` : ""}
                    </p>
                  )}
                  {detail.comments && (
                    <p className="sm:col-span-2 text-muted-foreground">{detail.comments}</p>
                  )}
                  {detail.followUpAt && (
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <Clock size={13} /> Follow-up{" "}
                      {new Date(detail.followUpAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {detail.rfqId != null && (
                  <button
                    type="button"
                    onClick={() => navigate(`/rfq/${detail.rfqId}`)}
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    Open linked RFQ →
                  </button>
                )}

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <MessageSquare size={14} /> Activity
                  </h3>
                  <form onSubmit={(e) => void addNote(e)} className="flex gap-2 mb-3">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note…"
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      disabled={saving || !note.trim()}
                      className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      Save
                    </button>
                  </form>
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {detail.activities.length === 0 && (
                      <li className="text-xs text-muted-foreground">No activity yet</li>
                    )}
                    {detail.activities.map((a) => (
                      <li key={a.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                        <p>{a.summary}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {a.handledBy || "System"} · {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                {detail.quotations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Quotations</h3>
                    <ul className="space-y-1 text-sm">
                      {detail.quotations.map((q) => (
                        <li key={q.id} className="flex justify-between gap-2">
                          <span>
                            {q.productName}
                            {q.unitPrice != null
                              ? ` · ${q.currency} ${q.unitPrice}`
                              : ""}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {q.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
        active
          ? "bg-secondary text-white"
          : "bg-white border border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-yellow-100 text-yellow-800",
    contacted: "bg-blue-100 text-blue-800",
    quoted: "bg-indigo-100 text-indigo-800",
    negotiation: "bg-purple-100 text-purple-800",
    won: "bg-emerald-100 text-emerald-800",
    lost: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
        colors[status] || "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
