import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, BadgeCheck, Lock, Camera, Check, X } from "lucide-react";
import { useAuth as useClerkAuth, useUser } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { useAuth } from "@/context/AuthContext";
import { ImageSourcePicker } from "@/components/ImageSourcePicker";
import { mediaUrlFromUpload } from "@/lib/mediaUrl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ShopProfile {
  username: string;
  companyName: string;
  legalName: string;
  businessAddress: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  description: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  gstin: string;
  gstLocked: boolean;
  /** Public Verified badge — GST API live check only. */
  verified: boolean;
}

type UsernameCheck = {
  username: string | null;
  available: boolean;
  error?: string;
  suggestions: string[];
  /** True when the API/network failed — not the same as "taken". */
  checkFailed?: boolean;
};

export function ProfilePage() {
  const { user, isLoggedIn, isLoaded, profileReady, refreshProfile } = useAuth();
  const { getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const [, navigate] = useLocation();
  const { uploadFile } = useUpload({ getToken });

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  /** What is shown in the UI (may be a local blob preview). */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  /** Last photo URL persisted on the server. */
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarRemoved, setPendingAvatarRemoved] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [hasShop, setHasShop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [gstConfirmOpen, setGstConfirmOpen] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameCheckNonce, setUsernameCheckNonce] = useState(0);

  const isSeller = user?.role === "seller" || user?.role === "admin";
  const avatarDirty = pendingAvatarFile != null || pendingAvatarRemoved;

  useEffect(() => {
    return () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  useEffect(() => {
    if (!isLoaded || !profileReady) return;
    if (!isLoggedIn) {
      navigate("/login?redirect=/account");
      return;
    }
    void load();
  }, [isLoaded, profileReady, isLoggedIn, user?.id]);

  function clearPendingPreview() {
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingAvatarFile(null);
    setPendingAvatarRemoved(false);
  }

  async function load() {
    setLoading(true);
    setError(null);
    clearPendingPreview();
    try {
      setName(user?.name ?? "");
      setCompany(user?.company ?? "");
      const nextAvatar = user?.avatarUrl ?? null;
      setAvatarUrl(nextAvatar);
      setSavedAvatarUrl(nextAvatar);
      setAvatarLoadFailed(false);
      if (!isSeller) {
        setHasShop(false);
        setShop(null);
        return;
      }
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/suppliers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        setHasShop(false);
        setShop(null);
        return;
      }
      if (!res.ok) {
        throw new Error("Could not load shop profile");
      }
      const s = (await res.json()) as Record<string, unknown>;
      setHasShop(true);
      const username = String(s.username ?? s.slug ?? "");
      setSavedUsername(username);
      setUsernameCheck(null);
      setShop({
        username,
        companyName: String(s.companyName ?? ""),
        legalName: String(s.legalName ?? ""),
        businessAddress: String(s.businessAddress ?? ""),
        city: String(s.city ?? ""),
        state: String(s.state ?? ""),
        pincode: String(s.pincode ?? ""),
        country: String(s.country ?? "India"),
        description: String(s.description ?? ""),
        contactPerson: String(s.contactPerson ?? ""),
        contactPhone: String(s.contactPhone ?? ""),
        contactEmail: String(s.contactEmail ?? ""),
        website: String(s.website ?? ""),
        gstin: String(s.gstin ?? ""),
        gstLocked: s.gstLocked === true || s.verified === true,
        verified:
          s.gstBadge === true ||
          s.gstVerified === true ||
          s.gstLiveVerifiedAt != null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }

  function updateShop<K extends keyof ShopProfile>(key: K, value: ShopProfile[K]) {
    setShop((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
    setError(null);
  }

  useEffect(() => {
    if (!hasShop || !shop) return;
    const raw = shop.username.trim().toLowerCase();
    if (!raw) {
      setUsernameCheck(null);
      setUsernameChecking(false);
      return;
    }

    // Current saved username is always available to this seller.
    if (raw === savedUsername) {
      setUsernameCheck({
        username: raw,
        available: true,
        suggestions: [],
      });
      setUsernameChecking(false);
      return;
    }

    let cancelled = false;
    setUsernameCheck(null);
    setUsernameChecking(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const fail = (error: string): UsernameCheck => ({
          username: raw,
          available: false,
          checkFailed: true,
          error,
          suggestions: [],
        });

        try {
          const token = await getToken();
          if (cancelled) return;
          if (!token) {
            setUsernameCheck(fail("Sign in again to check username"));
            return;
          }
          const res = await fetch(
            `/api/suppliers/me?checkUsername=${encodeURIComponent(raw)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (cancelled) return;
          const body = (await res.json().catch(() => null)) as
            | {
                error?: string;
                usernameCheck?: UsernameCheck;
              }
            | null;
          if (!res.ok) {
            setUsernameCheck(
              fail(
                body?.error ||
                  (res.status === 401
                    ? "Sign in again to check username"
                    : `Could not check username (${res.status})`),
              ),
            );
            return;
          }
          const data = body?.usernameCheck;
          if (!data || typeof data.available !== "boolean") {
            setUsernameCheck(fail("Could not check username — try again"));
            return;
          }
          setUsernameCheck({
            username: data.username ?? raw,
            available: data.available,
            error: data.error,
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            checkFailed: false,
          });
        } catch {
          if (!cancelled) {
            setUsernameCheck(fail("Could not check username — try again"));
          }
        } finally {
          if (!cancelled) setUsernameChecking(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Intentionally omit getToken — Clerk may return a new function each render,
    // which would cancel the check before it finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.username, savedUsername, hasShop, usernameCheckNonce]);

  /** Clerk avatar sync — timed out so it can never leave the UI stuck. */
  async function syncClerkAvatar(file: File | null): Promise<void> {
    if (!clerkUser?.setProfileImage) return;
    const timeoutMs = 8_000;
    await Promise.race([
      clerkUser.setProfileImage({ file }),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Clerk avatar sync timed out")), timeoutMs);
      }),
    ]);
  }

  function onPickPhoto(file: File) {
    const looksLikeImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!looksLikeImage) {
      setError("Choose a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }

    setError(null);
    setSaved(false);
    const preview = URL.createObjectURL(file);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    setPendingAvatarFile(file);
    setPendingAvatarRemoved(false);
    setAvatarLoadFailed(false);
    setAvatarUrl(preview);
  }

  function removePhoto() {
    setError(null);
    setSaved(false);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingAvatarFile(null);
    setPendingAvatarRemoved(true);
    setAvatarLoadFailed(false);
    setAvatarUrl(null);
  }

  async function save() {
    if (name.trim().length < 2) {
      setError("Enter your name (at least 2 characters)");
      return;
    }
    if (hasShop && shop) {
      const u = shop.username.trim().toLowerCase();
      if (u.length < 3) {
        setError("Choose a username (at least 3 characters) for your shareable profile link");
        return;
      }
      if (u !== savedUsername && usernameCheck && !usernameCheck.available && !usernameCheck.checkFailed) {
        setError(usernameCheck.error || "That username is taken — pick a suggestion below");
        return;
      }
      if (usernameChecking) {
        setError("Wait a moment while we check if that username is available");
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      let nextAvatarUrl = savedAvatarUrl;
      let clerkFile: File | null | undefined = undefined;

      if (pendingAvatarRemoved) {
        nextAvatarUrl = null;
        clerkFile = null;
      } else if (pendingAvatarFile) {
        const uploaded = await uploadFile(pendingAvatarFile);
        if (!uploaded?.objectPath) {
          throw new Error("Upload failed — try again");
        }
        nextAvatarUrl = mediaUrlFromUpload(uploaded);
        clerkFile = pendingAvatarFile;
      }

      const userRes = await fetch("/api/users/me", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          ...(avatarDirty ? { avatarUrl: nextAvatarUrl } : {}),
        }),
      });
      if (!userRes.ok) {
        const body = (await userRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save account details");
      }

      if (avatarDirty && hasShop) {
        try {
          const shopLogoRes = await fetch("/api/suppliers/me", {
            method: "PATCH",
            headers,
            body: JSON.stringify({ logoUrl: nextAvatarUrl }),
          });
          if (!shopLogoRes.ok) {
            console.warn("Share card logo sync failed", await shopLogoRes.text().catch(() => ""));
          }
        } catch (err) {
          console.warn("Share card logo sync failed", err);
        }
      }

      if (hasShop && shop) {
        const shopRes = await fetch("/api/suppliers/me", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            username: shop.username.trim().toLowerCase(),
            companyName: shop.companyName,
            legalName: shop.legalName,
            businessAddress: shop.businessAddress,
            city: shop.city,
            state: shop.state,
            pincode: shop.pincode,
            country: shop.country,
            description: shop.description,
            contactPerson: shop.contactPerson,
            contactPhone: shop.contactPhone,
            contactEmail: shop.contactEmail,
            website: shop.website,
            ...(!shop.gstLocked ? { gstin: shop.gstin } : {}),
          }),
        });
        if (!shopRes.ok) {
          const body = (await shopRes.json().catch(() => null)) as {
            error?: string;
            suggestions?: string[];
          } | null;
          if (body?.suggestions?.length) {
            setUsernameCheck({
              username: shop.username.trim().toLowerCase(),
              available: false,
              error: body.error || "Username is taken",
              suggestions: body.suggestions,
            });
          }
          throw new Error(body?.error ?? "Could not save shop details");
        }
        const savedShop = (await shopRes.json()) as { username?: string; slug?: string };
        const nextUsername = String(savedShop.username ?? savedShop.slug ?? shop.username);
        setSavedUsername(nextUsername);
        setShop((prev) => (prev ? { ...prev, username: nextUsername } : prev));
        setUsernameCheck(null);
      }

      if (clerkFile !== undefined) {
        void syncClerkAvatar(clerkFile).catch(() => {
          /* optional — account photo already saved */
        });
      }

      setSavedAvatarUrl(nextAvatarUrl);
      setAvatarUrl(nextAvatarUrl);
      setAvatarLoadFailed(false);
      clearPendingPreview();
      await refreshProfile();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function startGstReverify() {
    setGstConfirmOpen(false);
    setReverifying(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      const res = await fetch("/api/suppliers/me/reverify-gst", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not start GST re-verification");
      }
      navigate("/seller/verify?step=3");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start GST re-verification");
      setReverifying(false);
    }
  }

  if (!isLoaded || !profileReady || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8 rounded-2xl overflow-hidden kb-card">
        <div
          className="px-5 sm:px-6 py-5 text-white"
          style={{
            background:
              "linear-gradient(135deg, hsl(220 60% 16%) 0%, hsl(220 55% 26%) 50%, hsl(28 85% 40%) 140%)",
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-semibold mb-1.5">
            Account
          </p>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
            Edit profile
          </h1>
          <p className="text-sm text-white/70 mt-1.5 max-w-lg">
            Update your details anytime. After GST verification, GSTIN stays locked until you
            re-verify.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <section className="kb-card p-5 sm:p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Your account</h2>
          <div className="flex items-start gap-4">
            <ImageSourcePicker
              disabled={saving}
              onFile={(file) => onPickPhoto(file)}
              onError={(msg) => setError(msg)}
              align="start"
            >
              <button
                type="button"
                disabled={saving}
                className="relative w-20 h-20 rounded-full overflow-hidden border border-border bg-primary text-white shrink-0 group disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Change profile photo"
              >
                {avatarUrl && !avatarLoadFailed ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    key={avatarUrl}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-xl font-semibold">
                    {(name || user?.name || "U")
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0] ?? "")
                      .join("")
                      .toUpperCase() || "U"}
                  </span>
                )}
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100">
                  <Camera size={18} />
                </span>
              </button>
            </ImageSourcePicker>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Profile photo</p>
              <p className="text-xs text-muted-foreground mb-2">
                JPG, PNG, or WebP · up to 5 MB · saves only when you click Save changes
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ImageSourcePicker
                  disabled={saving}
                  onFile={(file) => onPickPhoto(file)}
                  onError={(msg) => setError(msg)}
                >
                  <button
                    type="button"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    Change photo
                  </button>
                </ImageSourcePicker>
                {avatarUrl ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => removePhoto()}
                    className="rounded-xl px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
                {avatarDirty ? (
                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                    Unsaved photo
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Field label="Full name *" value={name} onChange={setName} placeholder="Your name" />
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1.5 block">Email</span>
            <input
              value={user?.email ?? ""}
              readOnly
              className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground"
            />
            <span className="text-xs text-muted-foreground mt-1.5 block">
              Email is managed by your sign-in account.
            </span>
          </label>
          <Field
            label="Company (optional)"
            value={company}
            onChange={setCompany}
            placeholder="Your company or trading name"
          />
        </section>

        {isSeller && !hasShop && (
          <section className="kb-card p-5 sm:p-6">
            <h2 className="font-semibold text-foreground mb-2">Shop & GST</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Complete seller verification to add GSTIN and shop details.
            </p>
            <button
              type="button"
              onClick={() => navigate("/seller/verify")}
              className="inline-flex items-center justify-center rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary/90"
            >
              Start verification
            </button>
          </section>
        )}

        {hasShop && shop && (
          <>
            <section className="kb-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-foreground">Shop details</h2>
                {shop.verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                    <BadgeCheck size={12} /> Verified
                  </span>
                )}
              </div>
              <label className="block">
                <span className="text-sm font-medium text-foreground mb-1.5 block">
                  Username * <span className="font-normal text-muted-foreground">(share link)</span>
                </span>
                <div className="relative">
                  <input
                    value={shop.username}
                    onChange={(e) =>
                      updateShop(
                        "username",
                        e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                      )
                    }
                    placeholder="e.g. yogesh"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={30}
                    className={`w-full rounded-xl border-2 px-3.5 pr-10 py-2.5 text-sm bg-white font-mono outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none ${
                      usernameCheck?.checkFailed
                        ? "border-amber-400 focus:border-amber-500 focus-visible:border-amber-500"
                        : usernameCheck && !usernameCheck.available
                          ? "border-red-500 focus:border-red-500 focus-visible:border-red-500"
                          : usernameCheck?.available
                            ? "border-green-500 focus:border-green-500 focus-visible:border-green-500"
                            : "border-border focus:border-primary focus-visible:border-primary"
                    }`}
                    style={{ outline: "none", boxShadow: "none" }}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {usernameChecking ? (
                      <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    ) : usernameCheck?.available ? (
                      <Check size={14} className="text-green-600" />
                    ) : usernameCheck?.checkFailed ? (
                      <X size={14} className="text-amber-600" />
                    ) : usernameCheck && !usernameCheck.available ? (
                      <X size={14} className="text-red-600" />
                    ) : null}
                  </span>
                </div>
                {shop.username.trim() ? (
                  <div className="mt-2 space-y-2">
                    {usernameCheck?.available ? (
                      <p className="text-sm font-semibold text-green-700">
                        Available — you can use this username
                      </p>
                    ) : usernameCheck?.checkFailed ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-amber-800">
                          Couldn’t verify right now
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {usernameCheck.error || "Check failed"} — you can still Save; we’ll confirm
                          uniqueness then.
                        </p>
                        <button
                          type="button"
                          onClick={() => setUsernameCheckNonce((n) => n + 1)}
                          className="text-xs font-semibold text-primary underline underline-offset-2"
                        >
                          Retry check
                        </button>
                      </div>
                    ) : usernameCheck && !usernameCheck.available ? (
                      <>
                        <p className="text-sm font-semibold text-red-700">
                          Not available — try another
                        </p>
                        {usernameCheck.error &&
                        usernameCheck.error !== "Not available — try another" &&
                        usernameCheck.error !== "Username is taken" ? (
                          <p className="text-xs text-muted-foreground">{usernameCheck.error}</p>
                        ) : null}
                        {usernameCheck.suggestions.length > 0 ? (
                          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                            <p className="text-xs font-medium text-foreground">
                              Suggested usernames you can take:
                            </p>
                            <div className="flex flex-col gap-2">
                              {usernameCheck.suggestions.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => updateShop("username", suggestion)}
                                  className="inline-flex items-center justify-between gap-3 text-sm font-semibold px-3 py-2.5 rounded-lg border border-green-200 bg-white text-foreground hover:bg-green-50 font-mono"
                                >
                                  <span>{suggestion}</span>
                                  <span className="text-[11px] font-bold uppercase tracking-wide text-green-700">
                                    Available
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground">Checking…</p>
                    )}
                  </div>
                ) : null}
              </label>
              <Field
                label="Trade / display name"
                value={shop.companyName}
                onChange={(v) => updateShop("companyName", v)}
              />
              <Field
                label="Legal entity name"
                value={shop.legalName}
                onChange={(v) => updateShop("legalName", v)}
              />
              <Field
                label="Registered address"
                value={shop.businessAddress}
                onChange={(v) => updateShop("businessAddress", v)}
              />
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="City" value={shop.city} onChange={(v) => updateShop("city", v)} />
                <Field label="State" value={shop.state} onChange={(v) => updateShop("state", v)} />
                <Field
                  label="PIN code"
                  value={shop.pincode}
                  onChange={(v) => updateShop("pincode", v)}
                />
              </div>
              <Field
                label="About your business"
                value={shop.description}
                onChange={(v) => updateShop("description", v)}
                textarea
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="Contact person"
                  value={shop.contactPerson}
                  onChange={(v) => updateShop("contactPerson", v)}
                />
                <Field
                  label="Mobile"
                  value={shop.contactPhone}
                  onChange={(v) => updateShop("contactPhone", v)}
                />
              </div>
              <Field
                label="Work email"
                value={shop.contactEmail}
                onChange={(v) => updateShop("contactEmail", v)}
              />
              <Field
                label="Website"
                value={shop.website}
                onChange={(v) => updateShop("website", v)}
              />
            </section>

            <section className="kb-card p-5 sm:p-6 space-y-4">
              <h2 className="font-semibold text-foreground">GSTIN</h2>
              {shop.gstLocked ? (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-foreground mb-1.5 block">
                      GSTIN
                    </span>
                    <div className="relative">
                      <input
                        value={shop.gstin}
                        readOnly
                        className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 pr-10 text-sm text-foreground"
                      />
                      <Lock
                        size={14}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                    </div>
                  </label>
                  <p className="text-sm text-muted-foreground">
                    GSTIN is locked after verification. Changing it pauses your verified badge
                    until you complete live GST verification again.
                  </p>
                  <button
                    type="button"
                    disabled={reverifying}
                    onClick={() => setGstConfirmOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    {reverifying ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" /> Starting…
                      </>
                    ) : (
                      "Change GSTIN"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <Field
                    label="GSTIN"
                    value={shop.gstin}
                    onChange={(v) => updateShop("gstin", v.toUpperCase())}
                    placeholder="27AAPFU0939F1ZV"
                  />
                  <p className="text-sm text-muted-foreground">
                    Finish seller verification and live GST check to unlock the verified badge.
                  </p>
                </>
              )}
            </section>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {saved && !error && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            Profile saved.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Save changes
          </button>
          <button
            type="button"
            onClick={() => navigate(isSeller ? "/seller" : "/buyer")}
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>

      <AlertDialog open={gstConfirmOpen} onOpenChange={setGstConfirmOpen}>
        <AlertDialogContent className="max-w-[min(100%-2rem,26rem)] rounded-2xl border-border bg-white p-6 gap-5 sm:rounded-2xl">
          <AlertDialogHeader className="text-left space-y-2">
            <AlertDialogTitle className="font-heading text-xl font-semibold text-foreground">
              Change GSTIN?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Your verified badge will be paused until you confirm the new GSTIN. Company and
              contact details stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel className="mt-0 rounded-xl px-4 py-2.5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary/90"
              onClick={() => void startGstReverify()}
            >
              Re-verify GST
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const cls =
    "w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white";
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground mb-1.5 block">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}
