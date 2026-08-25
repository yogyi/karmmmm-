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
import {
  COUNTRY_OPTIONS,
  isIndiaCountry,
  isValidContactPhone,
} from "@/lib/country";
import { validateBusinessEmail } from "@/lib/businessEmail";
import {
  INDIAN_STATES,
  firstCompanyProfileError,
  validateCompanyProfile,
} from "@/lib/companyProfile";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = 1 | 2 | 3 | 4 | 5;

function wizardSteps(india: boolean): { id: Step; title: string; blurb: string; icon: React.ReactNode }[] {
  return [
    { id: 1, title: "Company", blurb: "Business profile", icon: <Building2 size={16} /> },
    { id: 2, title: "Contact", blurb: india ? "Authorized person" : "Company email", icon: <User size={16} /> },
    india
      ? { id: 3, title: "GST", blurb: "Tax registration", icon: <FileCheck2 size={16} /> }
      : { id: 3, title: "Email OTP", blurb: "Verify company domain", icon: <FileCheck2 size={16} /> },
    india
      ? { id: 4, title: "Bank & certs", blurb: "Payout details", icon: <Landmark size={16} /> }
      : { id: 4, title: "Bank & certs", blurb: "International payout", icon: <Landmark size={16} /> },
    { id: 5, title: "Verify", blurb: "Review & submit", icon: <BadgeCheck size={16} /> },
  ];
}

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
function validateStepForForm(
  form: FormState,
  current: Step,
  opts?: { emailVerified?: boolean },
): string | null {
  const india = isIndiaCountry(form.country);
  if (current === 1) {
    return firstCompanyProfileError({
      companyName: form.companyName,
      legalName: form.legalName,
      businessAddress: form.businessAddress,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      country: form.country,
      location: form.location,
      yearsInBusiness: form.yearsInBusiness,
    });
  }
  if (current === 2) {
    if (!form.contactPerson.trim()) return "Contact person is required";
    if (!isValidContactPhone(form.contactPhone, form.country)) {
      return india
        ? "Enter a valid 10-digit Indian mobile number"
        : "Enter a valid international phone (8–15 digits, + allowed)";
    }
    if (india) {
      if (!form.contactEmail.trim().includes("@")) return "Valid contact email is required";
    } else {
      const biz = validateBusinessEmail(form.contactEmail, form.website);
      if (!biz.ok) return biz.error;
    }
  }
  if (current === 3) {
    if (india) {
      const gst = validateGstin(form.gstin);
      if (!gst.ok) return gst.error;
    } else if (!opts?.emailVerified) {
      return "Verify your company-domain email with the OTP we send";
    }
  }
  if (current === 4) {
    if (!form.bankAccountName.trim()) return "Account holder name is required";
    if (india) {
      if (!form.bankIfsc.trim()) return "IFSC code is required";
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.bankIfsc.trim())) {
        return "IFSC format looks invalid (e.g. HDFC0001234)";
      }
    } else if (
      form.bankIfsc.trim() &&
      !/^[A-Z0-9]{8,11}$/i.test(form.bankIfsc.trim().replace(/\s/g, ""))
    ) {
      return "Bank code should look like a SWIFT/BIC (8–11 characters) if provided";
    }
  }
  return null;
}

function isStepComplete(
  form: FormState,
  s: Step,
  opts?: { emailVerified?: boolean },
): boolean {
  if (s === 5) {
    return ([1, 2, 3, 4] as Step[]).every(
      (x) => validateStepForForm(form, x, opts) === null,
    );
  }
  return validateStepForForm(form, s, opts) === null;
}

function firstIncompleteStep(
  form: FormState,
  opts?: { emailVerified?: boolean },
): Step {
  for (const s of [1, 2, 3, 4] as Step[]) {
    if (!isStepComplete(form, s, opts)) return s;
  }
  return 5;
}

/** Per-field messages for the active step (banner alone is not enough). */
function fieldErrorsForStep(
  form: FormState,
  current: Step,
  opts?: { emailVerified?: boolean },
): Partial<Record<keyof FormState, string>> {
  const india = isIndiaCountry(form.country);
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (current === 1) {
    const profileErrors = validateCompanyProfile({
      companyName: form.companyName,
      legalName: form.legalName,
      businessAddress: form.businessAddress,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      country: form.country,
      location: form.location,
      yearsInBusiness: form.yearsInBusiness,
    });
    Object.assign(errors, profileErrors);
  }
  if (current === 2) {
    if (!form.contactPerson.trim()) errors.contactPerson = "Contact person is required";
    if (!isValidContactPhone(form.contactPhone, form.country)) {
      errors.contactPhone = india
        ? "Enter a valid 10-digit Indian mobile number"
        : "Enter a valid international phone (8–15 digits, + allowed)";
    }
    if (india) {
      if (!form.contactEmail.trim().includes("@")) {
        errors.contactEmail = "Valid contact email is required";
      }
    } else {
      const biz = validateBusinessEmail(form.contactEmail, form.website);
      if (!biz.ok) errors.contactEmail = biz.error;
    }
  }
  if (current === 3 && india) {
    const gst = validateGstin(form.gstin);
    if (!gst.ok) errors.gstin = gst.error;
  }
  if (current === 3 && !india && !opts?.emailVerified) {
    errors.contactEmail = "Complete OTP verification below";
  }
  if (current === 4) {
    if (!form.bankAccountName.trim()) {
      errors.bankAccountName = "Account holder name is required";
    }
    if (india) {
      if (!form.bankIfsc.trim()) {
        errors.bankIfsc = "IFSC code is required";
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.bankIfsc.trim())) {
        errors.bankIfsc = "IFSC format looks invalid (e.g. HDFC0001234)";
      }
    }
  }
  return errors;
}

/**
 * Alibaba-style seller verification wizard.
 * Captures company → contact → GST (format/checksum) → bank → submit → pending review.
 * Verified badge is granted only after admin approval (not checksum alone).
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
  const [pendingReview, setPendingReview] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpConfirming, setOtpConfirming] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);

  const india = isIndiaCountry(form.country);
  const STEPS = useMemo(() => wizardSteps(india), [india]);
  const verifyOpts = useMemo(() => ({ emailVerified }), [emailVerified]);

  const fieldErrors = useMemo(
    () => (showFieldErrors ? fieldErrorsForStep(form, step, verifyOpts) : {}),
    [showFieldErrors, form, step, verifyOpts],
  );

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
      if (s.verificationStatus === "pending") {
        setPendingReview(true);
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
      const emailOk = s.businessEmailVerified === true;
      setEmailVerified(emailOk);
      // Re-run validation after load so incomplete PIN/state blocks continue.
      const incomplete = firstIncompleteStep(loaded, { emailVerified: emailOk });
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
    return validateStepForForm(form, current, verifyOpts);
  }

  const maxUnlockedStep = useMemo(
    (): Step => Math.min(5, highestSavedStep + 1) as Step,
    [highestSavedStep],
  );
  const stepValid = validateLocal(step) === null;

  async function sendEmailOtp() {
    const biz = validateBusinessEmail(form.contactEmail, form.website);
    if (!biz.ok) {
      setError(biz.error);
      setShowFieldErrors(true);
      return;
    }
    setOtpSending(true);
    setError(null);
    setOtpHint(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired — sign in again");
      // Persist contact email first so OTP targets the right mailbox.
      const saveRes = await fetch("/api/suppliers/me/verification", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step: 2,
          submit: false,
          data: stepPayload(2),
        }),
      });
      const saveBody = (await saveRes.json().catch(() => ({}))) as { error?: string };
      if (!saveRes.ok) throw new Error(saveBody.error || "Could not save contact email");

      const res = await fetch("/api/suppliers/me/verification/email-otp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: biz.email }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        previewCode?: string;
        email?: string;
      };
      if (!res.ok) throw new Error(body.error || "Could not send code");
      setEmailVerified(false);
      setOtpValue("");
      if (body.previewCode) {
        setOtpHint(`Dev preview code: ${body.previewCode}`);
        setOtpValue(body.previewCode);
      } else {
        setOtpHint(body.message || `Code sent to ${body.email ?? biz.email}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setOtpSending(false);
    }
  }

  async function confirmEmailOtp() {
    if (!/^\d{6}$/.test(otpValue)) {
      setError("Enter the 6-digit code from your company email");
      return;
    }
    setOtpConfirming(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired — sign in again");
      const res = await fetch("/api/suppliers/me/verification/email-otp/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: otpValue }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Incorrect code");
      setEmailVerified(true);
      setOtpHint("Company email verified");
      setHighestSavedStep((prev) => Math.max(prev, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify code");
    } finally {
      setOtpConfirming(false);
    }
  }

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
        pendingReview?: boolean;
        nextStep?: number;
        message?: string;
      };
      if (!res.ok) throw new Error(body.error || "Could not save");
      await refreshProfile();
      setHighestSavedStep((prev) => Math.max(prev, opts.submit ? 4 : step));
      if (body.verified) {
        setVerified(true);
        navigate("/seller");
        return;
      }
      if (body.pendingReview || opts.submit) {
        setPendingReview(true);
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

  useEffect(() => {
    if (verified) {
      const t = window.setTimeout(() => navigate("/seller"), 800);
      return () => window.clearTimeout(t);
    }
  }, [verified, navigate]);

  if (!isLoaded || !profileReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8]">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] px-4">
        <div className="max-w-md text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center mx-auto">
            <BadgeCheck size={28} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-[#1a3a4a]">
            You’re already verified
          </h1>
          <p className="text-sm text-muted-foreground">
            Taking you to Seller Central…
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-primary underline min-h-11"
            onClick={() => navigate("/seller")}
          >
            Go to dashboard now
          </button>
        </div>
      </div>
    );
  }

  if (pendingReview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-heading text-2xl font-bold text-[#1a3a4a]">
            Submitted for review
          </h1>
          <p className="text-sm text-muted-foreground">
            {isIndiaCountry(form.country)
              ? "Your GSTIN passed format checks and is queued for Karm Baba review. The verified badge appears after approval — not automatically from the checksum."
              : "Your company-domain email was verified by OTP. Profile is queued for Karm Baba review. The verified badge appears after approval."}
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-primary underline"
            onClick={() => navigate("/seller")}
          >
            Back to seller dashboard
          </button>
        </div>
      </div>
    );
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
              ? india
                ? "Re-verify your GSTIN"
                : "Verify company email"
              : "Become a verified seller"}
          </h1>
          <p className="text-white/65 text-sm max-w-xl">
            {new URLSearchParams(window.location.search).get("step") === "3"
              ? india
                ? "Your verified badge is paused. Confirm or update GSTIN, then submit to get verified again."
                : "Confirm your company-domain email with a one-time code, then continue."
              : india
                ? "Complete KYC with GST registration so buyers can trust your shop — same idea as Alibaba's verified suppliers."
                : "Overseas sellers: we verify a company-domain email (not Gmail/Yahoo) with OTP instead of GST — same trust bar, different method."}
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
              <p className="text-sm text-muted-foreground">
                {india
                  ? "Registered Indian businesses need GST on a later step."
                  : "Africa, Middle East, USA, Canada & more: pick your country — we use company-domain email OTP instead of GST."}
              </p>
              <Field
                label="Trade / display name *"
                value={form.companyName}
                onChange={(v) => update("companyName", v)}
                placeholder="Your trading name"
                error={fieldErrors.companyName}
              />
              <Field
                label="Legal entity name *"
                value={form.legalName}
                onChange={(v) => update("legalName", v)}
                placeholder={india ? "As on GST certificate" : "As on company registration"}
                error={fieldErrors.legalName}
              />
              <Field
                label="Registered address *"
                value={form.businessAddress}
                onChange={(v) => update("businessAddress", v)}
                placeholder="Street / building / area"
                error={fieldErrors.businessAddress}
              />
              <div className="grid sm:grid-cols-3 gap-3">
                <Field
                  label="City *"
                  value={form.city}
                  onChange={(v) => update("city", v)}
                  placeholder={india ? "Surat" : "Dubai"}
                  error={fieldErrors.city}
                />
                {india ? (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      State *{" "}
                      {fieldErrors.state && (
                        <span className="text-red-600 font-normal">— {fieldErrors.state}</span>
                      )}
                    </label>
                    <select
                      value={
                        INDIAN_STATES.some(
                          (s) => s.toLowerCase() === form.state.trim().toLowerCase(),
                        )
                          ? INDIAN_STATES.find(
                              (s) => s.toLowerCase() === form.state.trim().toLowerCase(),
                            )!
                          : ""
                      }
                      onChange={(e) => update("state", e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white ${
                        fieldErrors.state
                          ? "border-red-400 focus:ring-2 focus:ring-red-200"
                          : "border-border focus:border-primary"
                      }`}
                    >
                      <option value="">Select state / UT</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <Field
                    label="State / province *"
                    value={form.state}
                    onChange={(v) => update("state", v)}
                    placeholder="Emirate / Province"
                    error={fieldErrors.state}
                  />
                )}
                <Field
                  label={india ? "PIN code *" : "Postal / ZIP code"}
                  value={form.pincode}
                  onChange={(v) =>
                    update("pincode", india ? v.replace(/\D/g, "").slice(0, 6) : v)
                  }
                  placeholder={india ? "395003" : "00000"}
                  error={fieldErrors.pincode}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Country *{" "}
                  {fieldErrors.country && (
                    <span className="text-red-600 font-normal">— {fieldErrors.country}</span>
                  )}
                </label>
                <select
                  value={
                    (COUNTRY_OPTIONS as readonly string[]).includes(form.country)
                      ? form.country
                      : form.country
                        ? "Other"
                        : "India"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((prev) => {
                      if (v === "Other") {
                        const keepCustom =
                          prev.country &&
                          !(COUNTRY_OPTIONS as readonly string[]).includes(prev.country);
                        return { ...prev, country: keepCustom ? prev.country : "" };
                      }
                      return {
                        ...prev,
                        country: v,
                        gstin: v === "India" ? prev.gstin : "",
                      };
                    });
                    setEmailVerified(false);
                    setOtpHint(null);
                    setShowFieldErrors(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm outline-none focus:border-primary bg-white"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {(form.country === "" ||
                  !(COUNTRY_OPTIONS as readonly string[]).includes(form.country)) && (
                  <input
                    type="text"
                    value={
                      (COUNTRY_OPTIONS as readonly string[]).includes(form.country)
                        ? ""
                        : form.country
                    }
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        country: e.target.value,
                        gstin: isIndiaCountry(e.target.value) ? prev.gstin : "",
                      }))
                    }
                    placeholder="Type country name"
                    className="mt-2 w-full px-3 py-2.5 rounded-xl border border-border text-sm outline-none focus:border-primary"
                  />
                )}
              </div>
              <Field
                label="About your business"
                value={form.description}
                onChange={(v) => update("description", v)}
                textarea
                placeholder="What do you manufacture or wholesale?"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="Years in business"
                  value={form.yearsInBusiness}
                  onChange={(v) => update("yearsInBusiness", v.replace(/\D/g, "").slice(0, 3))}
                  placeholder="8"
                  error={fieldErrors.yearsInBusiness}
                />
                <Field
                  label="Employees"
                  value={form.employeeCount}
                  onChange={(v) => update("employeeCount", v)}
                  placeholder="51-200"
                />
              </div>
              <Field
                label="Main products (comma-separated)"
                value={form.mainProducts}
                onChange={(v) => update("mainProducts", v)}
                placeholder="Cotton fabric, Denim, Yarn"
              />
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">
                {india ? "Authorized contact" : "Authorized contact & company email"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {india
                  ? "Buyers and Karm Baba will use this for RFQs and verification calls."
                  : "Use a mailbox on your company domain (e.g. ahmed@alfuttaim.ae). Free mail like Gmail or Yahoo is not accepted — fake shops rarely own a real domain."}
              </p>
              <Field
                label="Contact person *"
                value={form.contactPerson}
                onChange={(v) => update("contactPerson", v)}
                placeholder="Full name"
                error={fieldErrors.contactPerson}
              />
              <Field
                label={india ? "Mobile *" : "Phone *"}
                value={form.contactPhone}
                onChange={(v) => update("contactPhone", v)}
                placeholder={india ? "9876543210" : "+971501234567"}
                error={fieldErrors.contactPhone}
              />
              <Field
                label={india ? "Work email *" : "Company-domain email *"}
                value={form.contactEmail}
                onChange={(v) => {
                  update("contactEmail", v);
                  setEmailVerified(false);
                  setOtpHint(null);
                }}
                placeholder={india ? "sales@company.com" : "ahmed@yourcompany.ae"}
                error={fieldErrors.contactEmail}
              />
              <Field
                label={india ? "Website" : "Company website (recommended)"}
                value={form.website}
                onChange={(v) => {
                  update("website", v);
                  setEmailVerified(false);
                }}
                placeholder="https://www.yourcompany.ae"
              />
              {!india && (
                <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-muted-foreground space-y-1">
                  <p>· Not accepted: Gmail, Yahoo, Outlook, Hotmail, iCloud, and other free mail</p>
                  <p>· If you add a website, the email domain must match it</p>
                  <p>· Next step: we send a one-time code to this mailbox</p>
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              {india ? (
                <>
                  <h2 className="font-semibold text-lg">GST registration</h2>
                  <p className="text-sm text-muted-foreground">
                    We validate your 15-digit GSTIN format and checksum for now. Your PAN is derived
                    from GSTIN. A live government GST API can plug in later for name/status checks.
                  </p>
                  <Field
                    label="GSTIN *"
                    value={form.gstin}
                    onChange={(v) => update("gstin", v.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15))}
                    placeholder="27AAPFU0939F1ZV"
                    error={fieldErrors.gstin}
                  />
                  <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-muted-foreground space-y-1">
                    <p>· GSTIN must be exactly 15 characters with a valid checksum</p>
                    <p>· State code (first 2 digits) should match your registered state</p>
                    <p>· Fake or mistyped numbers fail checksum — government lookup comes later</p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-semibold text-lg">Verify company email</h2>
                  <p className="text-sm text-muted-foreground">
                    We send a one-time code to{" "}
                    <span className="font-medium text-foreground">
                      {form.contactEmail || "your company email"}
                    </span>
                    . Controlling that mailbox proves domain ownership — our overseas substitute for
                    GST / PAN checks.
                  </p>
                  {emailVerified ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 flex items-center gap-2">
                      <Check size={16} className="shrink-0" />
                      Company email verified — you can continue.
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-xl border border-border bg-white p-4">
                      <button
                        type="button"
                        disabled={otpSending || !form.contactEmail.trim()}
                        onClick={() => void sendEmailOtp()}
                        className="inline-flex items-center gap-2 px-4 min-h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
                      >
                        {otpSending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : null}
                        Send OTP to company email
                      </button>
                      {otpHint && (
                        <p className="text-sm text-muted-foreground">{otpHint}</p>
                      )}
                      <div>
                        <p className="text-sm font-medium mb-2">Enter 6-digit code</p>
                        <InputOTP
                          maxLength={6}
                          value={otpValue}
                          onChange={setOtpValue}
                          disabled={otpConfirming}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <button
                        type="button"
                        disabled={otpConfirming || otpValue.length !== 6}
                        onClick={() => void confirmEmailOtp()}
                        className="inline-flex items-center gap-2 px-4 min-h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted disabled:opacity-60"
                      >
                        {otpConfirming ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <BadgeCheck size={16} />
                        )}
                        Confirm code
                      </button>
                    </div>
                  )}
                  <Field
                    label="VAT / Tax ID (optional)"
                    value={form.gstin}
                    onChange={(v) => update("gstin", v)}
                    placeholder="Optional — e.g. UAE TRN, US EIN, or EU VAT"
                  />
                </>
              )}
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">Bank & certifications</h2>
              <Field
                label="Account holder name *"
                value={form.bankAccountName}
                onChange={(v) => update("bankAccountName", v)}
                placeholder="As per bank statement"
                error={fieldErrors.bankAccountName}
              />
              {india ? (
                <Field
                  label="IFSC *"
                  value={form.bankIfsc}
                  onChange={(v) => update("bankIfsc", v.toUpperCase())}
                  placeholder="HDFC0001234"
                  error={fieldErrors.bankIfsc}
                />
              ) : (
                <Field
                  label="SWIFT / BIC / routing (optional)"
                  value={form.bankIfsc}
                  onChange={(v) => update("bankIfsc", v.toUpperCase())}
                  placeholder="e.g. BOMLAEADXXX"
                  error={fieldErrors.bankIfsc}
                />
              )}
              <Field
                label="Certifications (comma-separated)"
                value={form.certifications}
                onChange={(v) => update("certifications", v)}
                placeholder="ISO 9001, Organic, CE"
              />
            </section>
          )}

          {step === 5 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">Review & get verified</h2>
              <div className="rounded-xl border border-border divide-y divide-border text-sm">
                <ReviewRow label="Company" value={form.companyName} />
                <ReviewRow label="Legal name" value={form.legalName || "—"} />
                <ReviewRow label="Country" value={form.country || "—"} />
                <ReviewRow label="Address" value={form.businessAddress} />
                <ReviewRow
                  label="Location"
                  value={[form.city, form.state, form.pincode].filter(Boolean).join(", ")}
                />
                <ReviewRow
                  label="Contact"
                  value={`${form.contactPerson} · ${form.contactPhone}`}
                />
                <ReviewRow
                  label={india ? "GSTIN" : "Company email"}
                  value={
                    india
                      ? form.gstin || "—"
                      : `${form.contactEmail || "—"}${emailVerified ? " · verified" : ""}`
                  }
                />
                {!india && (
                  <ReviewRow label="Tax ID" value={form.gstin || "Not provided"} />
                )}
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
                  on Karm Baba.
                  {india
                    ? " False GST details may lead to removal."
                    : " False company details may lead to removal."}
                </span>
              </label>
            </section>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {!error && step < 5 && !stepValid && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              {`Complete the required fields above to continue — ${validateLocal(step) ?? "check highlighted fields"}.`}
            </p>
          )}

          {step === 5 && !declared && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Tick the declaration checkbox before submitting.
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
                disabled={saving}
                onClick={() => {
                  if (!stepValid) {
                    setShowFieldErrors(true);
                    setError(validateLocal(step) || "Please fix the highlighted fields");
                    return;
                  }
                  void saveStep({ advance: true });
                }}
                className="inline-flex items-center gap-1.5 px-5 min-h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Save & continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || maxUnlockedStep < 5}
                onClick={() => {
                  if (!declared) {
                    setError("Please confirm the declaration before submitting");
                    return;
                  }
                  void saveStep({ submit: true });
                }}
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
