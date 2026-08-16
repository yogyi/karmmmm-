import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  User,
  FileCheck2,
  Landmark,
  BadgeCheck,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import { validateGstin } from "@/lib/gstin";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: Step; title: string; blurb: string; icon: React.ReactNode }[] = [
  { id: 1, title: "Company", blurb: "Business profile", icon: <Building2 size={16} /> },
  { id: 2, title: "Contact", blurb: "Authorized person", icon: <User size={16} /> },
  { id: 3, title: "GST", blurb: "Tax registration", icon: <FileCheck2 size={16} /> },
  { id: 4, title: "Bank & certs", blurb: "Payout details", icon: <Landmark size={16} /> },
  { id: 5, title: "Verify", blurb: "Review & submit", icon: <BadgeCheck size={16} /> },
];

interface FormState {
  companyName: string;
  legalName: string;
  location: string;
  city: string;
  state: string;
  pincode: string;
  businessAddress: string;
  country: string;
  description: string;
  yearsInBusiness: string;
  employeeCount: string;
  mainProducts: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  gstin: string;
  bankAccountName: string;
  bankIfsc: string;
  certifications: string;
}

const emptyForm: FormState = {
  companyName: "",
  legalName: "",
  location: "",
  city: "",
  state: "",
  pincode: "",
  businessAddress: "",
  country: "India",
  description: "",
  yearsInBusiness: "",
  employeeCount: "",
  mainProducts: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  website: "",
  gstin: "",
  bankAccountName: "",
  bankIfsc: "",
  certifications: "",
};

/** Required-field check for a wizard step (used for locking + Save & continue). */
function validateStepForForm(form: FormState, current: Step): string | null {
  if (current === 1) {
    if (!form.companyName.trim()) return "Company name is required";
    if (!form.legalName.trim()) return "Legal entity name is required";
    if (!form.city.trim() && !form.location.trim()) return "City / location is required";
    if (!form.businessAddress.trim()) return "Registered business address is required";
    if (!form.state.trim()) return "State is required";
  }
  if (current === 2) {
    if (!form.contactPerson.trim()) return "Contact person is required";
    if (!/^[6-9]\d{9}$/.test(form.contactPhone.trim())) {
      return "Enter a valid 10-digit Indian mobile number";
    }
    if (!form.contactEmail.trim().includes("@")) return "Valid contact email is required";
  }
  if (current === 3) {
    const gst = validateGstin(form.gstin);
    if (!gst.ok) return gst.error;
  }
  if (current === 4) {
    if (!form.bankAccountName.trim()) return "Account holder name is required";
    if (!form.bankIfsc.trim()) return "IFSC code is required";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.bankIfsc.trim())) {
      return "IFSC format looks invalid (e.g. HDFC0001234)";
    }
  }
  return null;
}

function isStepComplete(form: FormState, s: Step): boolean {
  if (s === 5) {
    return ([1, 2, 3, 4] as Step[]).every((x) => validateStepForForm(form, x) === null);
  }
  return validateStepForForm(form, s) === null;
}

function firstIncompleteStep(form: FormState): Step {
  for (const s of [1, 2, 3, 4] as Step[]) {
    if (!isStepComplete(form, s)) return s;
  }
  return 5;
}

/** Per-field messages for the active step (banner alone is not enough). */
function fieldErrorsForStep(
  form: FormState,
  current: Step,
): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (current === 1) {
    if (!form.companyName.trim()) errors.companyName = "Company name is required";
    if (!form.legalName.trim()) errors.legalName = "Legal entity name is required";
    if (!form.businessAddress.trim()) {
      errors.businessAddress = "Registered business address is required";
    }
    if (!form.city.trim() && !form.location.trim()) errors.city = "City is required";
    if (!form.state.trim()) errors.state = "State is required";
  }
  if (current === 2) {
    if (!form.contactPerson.trim()) errors.contactPerson = "Contact person is required";
    if (!/^[6-9]\d{9}$/.test(form.contactPhone.trim())) {
      errors.contactPhone = "Enter a valid 10-digit Indian mobile number";
    }
    if (!form.contactEmail.trim().includes("@")) {
      errors.contactEmail = "Valid contact email is required";
    }
  }
  if (current === 3) {
    const gst = validateGstin(form.gstin);
    if (!gst.ok) errors.gstin = gst.error;
  }
  if (current === 4) {
    if (!form.bankAccountName.trim()) {
      errors.bankAccountName = "Account holder name is required";
    }
    if (!form.bankIfsc.trim()) {
      errors.bankIfsc = "IFSC code is required";
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.bankIfsc.trim())) {
      errors.bankIfsc = "IFSC format looks invalid (e.g. HDFC0001234)";
    }
  }
  return errors;
}

/**
 * Alibaba-style seller verification wizard.
 * Captures company → contact → GST (checksum validated) → bank → submit → verified badge.
 */
export function SellerVerificationPage() {
  const { user, isLoggedIn, isLoaded, profileReady, refreshProfile } = useAuth();
  const { getToken } = useClerkAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  /** Highest step successfully saved to the server (not merely filled in the form). */
  const [highestSavedStep, setHighestSavedStep] = useState(0);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [declared, setDeclared] = useState(false);

  useEffect(() => {
    if (!isLoaded || !profileReady) return;
    if (!isLoggedIn) {
      navigate("/login?mode=seller");
      return;
    }
    if (user?.role === "buyer") {
      navigate("/buyer");
      return;
    }
    void loadProfile();
  }, [isLoaded, profileReady, isLoggedIn, user?.id, user?.role]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (highestSavedStep < 4 && !verified) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [highestSavedStep, verified]);

  async function loadProfile() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/suppliers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        setForm((f) => ({
          ...f,
          companyName: user?.company ?? "",
          contactEmail: user?.email ?? "",
          contactPerson: user?.name ?? "",
        }));
        setHighestSavedStep(0);
        setStep(1);
        return;
      }
      if (!res.ok) return;
      const s = (await res.json()) as Record<string, unknown>;
      if (s.verified === true || s.verificationStatus === "verified") {
        setVerified(true);
        navigate("/seller");
        return;
      }
      const loaded: FormState = {
        companyName: String(s.companyName ?? ""),
        legalName: String(s.legalName ?? ""),
        location: String(s.location ?? ""),
        city: String(s.city ?? ""),
        state: String(s.state ?? ""),
        pincode: String(s.pincode ?? ""),
        businessAddress: String(s.businessAddress ?? ""),
        country: String(s.country ?? "India"),
        description: String(s.description ?? ""),
        yearsInBusiness: s.yearsInBusiness != null ? String(s.yearsInBusiness) : "",
        employeeCount: String(s.employeeCount ?? ""),
        mainProducts: Array.isArray(s.mainProducts)
          ? (s.mainProducts as string[]).join(", ")
          : "",
        contactPerson: String(s.contactPerson ?? user?.name ?? ""),
        contactPhone: String(s.contactPhone ?? ""),
        contactEmail: String(s.contactEmail ?? user?.email ?? ""),
        website: String(s.website ?? ""),
        gstin: String(s.gstin ?? ""),
        bankAccountName: String(s.bankAccountName ?? ""),
        bankIfsc: String(s.bankIfsc ?? ""),
        certifications: Array.isArray(s.certifications)
          ? (s.certifications as string[]).join(", ")
          : "",
      };
      setForm(loaded);
      const incomplete = firstIncompleteStep(loaded);
      // Persisted data implies prior steps were saved on the server.
      setHighestSavedStep(incomplete === 5 ? 4 : incomplete - 1);
      const requested = Number(
        new URLSearchParams(window.location.search).get("step"),
      );
      setStep(
        requested >= 1 && requested <= 5 ? (requested as Step) : incomplete,
      );
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setShowFieldErrors(false);
  }

  function stepPayload(current: Step): Record<string, unknown> {
    if (current === 1) {
      return {
        companyName: form.companyName,
        legalName: form.legalName,
        location: form.location || [form.city, form.state].filter(Boolean).join(", "),
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        businessAddress: form.businessAddress,
        country: form.country || "India",
        description: form.description,
        yearsInBusiness: form.yearsInBusiness ? Number(form.yearsInBusiness) : null,
        employeeCount: form.employeeCount,
        mainProducts: form.mainProducts
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      };
    }
    if (current === 2) {
      return {
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        website: form.website,
      };
    }
    if (current === 3) {
      return { gstin: form.gstin };
    }
    if (current === 4) {
      return {
        bankAccountName: form.bankAccountName,
        bankIfsc: form.bankIfsc,
        certifications: form.certifications
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      };
    }
    return {};
  }

  function validateLocal(current: Step): string | null {
    return validateStepForForm(form, current);
  }

  const maxUnlockedStep = useMemo(
    (): Step => Math.min(5, highestSavedStep + 1) as Step,
    [highestSavedStep],
  );
  const stepValid = validateLocal(step) === null;
  const fieldErrors = showFieldErrors ? fieldErrorsForStep(form, step) : {};

  function goToStep(target: Step) {
    if (target > maxUnlockedStep) {
      setError(
        `Save “${STEPS[Math.max(0, maxUnlockedStep - 1)]?.title ?? "this"}” before continuing.`,
      );
      setStep(maxUnlockedStep);
      return;
    }
    setError(null);
    setShowFieldErrors(false);
    setStep(target);
  }

  async function saveStep(opts: { submit?: boolean; advance?: boolean } = {}) {
    const localErr = opts.submit ? null : validateLocal(step);
    if (localErr) {
      setError(localErr);
      setShowFieldErrors(true);
      return;
    }
    if (opts.submit) {
      if (!declared) {
        setError("Please confirm the declaration before submitting");
        return;
      }
      for (const s of [1, 2, 3, 4] as Step[]) {
        const e = validateLocal(s);
        if (e) {
          setError(e);
          setShowFieldErrors(true);
          setStep(s);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);
    setShowFieldErrors(false);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired — sign in again");
      const res = await fetch("/api/suppliers/me/verification", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step,
          submit: opts.submit === true,
          data: stepPayload(opts.submit ? 5 : step),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        verified?: boolean;
        nextStep?: number;
      };
      if (!res.ok) throw new Error(body.error || "Could not save");
      await refreshProfile();
      setHighestSavedStep((prev) => Math.max(prev, opts.submit ? 4 : step));
      if (body.verified || opts.submit) {
        setVerified(true);
        navigate("/seller");
        return;
      }
      if (opts.advance !== false) {
        // Always advance only one step after a successful validated save.
        setStep(Math.min(5, step + 1) as Step);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded || !profileReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8]">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (verified) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      <div className="bg-[#1a3a4a] text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-xs uppercase tracking-widest text-white/50 mb-2">
            Seller Central · Verification
          </p>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">
            {new URLSearchParams(window.location.search).get("step") === "3"
              ? "Re-verify your GSTIN"
              : "Become a verified seller"}
          </h1>
          <p className="text-white/65 text-sm max-w-xl">
            {new URLSearchParams(window.location.search).get("step") === "3"
              ? "Your verified badge is paused. Confirm or update GSTIN, then submit to get verified again."
              : "Complete KYC with GST registration so buyers can trust your shop — same idea as Alibaba's verified suppliers."}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-4 pb-16">
        {/* Progress */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 mb-6">
          <p className="sm:hidden text-sm font-semibold mb-3">
            Step {step} of {STEPS.length}: {STEPS.find((s) => s.id === step)?.title}
          </p>
          <ol className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {STEPS.map((s) => {
              const complete = s.id <= highestSavedStep || (s.id === 5 && highestSavedStep >= 4);
              const unlocked = s.id <= maxUnlockedStep;
              const active = step === s.id;
              return (
                <li key={s.id} className="flex-1 min-w-[7.5rem] sm:min-w-0 snap-start">
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => goToStep(s.id)}
                    title={
                      unlocked
                        ? s.title
                        : `Complete step ${maxUnlockedStep} first`
                    }
                    className={`w-full rounded-xl px-2 py-2.5 min-h-11 text-left transition-colors ${
                      active
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : complete
                          ? "bg-green-50"
                          : unlocked
                            ? "bg-muted/40 hover:bg-muted"
                            : "bg-muted/20 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          complete
                            ? "bg-green-600 text-white"
                            : active
                              ? "bg-primary text-white"
                              : "bg-muted-foreground/20 text-muted-foreground"
                        }`}
                      >
                        {complete ? <Check size={12} /> : s.id}
                      </span>
                      <span className="text-xs font-semibold truncate">{s.title}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-6 truncate hidden sm:block">
                      {s.blurb}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          {step === 1 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">Company profile</h2>
              <Field label="Trade / display name *" value={form.companyName} onChange={(v) => update("companyName", v)} placeholder="Gujarat Textile Mills" error={fieldErrors.companyName} />
              <Field label="Legal entity name *" value={form.legalName} onChange={(v) => update("legalName", v)} placeholder="As on GST certificate" error={fieldErrors.legalName} />
              <Field label="Registered address *" value={form.businessAddress} onChange={(v) => update("businessAddress", v)} placeholder="Plot / street / area" error={fieldErrors.businessAddress} />
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="City *" value={form.city} onChange={(v) => update("city", v)} placeholder="Surat" error={fieldErrors.city} />
                <Field label="State *" value={form.state} onChange={(v) => update("state", v)} placeholder="Gujarat" error={fieldErrors.state} />
                <Field label="PIN code" value={form.pincode} onChange={(v) => update("pincode", v)} placeholder="395003" />
              </div>
              <Field label="Country" value={form.country} onChange={(v) => update("country", v)} />
              <Field label="About your business" value={form.description} onChange={(v) => update("description", v)} textarea placeholder="What do you manufacture or wholesale?" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Years in business" value={form.yearsInBusiness} onChange={(v) => update("yearsInBusiness", v)} placeholder="8" />
                <Field label="Employees" value={form.employeeCount} onChange={(v) => update("employeeCount", v)} placeholder="51-200" />
              </div>
              <Field label="Main products (comma-separated)" value={form.mainProducts} onChange={(v) => update("mainProducts", v)} placeholder="Cotton fabric, Denim, Yarn" />
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">Authorized contact</h2>
              <p className="text-sm text-muted-foreground">
                Buyers and Karm Baba will use this for RFQs and verification calls.
              </p>
              <Field label="Contact person *" value={form.contactPerson} onChange={(v) => update("contactPerson", v)} placeholder="Full name" error={fieldErrors.contactPerson} />
              <Field label="Mobile *" value={form.contactPhone} onChange={(v) => update("contactPhone", v)} placeholder="9876543210" error={fieldErrors.contactPhone} />
              <Field label="Work email *" value={form.contactEmail} onChange={(v) => update("contactEmail", v)} placeholder="sales@company.com" error={fieldErrors.contactEmail} />
              <Field label="Website" value={form.website} onChange={(v) => update("website", v)} placeholder="https://" />
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">GST registration</h2>
              <p className="text-sm text-muted-foreground">
                We validate your 15-digit GSTIN format and checksum (same algorithm used for GST
                registration numbers in India). Your PAN is derived from GSTIN automatically.
              </p>
              <Field
                label="GSTIN *"
                value={form.gstin}
                onChange={(v) => update("gstin", v.toUpperCase())}
                placeholder="27AAPFU0939F1ZV"
                error={fieldErrors.gstin}
              />
              <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-muted-foreground space-y-1">
                <p>· GSTIN must match your legal business name</p>
                <p>· State code (first 2 digits) should match your registered state</p>
                <p>· Fake or mistyped numbers fail checksum validation</p>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">Bank & certifications</h2>
              <Field label="Account holder name *" value={form.bankAccountName} onChange={(v) => update("bankAccountName", v)} placeholder="As per bank passbook" error={fieldErrors.bankAccountName} />
              <Field label="IFSC *" value={form.bankIfsc} onChange={(v) => update("bankIfsc", v.toUpperCase())} placeholder="HDFC0001234" error={fieldErrors.bankIfsc} />
              <Field label="Certifications (comma-separated)" value={form.certifications} onChange={(v) => update("certifications", v)} placeholder="ISO 9001, BIS, Organic" />
            </section>
          )}

          {step === 5 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">Review & get verified</h2>
              <div className="rounded-xl border border-border divide-y divide-border text-sm">
                <ReviewRow label="Company" value={form.companyName} />
                <ReviewRow label="Legal name" value={form.legalName || "—"} />
                <ReviewRow label="Address" value={form.businessAddress} />
                <ReviewRow label="Location" value={[form.city, form.state, form.pincode].filter(Boolean).join(", ")} />
                <ReviewRow label="Contact" value={`${form.contactPerson} · ${form.contactPhone}`} />
                <ReviewRow label="GSTIN" value={form.gstin} />
                <ReviewRow label="Bank" value={form.bankAccountName || "—"} />
              </div>
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                />
                <span>
                  I confirm the details are accurate and I am authorized to register this business
                  on Karm Baba. False GST details may lead to removal.
                </span>
              </label>
            </section>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={step === 1 || saving}
              onClick={() => goToStep(Math.max(1, step - 1) as Step)}
              className="inline-flex items-center gap-1.5 px-4 min-h-11 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-40"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {step < 5 ? (
              <button
                type="button"
                disabled={saving || !stepValid}
                onClick={() => void saveStep({ advance: true })}
                className="inline-flex items-center gap-1.5 px-5 min-h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Save & continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || !declared || maxUnlockedStep < 5}
                onClick={() => void saveStep({ submit: true })}
                className="inline-flex items-center gap-1.5 px-5 min-h-11 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
                Submit & verify seller
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  error?: string;
}) {
  const cls = `w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 bg-white ${
    error
      ? "border-red-400 focus:ring-red-200"
      : "border-border focus:ring-primary/30"
  }`;
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground mb-1.5 block">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          aria-invalid={error ? true : undefined}
          className={cls}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={cls}
        />
      )}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3">
      <div className="sm:w-28 shrink-0 text-muted-foreground text-xs sm:text-sm">{label}</div>
      <div className="font-medium text-foreground break-all">{value || "—"}</div>
    </div>
  );
}
