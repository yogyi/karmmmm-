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
import { getOverseasKycLabels, isValidOverseasTaxId } from "@/lib/overseasKyc";
import { getCompanyProfileLabels } from "@/lib/companyProfileLabels";
import { guessUserCountry } from "@/lib/guessCountry";
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
import { PageHero } from "@/components/PageHero";
import { KycDocumentUploader } from "@/components/KycDocumentUploader";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;

function wizardSteps(india: boolean): { id: Step; title: string; blurb: string; icon: React.ReactNode }[] {
  if (india) {
    return [
      { id: 1, title: "Company", blurb: "Business profile", icon: <Building2 size={16} /> },
      { id: 2, title: "Contact", blurb: "Authorized person", icon: <User size={16} /> },
      { id: 3, title: "GST", blurb: "Tax registration", icon: <FileCheck2 size={16} /> },
      { id: 4, title: "Bank & certs", blurb: "Payout details", icon: <Landmark size={16} /> },
      { id: 5, title: "Verify", blurb: "Review & submit", icon: <BadgeCheck size={16} /> },
    ];
  }
  return [
    { id: 1, title: "Company", blurb: "Business profile", icon: <Building2 size={16} /> },
    { id: 2, title: "Contact", blurb: "Company email OTP", icon: <User size={16} /> },
    { id: 3, title: "Registration", blurb: "Trade licence / CR", icon: <FileCheck2 size={16} /> },
    { id: 4, title: "Tax ID", blurb: "TRN / VAT / EIN", icon: <FileCheck2 size={16} /> },
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
  aadhaarDocumentUrl: string;
  businessRegistrationDocumentUrl: string;
  businessRegistrationNumber: string;
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
  aadhaarDocumentUrl: "",
  businessRegistrationDocumentUrl: "",
  businessRegistrationNumber: "",
  bankAccountName: "",
  bankIfsc: "",
  certifications: "",
};

/** Required-field check for a wizard step (used for locking + Save & continue). */
function validateStepForForm(
  form: FormState,
  current: Step,
  opts?: { emailVerified?: boolean; gstLiveVerified?: boolean },
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
      if (!opts?.emailVerified) {
        return "Verify your company-domain email with the OTP we send";
      }
    }
  }
  if (current === 3) {
    if (india) {
      const gst = validateGstin(form.gstin);
      if (!gst.ok) return gst.error;
      if (!form.aadhaarDocumentUrl.trim()) {
        return "Upload your Aadhaar card (JPEG, PNG, or PDF)";
      }
      if (!opts?.gstLiveVerified) {
        return "Verify your GSTIN with GSTN before continuing";
      }
    } else {
      if (!opts?.emailVerified) {
        return "Verify your company-domain email on the Contact step first";
      }
      if (!form.businessRegistrationDocumentUrl.trim()) {
        return "Upload your business registration document";
      }
      if (!form.businessRegistrationNumber.trim()) {
        return "Registration / licence number is required";
      }
    }
  }
  if (current === 4) {
    if (india) {
      if (!form.bankAccountName.trim()) return "Account holder name is required";
      if (!form.bankIfsc.trim()) return "IFSC code is required";
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.bankIfsc.trim())) {
        return "IFSC format looks invalid (e.g. HDFC0001234)";
      }
    } else {
      const labels = getOverseasKycLabels(form.country);
      if (!isValidOverseasTaxId(form.gstin)) {
        return `${labels.taxIdLabel.replace(" *", "")} is required`;
      }
    }
  }
  return null;
}

function isStepComplete(
  form: FormState,
  s: Step,
  opts?: { emailVerified?: boolean; gstLiveVerified?: boolean },
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
  opts?: { emailVerified?: boolean; gstLiveVerified?: boolean },
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
  opts?: { emailVerified?: boolean; gstLiveVerified?: boolean },
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
      else if (!opts?.emailVerified) {
        errors.contactEmail = "Verify company email with OTP below";
      }
    }
  }
  if (current === 3 && india) {
    const gst = validateGstin(form.gstin);
    if (!gst.ok) errors.gstin = gst.error;
    if (!form.aadhaarDocumentUrl.trim()) {
      errors.aadhaarDocumentUrl = "Upload your Aadhaar card";
    }
    if (!opts?.gstLiveVerified) {
      errors.gstin = errors.gstin ?? "Verify GSTIN with GSTN";
    }
  }
  if (current === 3 && !india) {
    if (!form.businessRegistrationDocumentUrl.trim()) {
      errors.businessRegistrationDocumentUrl = "Upload registration document";
    }
    if (!form.businessRegistrationNumber.trim()) {
      errors.businessRegistrationNumber = "Registration number is required";
    }
  }
  if (current === 4 && india) {
    if (!form.bankAccountName.trim()) {
      errors.bankAccountName = "Account holder name is required";
    }
    if (!form.bankIfsc.trim()) {
      errors.bankIfsc = "IFSC code is required";
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.bankIfsc.trim())) {
      errors.bankIfsc = "IFSC format looks invalid (e.g. HDFC0001234)";
    }
  }
  if (current === 4 && !india) {
    const labels = getOverseasKycLabels(form.country);
    if (!isValidOverseasTaxId(form.gstin)) {
      errors.gstin = `${labels.taxIdLabel.replace(" *", "")} is required`;
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
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstLiveVerified, setGstLiveVerified] = useState(false);
  const [gstLiveRecord, setGstLiveRecord] = useState<{
    legalName: string;
    tradeName: string | null;
    status: string;
    state: string | null;
    address: string | null;
  } | null>(null);
  const [countryAutoDetected, setCountryAutoDetected] = useState(false);

  const india = isIndiaCountry(form.country);
  const overseasKyc = useMemo(() => getOverseasKycLabels(form.country), [form.country]);
  const profileLabels = useMemo(() => getCompanyProfileLabels(form.country), [form.country]);
  const STEPS = useMemo(() => wizardSteps(india), [india]);
  const verifyOpts = useMemo(
    () => ({ emailVerified, gstLiveVerified }),
    [emailVerified, gstLiveVerified],
  );

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

  useEffect(() => {
    if (loading || highestSavedStep > 0) return;
    let cancelled = false;
    void guessUserCountry().then((guess) => {
      if (cancelled || !guess) return;
      setForm((prev) => {
        if (prev.country && prev.country !== "India") return prev;
        return { ...prev, country: guess };
      });
      setCountryAutoDetected(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, highestSavedStep]);

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
        aadhaarDocumentUrl: String(s.aadhaarDocumentUrl ?? ""),
        businessRegistrationDocumentUrl: String(s.businessRegistrationDocumentUrl ?? ""),
        businessRegistrationNumber: String(s.businessRegistrationNumber ?? ""),
        bankAccountName: String(s.bankAccountName ?? ""),
        bankIfsc: String(s.bankIfsc ?? ""),
        certifications: Array.isArray(s.certifications)
          ? (s.certifications as string[]).join(", ")
          : "",
      };
      setForm(loaded);
      const emailOk = s.businessEmailVerified === true;
      setEmailVerified(emailOk);
      if (s.gstLiveVerifiedAt) {
        setGstLiveVerified(true);
        setGstLiveRecord({
          legalName: String(s.legalName ?? ""),
          tradeName: s.gstTradeName ? String(s.gstTradeName) : null,
          status: String(s.gstLiveStatus ?? "Active"),
          state: s.state ? String(s.state) : null,
          address: s.businessAddress ? String(s.businessAddress) : null,
        });
      } else {
        setGstLiveVerified(false);
        setGstLiveRecord(null);
      }
      // Re-run validation after load so incomplete PIN/state blocks continue.
      const incomplete = firstIncompleteStep(loaded, {
        emailVerified: emailOk,
        gstLiveVerified: Boolean(s.gstLiveVerifiedAt),
      });
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
    if (key === "gstin") {
      setGstLiveVerified(false);
      setGstLiveRecord(null);
    }
    setError(null);
    setShowFieldErrors(false);
  }

  async function verifyGstinLiveNow() {
    const gst = validateGstin(form.gstin);
    if (!gst.ok) {
      setError(gst.error);
      setShowFieldErrors(true);
      return;
    }
    setGstVerifying(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired — sign in again");
      const res = await fetch("/api/suppliers/me/verification/gst-verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gstin: form.gstin,
          legalName: form.legalName,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        nameMatches?: boolean;
        record?: {
          legalName: string;
          tradeName: string | null;
          status: string;
          state: string | null;
          address: string | null;
        };
      };
      if (!res.ok) throw new Error(body.error || "GST verification failed");
      if (body.record) {
        setGstLiveRecord(body.record);
        setGstLiveVerified(true);
      }
      if (body.nameMatches === false) {
        setError(
          body.message ||
            "Legal name on your form does not match GST records — update Step 1 legal entity name.",
        );
        setGstLiveVerified(false);
      }
    } catch (e) {
      setGstLiveVerified(false);
      setGstLiveRecord(null);
      if (e instanceof Error && e.name === "TimeoutError") {
        setError("GST verification timed out — check your connection and try again.");
      } else {
        setError(e instanceof Error ? e.message : "GST verification failed");
      }
    } finally {
      setGstVerifying(false);
    }
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
      if (isIndiaCountry(form.country)) {
        return {
          gstin: form.gstin,
          aadhaarDocumentUrl: form.aadhaarDocumentUrl,
          legalName: form.legalName,
        };
      }
      return {
        businessRegistrationDocumentUrl: form.businessRegistrationDocumentUrl,
        businessRegistrationNumber: form.businessRegistrationNumber,
      };
    }
    if (current === 4) {
      if (isIndiaCountry(form.country)) {
        return {
          bankAccountName: form.bankAccountName,
          bankIfsc: form.bankIfsc,
          certifications: form.certifications
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        };
      }
      return { gstin: form.gstin.trim() };
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
  /** Live check across steps 1–4 — used to lock submit even after prior saves. */
  const submitReady = useMemo(
    () => isStepComplete(form, 5, verifyOpts),
    [form, verifyOpts],
  );
  const firstMissingStep = useMemo(
    (): Step | null => (submitReady ? null : firstIncompleteStep(form, verifyOpts)),
    [form, verifyOpts, submitReady],
  );
  const submitBlockReason = useMemo((): string | null => {
    if (submitReady || !firstMissingStep) return null;
    return validateStepForForm(form, firstMissingStep, verifyOpts);
  }, [form, verifyOpts, submitReady, firstMissingStep]);

  useEffect(() => {
    if (!submitReady) setDeclared(false);
  }, [submitReady]);

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
      <div className="min-h-screen flex items-center justify-center kb-page">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center kb-page px-4">
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
      <div className="min-h-screen flex items-center justify-center kb-page px-4">
        <div className="max-w-md text-center space-y-5 kb-card p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center mx-auto ring-1 ring-primary/15">
            <BadgeCheck size={32} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-[#1a3a4a]">
            Submitted for review
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isIndiaCountry(form.country)
              ? "Your GSTIN passed format checks and is queued for Karm Baba review. The verified badge appears after approval — not automatically from the checksum."
              : "Your company-domain email was verified by OTP. Profile is queued for Karm Baba review. The verified badge appears after approval."}
          </p>
          <button
            type="button"
            className="inline-flex items-center justify-center px-5 min-h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90"
            onClick={() => navigate("/seller")}
          >
            Back to seller dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-page min-h-screen">
      <PageHero
        compact
        eyebrow="Seller Central · Verification"
        title={
          new URLSearchParams(window.location.search).get("step") === "3"
            ? india
              ? "Re-verify your GSTIN"
              : "Business registration"
            : "Become a verified seller"
        }
        description={
          new URLSearchParams(window.location.search).get("step") === "3"
            ? india
              ? "Your verified badge is paused. Confirm or update GSTIN, then submit to get verified again."
              : `Upload your ${overseasKyc.businessRegistrationLabel.replace(" *", "").toLowerCase()} — no GST outside India.`
            : india
              ? "Complete KYC with GST registration so buyers can trust your shop — same idea as Alibaba's verified suppliers."
              : "Overseas sellers: company email OTP, local registration certificate, and tax ID. Bank and passport come later — video call after submit."
        }
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <WizardStepper
          steps={STEPS}
          step={step}
          maxUnlockedStep={maxUnlockedStep}
          highestSavedStep={highestSavedStep}
          onGoToStep={goToStep}
        />

        <div className="rounded-2xl border border-[#1a2744]/10 bg-gradient-to-br from-orange-50/40 via-white to-sky-50/30 shadow-[0_8px_32px_-16px_rgba(26,39,68,0.2)] overflow-hidden">
          <div className="p-6 sm:p-8 lg:p-10">
          {step === 1 && (
            <section className="space-y-5">
              <StepHeader
                icon={<Building2 size={20} />}
                title="Company profile"
                description={
                  india
                    ? "Tell buyers who you are. GST registration comes on a later step."
                    : "Africa, Middle East, USA, Canada & more — we verify company-domain email instead of GST."
                }
              />
              <FormPanel>
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
                placeholder={profileLabels.legalNamePlaceholder}
                error={fieldErrors.legalName}
              />
              <div>
                <label className="block text-sm font-semibold text-[#1a2744] mb-1.5">
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
                        state: prev.country !== v ? "" : prev.state,
                        pincode: prev.country !== v ? "" : prev.pincode,
                        city: prev.country !== v ? "" : prev.city,
                        gstin: v === "India" ? prev.gstin : "",
                        aadhaarDocumentUrl: v === "India" ? prev.aadhaarDocumentUrl : "",
                        businessRegistrationDocumentUrl:
                          v === "India" ? "" : prev.businessRegistrationDocumentUrl,
                        businessRegistrationNumber:
                          v === "India" ? "" : prev.businessRegistrationNumber,
                      };
                    });
                    setEmailVerified(false);
                    setGstLiveVerified(false);
                    setGstLiveRecord(null);
                    setOtpHint(null);
                    setCountryAutoDetected(false);
                    setShowFieldErrors(false);
                  }}
                  className={formControlClass}
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {countryAutoDetected && (
                  <p className="mt-2 text-xs text-sky-700 bg-sky-50/80 border border-sky-200/60 rounded-lg px-3 py-2">
                    Country set from your location — change it if incorrect.
                  </p>
                )}
                {profileLabels.countryHint ? (
                  <p className="mt-2 text-xs text-amber-900/80 bg-amber-50/80 border border-amber-200/60 rounded-lg px-3 py-2">
                    {profileLabels.countryHint}
                  </p>
                ) : null}
                {(form.country === "" ||
                  !(COUNTRY_OPTIONS as readonly string[]).includes(form.country)) && (
                  <input
                    type="text"
                    value={
                      (COUNTRY_OPTIONS as readonly string[]).includes(form.country)
                        ? ""
                        : form.country
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        country: v,
                        state: prev.country !== v ? "" : prev.state,
                        pincode: prev.country !== v ? "" : prev.pincode,
                        city: prev.country !== v ? "" : prev.city,
                        gstin: isIndiaCountry(v) ? prev.gstin : "",
                        aadhaarDocumentUrl: isIndiaCountry(v) ? prev.aadhaarDocumentUrl : "",
                        businessRegistrationDocumentUrl: isIndiaCountry(v)
                          ? ""
                          : prev.businessRegistrationDocumentUrl,
                        businessRegistrationNumber: isIndiaCountry(v)
                          ? ""
                          : prev.businessRegistrationNumber,
                      }));
                      if (!isIndiaCountry(v)) {
                        setEmailVerified(false);
                        setGstLiveVerified(false);
                        setGstLiveRecord(null);
                      }
                      setCountryAutoDetected(false);
                      setShowFieldErrors(false);
                    }}
                    placeholder="Type country name"
                    className={cn(formControlClass, "mt-2")}
                  />
                )}
              </div>
              <Field
                label="Registered address *"
                value={form.businessAddress}
                onChange={(v) => update("businessAddress", v)}
                placeholder={profileLabels.addressPlaceholder}
                error={fieldErrors.businessAddress}
              />
              <div className="grid sm:grid-cols-3 gap-3">
                <Field
                  label="City *"
                  value={form.city}
                  onChange={(v) => update("city", v)}
                  placeholder={profileLabels.cityPlaceholder}
                  error={fieldErrors.city}
                />
                {india ? (
                  <div>
                    <label className="block text-sm font-semibold text-[#1a2744] mb-1.5">
                      {profileLabels.stateLabel}{" "}
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
                      className={cn(formControlClass, fieldErrors.state && "border-red-400 focus:ring-red-200")}
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
                    label={profileLabels.stateLabel}
                    value={form.state}
                    onChange={(v) => update("state", v)}
                    placeholder={profileLabels.statePlaceholder}
                    error={fieldErrors.state}
                  />
                )}
                <Field
                  label={profileLabels.postalLabel}
                  value={form.pincode}
                  onChange={(v) =>
                    update("pincode", india ? v.replace(/\D/g, "").slice(0, 6) : v)
                  }
                  placeholder={profileLabels.postalPlaceholder}
                  error={fieldErrors.pincode}
                />
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
              </FormPanel>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5">
              <StepHeader
                icon={<User size={20} />}
                title={india ? "Authorized contact" : "Authorized contact & company email"}
                description={
                  india
                    ? "Buyers and Karm Baba use this for RFQs and verification calls."
                    : "Use a mailbox on your company domain. Free mail like Gmail or Yahoo is not accepted."
                }
              />
              <FormPanel tone="sky">
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
                <TipBox>
                  <p>Not accepted: Gmail, Yahoo, Outlook, Hotmail, iCloud, and other free mail</p>
                  <p>If you add a website, the email domain must match it</p>
                  <p>Verify your company email with OTP before continuing</p>
                </TipBox>
              )}
              {!india && (
                <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-white to-blue-50/30 p-5 space-y-4">
                  <p className="text-sm font-semibold text-[#1a2744]">Verify company-domain email</p>
                  {emailVerified ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 flex items-center gap-2">
                      <Check size={16} className="shrink-0" />
                      Company email verified — you can continue.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <button
                        type="button"
                        disabled={otpSending || !form.contactEmail.trim()}
                        onClick={() => void sendEmailOtp()}
                        className="inline-flex items-center gap-2 px-4 min-h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
                      >
                        {otpSending ? <Loader2 size={16} className="animate-spin" /> : null}
                        Send OTP to company email
                      </button>
                      {otpHint && <p className="text-sm text-muted-foreground">{otpHint}</p>}
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
                </div>
              )}
              </FormPanel>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              {india ? (
                <>
                  <StepHeader
                    icon={<FileCheck2 size={20} />}
                    title="GST registration"
                    description="We verify your 15-digit GSTIN, checksum, and live GSTN status. PAN is derived from GSTIN."
                  />

                  <FormPanel tone="amber">
                    <div>
                      <label className="block text-sm font-semibold text-[#1a3a4a] mb-2">
                        GSTIN *
                        {fieldErrors.gstin ? (
                          <span className="text-red-600 font-normal ml-1">— {fieldErrors.gstin}</span>
                        ) : null}
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          value={form.gstin}
                          onChange={(e) =>
                            update(
                              "gstin",
                              e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15),
                            )
                          }
                          placeholder="29AABCK3456M1Z4"
                          aria-invalid={fieldErrors.gstin ? true : undefined}
                          className={cn(
                            formControlClass,
                            "flex-1 px-4 py-3 font-mono tracking-[0.12em] uppercase",
                            fieldErrors.gstin && "border-red-400 focus:ring-red-200/80",
                          )}
                        />
                        <button
                          type="button"
                          disabled={gstVerifying || saving || form.gstin.length !== 15}
                          onClick={() => void verifyGstinLiveNow()}
                          className="inline-flex items-center justify-center gap-2 px-6 min-h-[46px] rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-45 disabled:shadow-none transition-all shrink-0"
                        >
                          {gstVerifying ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <FileCheck2 size={16} />
                          )}
                          Verify with GSTN
                        </button>
                      </div>
                      <p className="mt-2.5 text-xs text-muted-foreground">
                        {gstLiveVerified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <Check size={14} /> Live GSTN verified — you can continue
                          </span>
                        ) : (
                          "15 characters · verify with GSTN before saving"
                        )}
                      </p>
                    </div>

                    {gstLiveRecord ? (
                      <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4 text-sm space-y-1.5">
                        <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs uppercase tracking-wide">
                          <BadgeCheck size={14} /> Registered on GSTN
                        </div>
                        <p className="font-semibold text-emerald-950 text-base leading-snug break-words">
                          {gstLiveRecord.legalName}
                        </p>
                        {gstLiveRecord.tradeName ? (
                          <p className="text-emerald-800">Trade: {gstLiveRecord.tradeName}</p>
                        ) : null}
                        <p className="text-emerald-800 text-sm">
                          {gstLiveRecord.status}
                          {gstLiveRecord.state ? ` · ${gstLiveRecord.state}` : ""}
                        </p>
                        {gstLiveRecord.address ? (
                          <p className="text-emerald-800/80 text-xs leading-relaxed">
                            {gstLiveRecord.address}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </FormPanel>

                  <FormPanel tone="emerald">
                    <KycDocumentUploader
                      value={form.aadhaarDocumentUrl}
                      onChange={(url) => update("aadhaarDocumentUrl", url)}
                      error={fieldErrors.aadhaarDocumentUrl}
                      disabled={saving}
                    />
                  </FormPanel>

                  <TipBox>
                    <p>GSTIN must be exactly 15 characters with a valid checksum</p>
                    <p>Click Verify with GSTN for live registration status from GSTN</p>
                    <p>State and legal name must match your company profile</p>
                  </TipBox>
                </>
              ) : (
                <>
                  <StepHeader
                    icon={<FileCheck2 size={20} />}
                    title="Business registration"
                    description={`${form.country || "Your country"} — upload your official company registration. No GST required outside India.`}
                  />
                  {overseasKyc.usStateNote ? (
                    <TipBox>
                      <p>{overseasKyc.usStateNote}</p>
                    </TipBox>
                  ) : null}
                  <FormPanel tone="amber">
                    <Field
                      label={overseasKyc.businessRegistrationLabel}
                      value={form.businessRegistrationNumber}
                      onChange={(v) => update("businessRegistrationNumber", v)}
                      placeholder={overseasKyc.businessRegistrationPlaceholder}
                      error={fieldErrors.businessRegistrationNumber}
                    />
                    <KycDocumentUploader
                      value={form.businessRegistrationDocumentUrl}
                      onChange={(url) => update("businessRegistrationDocumentUrl", url)}
                      label="Business registration certificate *"
                      error={fieldErrors.businessRegistrationDocumentUrl}
                      disabled={saving}
                      hint={overseasKyc.businessRegistrationHint}
                    />
                  </FormPanel>
                  <TipBox>
                    <p>{overseasKyc.businessRegistrationHint}</p>
                    <p>Bank details, passport, and Aadhaar are not required for overseas sellers.</p>
                    <p>After submit, we schedule a short video verification call.</p>
                  </TipBox>
                </>
              )}
            </section>
          )}

          {step === 4 && (
            <section className="space-y-5">
              {india ? (
                <>
              <StepHeader
                icon={<Landmark size={20} />}
                title="Bank & certifications"
                description="Payout details for settlements. Certifications help buyers trust your quality standards."
              />
              <FormPanel tone="violet">
              <Field
                label="Account holder name *"
                value={form.bankAccountName}
                onChange={(v) => update("bankAccountName", v)}
                placeholder="As per bank statement"
                error={fieldErrors.bankAccountName}
              />
                <Field
                  label="IFSC *"
                  value={form.bankIfsc}
                  onChange={(v) => update("bankIfsc", v.toUpperCase())}
                  placeholder="HDFC0001234"
                  error={fieldErrors.bankIfsc}
                />
              <Field
                label="Certifications (comma-separated)"
                value={form.certifications}
                onChange={(v) => update("certifications", v)}
                placeholder="ISO 9001, Organic, CE"
              />
              </FormPanel>
                </>
              ) : (
                <>
                  <StepHeader
                    icon={<FileCheck2 size={20} />}
                    title="Tax identification"
                    description={`Enter your ${overseasKyc.taxIdLabel.replace(" *", "")} for ${form.country || "your country"}.`}
                  />
                  <FormPanel tone="violet">
                    <Field
                      label={overseasKyc.taxIdLabel}
                      value={form.gstin}
                      onChange={(v) => update("gstin", v)}
                      placeholder={overseasKyc.taxIdPlaceholder}
                      error={fieldErrors.gstin}
                    />
                    <TipBox>
                      <p>{overseasKyc.taxIdHint}</p>
                      <p>Payout bank details are collected after approval — not during signup.</p>
                    </TipBox>
                  </FormPanel>
                </>
              )}
            </section>
          )}

          {step === 5 && (
            <section className="space-y-6">
              <StepHeader
                icon={<BadgeCheck size={20} />}
                title="Review & get verified"
                description={
                  india
                    ? "Check everything once more. After submit, Karm Baba reviews your profile before the verified badge appears."
                    : "Check your registration and tax details. After submit, we review your profile and schedule a short video verification call."
                }
              />

              <FormPanel tone="sky">
              <div className="grid gap-4 sm:grid-cols-2">
                <ReviewCard title="Business" icon={<Building2 size={16} />}>
                  <ReviewRow label="Trade name" value={form.companyName} />
                  {india && gstLiveVerified && gstLiveRecord?.legalName ? (
                    <>
                      <ReviewRow
                        label="Legal name (GSTN)"
                        value={gstLiveRecord.legalName}
                        highlight
                      />
                      {form.legalName.trim() &&
                      form.legalName.trim().toLowerCase() !==
                        gstLiveRecord.legalName.trim().toLowerCase() ? (
                        <ReviewRow label="Profile legal name" value={form.legalName} muted />
                      ) : null}
                    </>
                  ) : (
                    <ReviewRow label="Legal name" value={form.legalName || "—"} />
                  )}
                  <ReviewRow label="Country" value={form.country || "—"} />
                  <ReviewRow label="Address" value={form.businessAddress} />
                  <ReviewRow
                    label="Location"
                    value={[form.city, form.state, form.pincode].filter(Boolean).join(", ")}
                  />
                </ReviewCard>

                <ReviewCard title="Contact" icon={<User size={16} />}>
                  <ReviewRow label="Person" value={form.contactPerson} />
                  <ReviewRow label="Phone" value={form.contactPhone} />
                  <ReviewRow
                    label="Email"
                    value={
                      india
                        ? form.contactEmail
                        : `${form.contactEmail}${emailVerified ? " · verified" : ""}`
                    }
                    missing={!india && (!emailVerified || !form.contactEmail.trim())}
                  />
                  {form.website ? <ReviewRow label="Website" value={form.website} /> : null}
                </ReviewCard>

                <ReviewCard title={india ? "Tax & KYC" : "Registration & tax"} icon={<FileCheck2 size={16} />}>
                  {india ? (
                    <>
                  <ReviewRow
                    label="GSTIN"
                    value={form.gstin}
                    highlight={gstLiveVerified}
                    missing={!form.gstin.trim() || !gstLiveVerified}
                  />
                  {gstLiveRecord ? (
                    <ReviewRow label="GSTN status" value={gstLiveRecord.status} highlight />
                  ) : null}
                    <ReviewRow
                      label="Aadhaar"
                      value={
                        form.aadhaarDocumentUrl.trim()
                          ? "Document uploaded ✓"
                          : ""
                      }
                      missing={!form.aadhaarDocumentUrl.trim()}
                    />
                    </>
                  ) : (
                    <>
                      <ReviewRow
                        label="Registration"
                        value={form.businessRegistrationNumber}
                        missing={!form.businessRegistrationNumber.trim()}
                      />
                      <ReviewRow
                        label="Reg. document"
                        value={
                          form.businessRegistrationDocumentUrl.trim()
                            ? "Document uploaded ✓"
                            : ""
                        }
                        missing={!form.businessRegistrationDocumentUrl.trim()}
                      />
                      <ReviewRow
                        label={overseasKyc.taxIdLabel.replace(" *", "")}
                        value={form.gstin}
                        missing={!isValidOverseasTaxId(form.gstin)}
                      />
                    </>
                  )}
                </ReviewCard>

                {india ? (
                <ReviewCard title="Banking" icon={<Landmark size={16} />}>
                  <ReviewRow label="Account name" value={form.bankAccountName || "—"} />
                  {form.bankIfsc ? (
                    <ReviewRow label="IFSC" value={form.bankIfsc} />
                  ) : null}
                  {form.certifications.trim() ? (
                    <ReviewRow label="Certifications" value={form.certifications} />
                  ) : null}
                </ReviewCard>
                ) : null}
              </div>

              <label
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 sm:p-5 transition-colors mt-4",
                  submitReady
                    ? "border-primary/20 bg-orange-50/50 cursor-pointer hover:border-primary/35"
                    : "border-amber-200/70 bg-amber-50/40 cursor-not-allowed opacity-80",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30 disabled:opacity-50"
                  checked={declared}
                  disabled={!submitReady}
                  onChange={(e) => setDeclared(e.target.checked)}
                />
                <span className="text-sm text-[#1a3a4a]/90 leading-relaxed">
                  I confirm the details are accurate and I am authorized to register this business
                  on Karm Baba.
                  {india
                    ? " False GST details may lead to removal."
                    : " False company details may lead to removal."}
                </span>
              </label>
              {!submitReady && submitBlockReason && firstMissingStep ? (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3.5 text-sm text-amber-950/90 space-y-2">
                  <p>
                    <span className="font-semibold">Can&apos;t submit yet.</span>{" "}
                    {submitBlockReason}
                  </p>
                  <button
                    type="button"
                    onClick={() => goToStep(firstMissingStep)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Go to {STEPS[firstMissingStep - 1]?.title ?? "step"} <ArrowRight size={14} />
                  </button>
                </div>
              ) : null}
              </FormPanel>
            </section>
          )}

          {error && (
            <p className="mt-6 text-sm text-red-700 bg-red-50/90 border border-red-200/80 rounded-2xl px-4 py-3 flex items-start gap-2">
              <span className="font-semibold shrink-0">Error</span>
              <span>{error}</span>
            </p>
          )}

          {!error && step < 5 && !stepValid && (
            <p className="mt-6 text-sm text-amber-900/80 bg-amber-50/80 border border-amber-200/70 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Complete the required fields — {validateLocal(step) ?? "check highlighted fields"}.
            </p>
          )}

          {step === 5 && submitReady && !declared && (
            <p className="mt-6 text-sm text-amber-900/80 bg-amber-50/80 border border-amber-200/70 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Tick the declaration checkbox before submitting.
            </p>
          )}

          {step === 5 && !submitReady && (
            <p className="mt-6 text-sm text-amber-900/80 bg-amber-50/80 border border-amber-200/70 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Fix the missing details above before you can submit.
            </p>
          )}

          <div className="mt-10 pt-6 border-t border-orange-100/80 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={step === 1 || saving}
              onClick={() => goToStep(Math.max(1, step - 1) as Step)}
              className="inline-flex items-center gap-1.5 px-5 min-h-11 rounded-xl border border-[#1a2744]/12 bg-white text-sm font-semibold text-[#1a3a4a] hover:bg-[#f8f5f0] disabled:opacity-40 transition-colors"
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
                className="inline-flex items-center gap-2 px-6 min-h-11 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Save & continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || !submitReady || !declared}
                onClick={() => {
                  if (!submitReady) {
                    setError(submitBlockReason || "Complete all required steps before submitting");
                    if (firstMissingStep) {
                      setShowFieldErrors(true);
                      setStep(firstMissingStep);
                    }
                    return;
                  }
                  if (!declared) {
                    setError("Please confirm the declaration before submitting");
                    return;
                  }
                  void saveStep({ submit: true });
                }}
                className="inline-flex items-center gap-2 px-6 min-h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 hover:brightness-105 disabled:opacity-45 disabled:shadow-none disabled:cursor-not-allowed transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
                Submit & verify seller
              </button>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const formControlClass =
  "w-full rounded-xl border border-[#1a2744]/12 bg-white px-3.5 py-2.5 text-sm text-[#1a3a4a] outline-none transition-all shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/15";

const FORM_PANEL_TONES = {
  orange: "border-orange-200/80 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/40",
  sky: "border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-white to-blue-50/30",
  amber: "border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30",
  emerald: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/30",
  violet: "border-violet-200/80 bg-gradient-to-br from-violet-50/60 via-white to-purple-50/30",
} as const;

function FormPanel({
  children,
  tone = "orange",
}: {
  children: React.ReactNode;
  tone?: keyof typeof FORM_PANEL_TONES;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6 space-y-4 shadow-sm",
        FORM_PANEL_TONES[tone],
      )}
    >
      {children}
    </div>
  );
}

function WizardStepper({
  steps,
  step,
  maxUnlockedStep,
  highestSavedStep,
  onGoToStep,
}: {
  steps: ReturnType<typeof wizardSteps>;
  step: Step;
  maxUnlockedStep: Step;
  highestSavedStep: number;
  onGoToStep: (s: Step) => void;
}) {
  const progressPct = Math.round(((step - 1) / Math.max(steps.length - 1, 1)) * 100);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-[#1a3a4a]">
          Step {step} of {steps.length}
          <span className="text-muted-foreground font-normal">
            {" "}
            · {steps.find((s) => s.id === step)?.title}
          </span>
        </p>
        <span className="text-xs font-bold text-primary tabular-nums">{progressPct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1a2744]/8 overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#1a2744] via-primary to-[#ff9a3c] transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progressPct, 8)}%` }}
        />
      </div>
      <ol className="flex gap-2 overflow-x-auto py-1 px-0.5 snap-x scrollbar-none">
        {steps.map((s) => {
          const complete =
            s.id <= highestSavedStep || (s.id === 5 && highestSavedStep >= 4);
          const unlocked = s.id <= maxUnlockedStep;
          const active = step === s.id;
          return (
            <li key={s.id} className="flex-1 min-w-[5.5rem] sm:min-w-0 snap-start">
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => onGoToStep(s.id)}
                title={unlocked ? s.title : `Complete step ${maxUnlockedStep} first`}
                className={cn(
                  "w-full rounded-xl px-2.5 py-3 min-h-[3.25rem] text-left transition-colors duration-200 box-border",
                  active &&
                    "bg-white border-2 border-primary shadow-sm shadow-primary/15",
                  !active && complete && "bg-emerald-50 border border-emerald-300/80",
                  !active && !complete && unlocked && "bg-white/80 border border-[#1a2744]/10 hover:border-primary/40",
                  !unlocked && "bg-white/40 border border-border/50 opacity-45 cursor-not-allowed",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold",
                      complete && "bg-emerald-600 text-white shadow-sm",
                      active && !complete && "bg-primary text-white shadow-sm",
                      !active && !complete && "bg-[#1a2744]/10 text-[#1a2744]/60",
                    )}
                  >
                    {complete ? <Check size={14} /> : s.icon}
                  </span>
                  <div className="min-w-0 hidden sm:block">
                    <div className="text-xs font-bold text-[#1a3a4a] truncate">{s.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.blurb}</div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 pb-4 mb-2">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/25 to-amber-100/60 text-primary flex items-center justify-center shrink-0 shadow-sm ring-1 ring-primary/20">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1a2744] tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[#1a2744]/60 leading-relaxed max-w-xl">{description}</p>
      </div>
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3.5 text-sm text-[#1a2744]/70 space-y-1 [&_p]:leading-relaxed">
      {children}
    </div>
  );
}

function ReviewCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1a2744]/10 bg-white p-4 sm:p-5 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-orange-100/80">
        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#ff9a3c] text-white flex items-center justify-center shadow-sm">
          {icon}
        </span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1a2744]/75">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
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
  const cls = cn(
    formControlClass,
    error && "border-red-400 focus:ring-red-200/80 focus:border-red-400",
  );
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#1a2744] mb-1.5 block">{label}</span>
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
      {error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

function ReviewRow({
  label,
  value,
  highlight,
  muted,
  missing,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  missing?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,5.5rem)_1fr] sm:grid-cols-[minmax(0,6.5rem)_1fr] gap-x-3 gap-y-0.5 items-baseline py-1">
      <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm leading-snug break-words min-w-0",
          missing && "font-semibold text-red-600",
          highlight && !missing && "font-semibold text-[#1a3a4a]",
          muted && "text-muted-foreground font-normal",
          !highlight && !muted && !missing && "font-medium text-foreground",
        )}
      >
        {missing && !value.trim() ? "Required" : value.trim() ? value : "—"}
      </div>
    </div>
  );
}
