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
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import { COUNTRY_OPTIONS, isIndiaCountry } from "@/lib/country";
import { guessUserCountry } from "@/lib/guessCountry";
import { validateBusinessEmail } from "@/lib/businessEmail";
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

type Phase = "region" | "overseas-otp" | "overseas-profile";

const OVERSEAS_STEPS = [
  { id: "region", label: "Location" },
  { id: "overseas-otp", label: "Verify" },
  { id: "overseas-profile", label: "Company" },
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
  const [whatsapp, setWhatsapp] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [waCode, setWaCode] = useState("");
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [waHint, setWaHint] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [waVerified, setWaVerified] = useState(false);

  const [country, setCountry] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [resumeWelcome, setResumeWelcome] = useState(false);
  const [savedResume, setSavedResume] = useState(() => readBuyerKycResume());

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
    if (user && !needsBuyerKyc(user)) {
      navigate("/buyer");
      return;
    }
    if (user?.buyerCompanyEmail) setEmail(user.buyerCompanyEmail);
    if (user?.buyerWhatsapp) setWhatsapp(user.buyerWhatsapp);
    if (user?.buyerCompanyEmailVerified) setEmailVerified(true);
    if (user?.buyerWhatsappVerified) setWaVerified(true);

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
      if (local.whatsapp) setWhatsapp(local.whatsapp);
      if (local.country) setCountry(local.country);
      if (local.registrationNumber) setRegistrationNumber(local.registrationNumber);
      if (local.website) setWebsite(local.website);
    }
  }, [isLoaded, profileReady, isLoggedIn, user, navigate]);

  useEffect(() => {
    if (phase === "region") return;
    writeBuyerKycResume({
      phase: phase as BuyerKycResumePhase,
      email: email || undefined,
      whatsapp: whatsapp || undefined,
      country: country || undefined,
      registrationNumber: registrationNumber || undefined,
      website: website || undefined,
    });
    setSavedResume(readBuyerKycResume());
  }, [phase, email, whatsapp, country, registrationNumber, website]);

  useEffect(() => {
    let cancelled = false;
    void guessUserCountry().then((c) => {
      if (!cancelled && c) setGuessedCountry(c);
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
    setBusy(true);
    setError(null);
    setResumeWelcome(false);
    clearBuyerKycResume();
    setSavedResume(null);
    try {
      const res = await fetch("/api/users/me/buyer-kyc/india", {
        method: "POST",
        headers: await authHeaders(),
        body: "{}",
      });
      const body = (await res.json().catch(() => null)) as
        | ({ error?: string } & Record<string, unknown>)
        | null;
      if (!res.ok) {
        if (res.status === 404) {
          // Server not upgraded yet — India buyers skip verify in this browser session.
          markIndiaBuyerActivated(user.id);
          await refreshProfile();
          navigate("/buyer");
          return;
        }
        throw new Error(body?.error ?? "Could not activate buyer account");
      }
      clearIndiaBuyerActivated();
      if (body && typeof body.id === "number") {
        login(body as Parameters<typeof login>[0]);
      }
      await refreshProfile();
      navigate("/buyer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
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
    if (local?.whatsapp) setWhatsapp(local.whatsapp);
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
      setEmailHint(
        body?.previewCode
          ? `Development code: ${body.previewCode}`
          : (body?.message ?? "Verification code sent to your company email"),
      );
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
      if (!res.ok) throw new Error(body?.error ?? "Incorrect code");
      setEmailVerified(true);
      setEmailCode("");
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function sendWaOtp() {
    setBusy(true);
    setError(null);
    setWaHint(null);
    try {
      const res = await fetch("/api/users/me/buyer-kyc/whatsapp-otp", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          whatsapp,
          country: country || guessedCountry || "AE",
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
        previewCode?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Could not send WhatsApp code");
      setWaVerified(false);
      setWaHint(
        body?.previewCode
          ? `Development code: ${body.previewCode}`
          : (body?.message ?? "Verification code sent on WhatsApp"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function confirmWaOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/buyer-kyc/whatsapp-otp/confirm", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ code: waCode }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Incorrect code");
      setWaVerified(true);
      setWaCode("");
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
    try {
      const res = await fetch("/api/users/me/buyer-kyc/profile", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ country, registrationNumber, website }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Could not save company profile");
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
    steps: phase === "region" ? undefined : [...OVERSEAS_STEPS],
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
            onClick={() => void activateIndia()}
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
              Instant access to Buyer Central. No extra verification steps.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Activating…
                </>
              ) : (
                <>
                  Continue <ArrowRight size={14} />
                </>
              )}
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
              Company email + WhatsApp OTP, then registration number, country, and website.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Start verification <ArrowRight size={14} />
            </span>
          </button>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl bg-muted/50 border border-border/80 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          <ShieldCheck size={16} className="shrink-0 text-primary mt-0.5" />
          We verify company-domain email and WhatsApp so suppliers know they are dealing with
          real importers — not free-mail sign-ups.
        </div>
      </BuyerVerifyLayout>
    );
  }

  if (phase === "overseas-otp") {
    const bothVerified = emailVerified && waVerified;
    return (
      <BuyerVerifyLayout
        {...layoutProps}
        title="Verify your business contacts"
        subtitle="Step 1 of 2 — confirm company email and WhatsApp. Use your own domain (not Gmail or Yahoo)."
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

          <div className="rounded-xl border border-border p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageCircle size={16} className="text-primary" />
                WhatsApp
              </div>
              {waVerified ? <VerifiedBadge label="Verified" /> : null}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(e.target.value);
                  setWaVerified(false);
                }}
                placeholder="+971 50 … or +254 7 …"
                disabled={waVerified || busy}
                className="flex-1 min-h-11 rounded-xl border border-border px-3 text-sm bg-white disabled:opacity-70"
              />
              <button
                type="button"
                disabled={busy || waVerified || !whatsapp.trim()}
                onClick={() => void sendWaOtp()}
                className="shrink-0 min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60"
              >
                Send code
              </button>
            </div>
            {waHint ? <p className="text-xs text-muted-foreground">{waHint}</p> : null}
            {!waVerified ? (
              <div className="space-y-3 pt-1">
                <InputOTP maxLength={6} value={waCode} onChange={setWaCode} disabled={busy}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <button
                  type="button"
                  disabled={busy || waCode.length !== 6}
                  onClick={() => void confirmWaOtp()}
                  className="text-sm font-semibold text-primary disabled:opacity-50"
                >
                  Confirm WhatsApp code
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
            disabled={!bothVerified}
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
            onChange={(e) => setCountry(e.target.value)}
            className="w-full min-h-11 rounded-xl border border-border px-3 text-sm bg-white"
          >
            <option value="">Select country</option>
            {overseasCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">
            Company registration number
          </span>
          <input
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="Trade licence / CR / incorporation no."
            className="w-full min-h-11 rounded-xl border border-border px-3 text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Company website</span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://www.yourcompany.com"
            className="w-full min-h-11 rounded-xl border border-border px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Must match the domain on your verified company email.
          </p>
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
