import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, AlertCircle, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useCreateRfq, useListSuppliers } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

export function RfqNewPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const createRfq = useCreateRfq();

  const searchParams = new URLSearchParams(window.location.search);
  const defaultSupplierName = searchParams.get("supplierName") ?? "";

  const [form, setForm] = useState({
    productName: "",
    quantity: "",
    unit: "piece",
    targetPrice: "",
    description: "",
    buyerName: user?.name ?? "",
    buyerEmail: user?.email ?? "",
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.productName || !form.quantity || !form.buyerName || !form.buyerEmail) {
      setError("Please fill all required fields.");
      return;
    }
    try {
      await createRfq.mutateAsync({
        data: {
          productName: form.productName,
          buyerName: form.buyerName,
          buyerEmail: form.buyerEmail,
          quantity: Number(form.quantity),
          unit: form.unit,
          targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
          description: form.description || undefined,
        }
      });
      setSuccess(true);
    } catch {
      setError("Failed to submit RFQ. Please try again.");
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">RFQ Submitted!</h2>
          <p className="text-muted-foreground mb-6">Your request for quotation has been sent. Suppliers will respond within 24 hours.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate("/rfq")} className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              View My RFQs
            </button>
            <button onClick={() => { setSuccess(false); setForm({ productName: "", quantity: "", unit: "piece", targetPrice: "", description: "", buyerName: user?.name ?? "", buyerEmail: user?.email ?? "" }); }} className="border border-border px-6 py-2.5 rounded-lg font-medium hover:bg-muted transition-colors">
              Submit Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Post a Request for Quotation</h1>
          <p className="text-muted-foreground text-sm">Tell suppliers what you need and get competitive quotes</p>
        </div>
      </div>

      {defaultSupplierName && (
        <div className="bg-accent rounded-xl p-3 mb-5 text-sm text-accent-foreground">
          Sending inquiry to: <span className="font-semibold">{defaultSupplierName}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Product/Service Name *</label>
          <input
            type="text"
            value={form.productName}
            onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
            placeholder="e.g. Cotton Fabric, CNC Machine, Basmati Rice"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Quantity Required *</label>
            <input
              type="number"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="e.g. 500"
              min="1"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Unit</label>
            <select
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors bg-white"
            >
              {["piece", "kg", "meter", "liter", "box", "set", "ton", "dozen"].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Target Price per Unit (₹)</label>
          <input
            type="number"
            value={form.targetPrice}
            onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
            placeholder="Your budget per unit (optional)"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Requirements & Specifications</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe your exact requirements, quality standards, delivery timeline, packaging needs..."
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors resize-none"
            rows={4}
          />
        </div>

        <hr className="border-border" />
        <h3 className="font-semibold text-foreground">Contact Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Your Name *</label>
            <input
              type="text"
              value={form.buyerName}
              onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))}
              placeholder="Full name"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email Address *</label>
            <input
              type="email"
              value={form.buyerEmail}
              onChange={e => setForm(f => ({ ...f, buyerEmail: e.target.value }))}
              placeholder="you@company.com"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
              required
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 p-3 rounded-xl border border-red-200">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={createRfq.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-semibold text-base transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {createRfq.isPending ? "Submitting..." : "Submit Request for Quotation"}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Your inquiry will be shared with relevant verified suppliers who will contact you with quotes.
        </p>
      </form>
    </div>
  );
}
