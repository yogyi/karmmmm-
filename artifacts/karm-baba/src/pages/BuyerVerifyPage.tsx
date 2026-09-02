import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Globe2,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import { COUNTRY_OPTIONS, isIndiaCountry } from "@/lib/country";
import { guessUserCountry } from "@/lib/guessCountry";
import { validateBusinessEmail, validateBuyerCompanyProfile } from "@/lib/businessEmail";
import {
  emptyIndiaGstinHint,
  validateIndiaBuyerProfile,
} from "@/lib/indiaBuyerProfile";
import { normalizeGstin } from "@/lib/gstin";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { BuyerVerifyLayout } from "@/components/BuyerVerifyLayout";
import { needsBuyerKyc, markIndiaBuyerActivated, clearIndiaBuyerActivated } from "@/lib/buyerKyc";
import {
  clearBuyerKycResume,
  overseasPhaseFromUser,
  readBuyerKycResume,
  resumeStepLabel,
  type BuyerKycResumePhase,
  writeBuyerKycResume,
} from "@/lib/buyerKycResume";
import { cn } from "@/lib/utils";

type Phase = "region" | "india-profile" | "overseas-otp" | "overseas-profile";

const OVERSEAS_STEPS = [
  { id: "region", label: "Location" },
  { id: "overseas-otp", label: "Verify" },
  { id: "overseas-profile", label: "Company" },
] as const;

const INDIA_STEPS = [
  { id: "region", label: "Location" },
  { id: "india-profile", label: "Details" },
] as const;

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
      <Check size={14} className="shrink-0" />
      {label}
    </span>
  );
}

function ResumeWelcomeBanner({
  stepLabel,
  onDismiss,
}: {
  stepLabel: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <ShieldCheck size={18} className="shrink-0 text-primary mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Resume verification</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{stepLabel}</p>
        </div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export function BuyerVerifyPage() {
  const [, navigate] = useLocation();
  const { getToken } = useClerkAuth();
  const { user, isLoggedIn, isLoaded, profileReady, refreshProfile, login } = useAuth();
  const profileHydratedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("region");
  const [guessedCountry, setGuessedCountry] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

  const [country, setCountry] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    country?: string;
    registrationNumber?: string;
    website?: string;
    name?: string;
    company?: string;
    phone?: string;
    gstin?: string;
  }>({});
  const [resumeWelcome, setResumeWelcome] = useState(false);
  const [savedResume, setSavedResume] = useState(() => readBuyerKycResume());

  const [indiaName, setIndiaName] = useState("");
  const [indiaCompany, setIndiaCompany] = useState("");
  const [indiaPhone, setIndiaPhone] = useState("");
  const [indiaGstin, setIndiaGstin] = useState("");

  const overseasCountries = useMemo(
    () => COUNTRY_OPTIONS.filter((c) => !isIndiaCountry(c)),
    [],
  );

  const suggestOverseas =
    !!guessedCountry && !isIndiaCountry(guessedCountry);

  useEffect(() => {
    if (!isLoaded || !profileReady) return;
    if (!isLoggedIn) {
      navigate("/login?mode=buyer&redirect=/buyer/verify");
      return;
    }
    if (!user) return;
    if (!needsBuyerKyc(user)) {
      navigate("/buyer");
      return;
    }
    if (user?.buyerCompanyEmail) setEmail(user.buyerCompanyEmail);
    if (user?.buyerCompanyEmailVerified) setEmailVerified(true);
    if (user?.name) setIndiaName((prev) => prev || user.name);
    if (user?.company) setIndiaCompany((prev) => prev || String(user.company));

    if (profileHydratedRef.current) return;
    profileHydratedRef.current = true;

    const serverPhase = overseasPhaseFromUser(user);
    if (serverPhase) {
      if (user.buyerCountry && !isIndiaCountry(user.buyerCountry)) {
        setCountry(user.buyerCountry);
      }
      if (user.buyerRegistrationNumber) setRegistrationNumber(user.buyerRegistrationNumber);
      if (user.buyerWebsite) setWebsite(user.buyerWebsite);
      setPhase(serverPhase);
      setResumeWelcome(true);
      return;
    }

    const local = readBuyerKycResume();
    setSavedResume(local);
    if (local) {
      if (local.email) setEmail(local.email);
      if (local.country) setCountry(local.country);
      if (local.registrationNumber) setRegistrationNumber(local.registrationNumber);
      if (local.website) setWebsite(local.website);
    }
  }, [isLoaded, profileReady, isLoggedIn, user, navigate]);

  useEffect(() => {
    if (phase !== "overseas-otp" && phase !== "overseas-profile") return;
    writeBuyerKycResume({
      phase: phase as BuyerKycResumePhase,
      email: email || undefined,
      country: country || undefined,
      registrationNumber: registrationNumber || undefined,
      website: website || undefined,
    });
    setSavedResume(readBuyerKycResume());
  }, [phase, email, country, registrationNumber, website]);

  useEffect(() => {
    let cancelled = false;
    void guessUserCountry().then((c) => {
      if (cancelled || !c) return;
      setGuessedCountry(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getToken();
    if (!token) throw new Error("Session expired. Please sign in again.");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async function activateIndia() {
    if (!user) {
      setError("Session expired. Please sign in again.");
      return;
    }
    const parsed = validateIndiaBuyerProfile({
      name: indiaName,
      company: indiaCompany,
      phone: indiaPhone,
      gstin: indiaGstin,
    });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      setError(
        parsed.errors.name ||
          parsed.errors.company ||
          parsed.errors.phone ||
          parsed.errors.gstin ||
          "Fix the highlighted fields",
      );
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setError(null);
    setResumeWelcome(false);
    clearBuyerKycResume();
    setSavedResume(null);
    try {
      const res = await fetch("/api/users/me/buyer-kyc/india", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          name: parsed.value.name,
          company: parsed.value.company,
          phone: parsed.value.phone ?? "",
          gstin: parsed.value.gstin ?? "",
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | ({
            error?: string;
            fieldErrors?: {
              name?: string;
              company?: string;
              phone?: string;
              gstin?: string;
            };
          } & Record<string, unknown>)
        | null;
      if (!res.ok) {
        if (body?.fieldErrors) setFieldErrors(body.fieldErrors);
        if (import.meta.env.DEV && res.status === 404) {
          // Local dev only — when API routes are not deployed yet.
          markIndiaBuyerActivated(user.id);
          await refreshProfile();
          navigate("/buyer");
          return;
        }
        throw new Error(body?.error ?? "Could not activate buyer account");
      }
      clearIndiaBuyerActivated();
      if (body && typeof body.id === "number") {
        login(body as unknown as Parameters<typeof login>[0]);
      }
      await refreshProfile();
      navigate("/buyer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function startIndiaProfile() {
    setError(null);
    setFieldErrors({});
    setResumeWelcome(false);
    clearIndiaBuyerActivated();
    if (user?.name) setIndiaName((prev) => prev || user.name);
    if (user?.company) setIndiaCompany((prev) => prev || String(user.company));
    setPhase("india-profile");
  }

  function startOverseas() {
    setError(null);
    setResumeWelcome(false);
    clearIndiaBuyerActivated();
    const c = guessedCountry && !isIndiaCountry(guessedCountry) ? guessedCountry : "";
    if (c) setCountry(c);
    setPhase("overseas-otp");
  }

  function resumeOverseas(targetPhase: BuyerKycResumePhase) {
    setError(null);
    const local = readBuyerKycResume();
    if (local?.email) setEmail(local.email);
    if (local?.country) setCountry(local.country);
    if (local?.registrationNumber) setRegistrationNumber(local.registrationNumber);
    if (local?.website) setWebsite(local.website);
    setPhase(targetPhase);
    setResumeWelcome(true);
  }

  function startOverseasFresh() {
    clearBuyerKycResume();
    setSavedResume(null);
    startOverseas();
  }

  async function sendEmailOtp() {
    setBusy(true);
    setError(null);
    setEmailHint(null);
    try {
      const biz = validateBusinessEmail(email);
      if (!biz.ok) throw new Error(biz.error);
      const res = await fetch("/api/users/me/buyer-kyc/email-otp", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ email: biz.email }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
        previewCode?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Could not send email code");
      setEmailVerified(false);
      setEmailHint(body?.message ?? "Verification code sent to your company email");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEmailOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/buyer-kyc/email-otp/confirm", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ code: emailCode }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setEmailCode("");
        throw new Error(body?.error ?? "Incorrect code — try again");
      }
      setEmailVerified(true);
      setEmailCode("");
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile() {
    setBusy(true);
    setError(null);
    const localErrors = validateBuyerCompanyProfile({
      country,
      registrationNumber,
      website,
      email,
    });
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setError(
        localErrors.registrationNumber ||
          localErrors.website ||
          localErrors.country ||
          "Fix the highlighted fields",
      );
      setBusy(false);
      return;
    }
    setFieldErrors({});
    try {
      const res = await fetch("/api/users/me/buyer-kyc/profile", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ country, registrationNumber, website }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: {
          country?: string;
          registrationNumber?: string;
          website?: string;
        };
      } | null;
      if (!res.ok) {
        if (body?.fieldErrors) setFieldErrors(body.fieldErrors);
        throw new Error(body?.error ?? "Could not save company profile");
      }
      clearBuyerKycResume();
      clearIndiaBuyerActivated();
      await refreshProfile();
      navigate("/buyer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!isLoaded || !profileReady || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center kb-page">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const layoutProps = {
    email: user.email,
    steps:
      phase === "region"
        ? undefined
        : phase === "india-profile"
          ? [...INDIA_STEPS]
          : [...OVERSEAS_STEPS],
    activeStep: phase,
  };

  const pendingResumePhase =
    savedResume?.phase ?? (user ? overseasPhaseFromUser(user) : null);

  if (phase === "region") {
    return (
      <BuyerVerifyLayout
        {...layoutProps}
        title="Where are you sourcing from?"
        subtitle="One buyer account for everyone. Choose your region — verification takes about two minutes for international buyers."
      >
        {error ? <ErrorBanner message={error} /> : null}

        {pendingResumePhase ? (
          <div className="mb-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Globe2 size={16} className="text-primary shrink-0" />
                  Resume international verification
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {resumeStepLabel(pendingResumePhase)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => resumeOverseas(pendingResumePhase)}
                  className="inline-flex items-center gap-1.5 kb-btn-primary px-4 py-2.5 text-sm"
                >
                  Resume <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearBuyerKycResume();
                    setSavedResume(null);
                  }}
                  className="inline-flex items-center px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-xl border border-border bg-white"
                >
                  Start over
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => startIndiaProfile()}
            className={cn(
              "group text-left rounded-2xl border-2 p-5 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70",
              "border-border hover:border-primary/50 hover:shadow-md bg-white",
              !suggestOverseas && "sm:ring-2 sm:ring-primary/15 sm:border-primary",
            )}
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <Building2 size={22} />
            </div>
            <p className="font-semibold text-foreground mb-1">India</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Quick details for Buyer Central. GSTIN is optional.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Continue <ArrowRight size={14} />
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={startOverseasFresh}
            className={cn(
              "group text-left rounded-2xl border-2 p-5 transition-all",
              "border-border hover:border-primary/50 hover:shadow-md bg-white",
              suggestOverseas && "sm:ring-2 sm:ring-primary/15 sm:border-primary",
            )}
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <Globe2 size={22} />
            </div>
            <p className="font-semibold text-foreground mb-1">
              International
              {suggestOverseas && guessedCountry ? (
                <span className="font-normal text-muted-foreground"> · {guessedCountry}</span>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Company email OTP, then registration number, country, and website.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Start verification <ArrowRight size={14} />
            </span>
          </button>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl bg-muted/50 border border-border/80 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          <ShieldCheck size={16} className="shrink-0 text-primary mt-0.5" />
          We verify company-domain email so suppliers know they are dealing with real importers —
          not free-mail sign-ups.
        </div>
      </BuyerVerifyLayout>
    );
  }

  if (phase === "india-profile") {
    return (
      <BuyerVerifyLayout
        {...layoutProps}
        title="Your buyer details"
        subtitle="A few basics so suppliers know who you are. GSTIN is optional."
      >
        {error ? <ErrorBanner message={error} /> : null}

        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Full name <span className="text-red-600">*</span>
            </span>
            <input
              value={indiaName}
              onChange={(e) => {
                setIndiaName(e.target.value);
                setFieldErrors((f) => ({ ...f, name: undefined }));
              }}
              placeholder="Your full name"
              autoComplete="name"
              disabled={busy}
              className={cn(
                "w-full min-h-11 rounded-xl border px-3 text-sm bg-white disabled:opacity-70",
                fieldErrors.name ? "border-red-400" : "border-border",
              )}
            />
            {fieldErrors.name ? (
              <p className="text-xs text-red-700">{fieldErrors.name}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Company / business name <span className="text-red-600">*</span>
            </span>
            <input
              value={indiaCompany}
              onChange={(e) => {
                setIndiaCompany(e.target.value);
                setFieldErrors((f) => ({ ...f, company: undefined }));
              }}
              placeholder="e.g. Mehta Trading Co."
              autoComplete="organization"
              disabled={busy}
              className={cn(
                "w-full min-h-11 rounded-xl border px-3 text-sm bg-white disabled:opacity-70",
                fieldErrors.company ? "border-red-400" : "border-border",
              )}
            />
            {fieldErrors.company ? (
              <p className="text-xs text-red-700">{fieldErrors.company}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Mobile number{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              value={indiaPhone}
              onChange={(e) => {
                setIndiaPhone(e.target.value);
                setFieldErrors((f) => ({ ...f, phone: undefined }));
              }}
              placeholder="10-digit mobile"
              inputMode="numeric"
              autoComplete="tel"
              disabled={busy}
              className={cn(
                "w-full min-h-11 rounded-xl border px-3 text-sm bg-white disabled:opacity-70",
                fieldErrors.phone ? "border-red-400" : "border-border",
              )}
            />
            {fieldErrors.phone ? (
              <p className="text-xs text-red-700">{fieldErrors.phone}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Indian mobile starting with 6–9</p>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              GSTIN <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              value={indiaGstin}
              onChange={(e) => {
                setIndiaGstin(normalizeGstin(e.target.value).slice(0, 15));
                setFieldErrors((f) => ({ ...f, gstin: undefined }));
              }}
              placeholder="22AAAAA0000A1Z5"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className={cn(
                "w-full min-h-11 rounded-xl border px-3 text-sm bg-white uppercase tracking-wide disabled:opacity-70",
                fieldErrors.gstin ? "border-red-400" : "border-border",
              )}
            />
            {fieldErrors.gstin ? (
              <p className="text-xs text-red-700">{fieldErrors.gstin}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{emptyIndiaGstinHint()}</p>
            )}
          </label>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setFieldErrors({});
              setPhase("region");
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void activateIndia()}
            className="inline-flex items-center gap-2 kb-btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Continue to Buyer Central <ArrowRight size={16} />
          </button>
        </div>
      </BuyerVerifyLayout>
    );
  }

  if (phase === "overseas-otp") {
    return (
      <BuyerVerifyLayout
        {...layoutProps}
        title="Verify your business email"
        subtitle="Step 1 of 2 — confirm your company email. Use your own domain (not Gmail or Yahoo)."
      >
        {error ? <ErrorBanner message={error} /> : null}
        {resumeWelcome ? (
          <ResumeWelcomeBanner
            stepLabel={resumeStepLabel("overseas-otp")}
            onDismiss={() => setResumeWelcome(false)}
          />
        ) : null}

        <section className="space-y-6">
          <div className="rounded-xl border border-border p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mail size={16} className="text-primary" />
                Company email
              </div>
              {emailVerified ? <VerifiedBadge label="Verified" /> : null}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailVerified(false);
                }}
                placeholder="you@yourcompany.com"
                disabled={emailVerified || busy}
                className="flex-1 min-h-11 rounded-xl border border-border px-3 text-sm bg-white disabled:opacity-70"
              />
              <button
                type="button"
                disabled={busy || emailVerified || !email.trim()}
                onClick={() => void sendEmailOtp()}
                className="shrink-0 min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60"
              >
                Send code
              </button>
            </div>
            {emailHint ? <p className="text-xs text-muted-foreground">{emailHint}</p> : null}
            {!emailVerified ? (
              <div className="space-y-3 pt-1">
                <InputOTP maxLength={6} value={emailCode} onChange={setEmailCode} disabled={busy}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <button
                  type="button"
                  disabled={busy || emailCode.length !== 6}
                  onClick={() => void confirmEmailOtp()}
                  className="text-sm font-semibold text-primary disabled:opacity-50"
                >
                  Confirm email code
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setResumeWelcome(false);
              setPhase("region");
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            type="button"
            disabled={!emailVerified}
            onClick={() => {
              setError(null);
              setResumeWelcome(false);
              setPhase("overseas-profile");
            }}
            className="inline-flex items-center gap-2 kb-btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
          >
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </BuyerVerifyLayout>
    );
  }

  return (
    <BuyerVerifyLayout
      {...layoutProps}
      title="Company registration"
      subtitle="Step 2 of 2 — your trade licence or incorporation details. Nothing to upload."
    >
      {error ? <ErrorBanner message={error} /> : null}
      {resumeWelcome ? (
        <ResumeWelcomeBanner
          stepLabel={resumeStepLabel("overseas-profile")}
          onDismiss={() => setResumeWelcome(false)}
        />
      ) : null}

      <div className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Country</span>
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setFieldErrors((f) => ({ ...f, country: undefined }));
            }}
            className={cn(
              "w-full min-h-11 rounded-xl border px-3 text-sm bg-white",
              fieldErrors.country ? "border-red-400" : "border-border",
            )}
          >
            <option value="">Select country</option>
            {overseasCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {fieldErrors.country ? (
            <p className="text-xs text-red-700">{fieldErrors.country}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">
            Company registration number
          </span>
          <input
            value={registrationNumber}
            onChange={(e) => {
              setRegistrationNumber(e.target.value);
              setFieldErrors((f) => ({ ...f, registrationNumber: undefined }));
            }}
            placeholder="e.g. CR-1234567 or trade licence no."
            className={cn(
              "w-full min-h-11 rounded-xl border px-3 text-sm",
              fieldErrors.registrationNumber ? "border-red-400" : "border-border",
            )}
          />
          {fieldErrors.registrationNumber ? (
            <p className="text-xs text-red-700">{fieldErrors.registrationNumber}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Use your real trade licence / CR / incorporation number (must include digits).
            </p>
          )}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Company website</span>
          <input
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              setFieldErrors((f) => ({ ...f, website: undefined }));
            }}
            placeholder="https://www.yourcompany.com"
            className={cn(
              "w-full min-h-11 rounded-xl border px-3 text-sm",
              fieldErrors.website ? "border-red-400" : "border-border",
            )}
          />
          {fieldErrors.website ? (
            <p className="text-xs text-red-700">{fieldErrors.website}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Must match the domain on your verified company email.
            </p>
          )}
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setResumeWelcome(false);
            setPhase("overseas-otp");
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          type="button"
          disabled={busy || !country || !registrationNumber.trim() || !website.trim()}
          onClick={() => void submitProfile()}
          className="inline-flex items-center gap-2 kb-btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Enter Buyer Central
          <ArrowRight size={16} />
        </button>
      </div>
    </BuyerVerifyLayout>
  );
}
