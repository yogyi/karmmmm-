import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, BadgeCheck, Lock, Camera } from "lucide-react";
import { useAuth as useClerkAuth, useUser } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { useAuth } from "@/context/AuthContext";
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
  verified: boolean;
}

const emptyShop: ShopProfile = {
  companyName: "",
  legalName: "",
  businessAddress: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  description: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  website: "",
  gstin: "",
  gstLocked: false,
  verified: false,
};

export function ProfilePage() {
  const { user, isLoggedIn, isLoaded, profileReady, refreshProfile } = useAuth();
  const { getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const [, navigate] = useLocation();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useUpload({ getToken });

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [hasShop, setHasShop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [gstConfirmOpen, setGstConfirmOpen] = useState(false);

  const isSeller = user?.role === "seller" || user?.role === "admin";

  useEffect(() => {
    if (!isLoaded || !profileReady) return;
    if (!isLoggedIn) {
      navigate("/login?redirect=/account");
      return;
    }
    void load();
  }, [isLoaded, profileReady, isLoggedIn, user?.id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setName(user?.name ?? "");
      setCompany(user?.company ?? "");
      setAvatarUrl(user?.avatarUrl ?? null);
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
      setShop({
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
        verified: s.verified === true,
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

  async function persistAvatar(nextUrl: string | null) {
    const token = await getToken();
    if (!token) throw new Error("Session expired. Please sign in again.");
    const displayName = (name || user?.name || "User").trim();
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: displayName.length >= 2 ? displayName : "User",
        company: company.trim(),
        avatarUrl: nextUrl,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Could not save profile photo");
    }
    setAvatarUrl(nextUrl);
    await refreshProfile();
    setSaved(true);
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }

    setPhotoBusy(true);
    setError(null);
    setSaved(false);
    const preview = URL.createObjectURL(file);
    setAvatarUrl(preview);
    try {
      let nextUrl: string | null = null;
      if (clerkUser?.setProfileImage) {
        const updated = await clerkUser.setProfileImage({ file });
        nextUrl = updated.imageUrl || clerkUser.imageUrl || null;
      }
      if (!nextUrl) {
        const uploaded = await uploadFile(file);
        if (!uploaded) throw new Error("Could not upload photo");
        nextUrl = `/api/storage${uploaded.objectPath}`;
      }
      await persistAvatar(nextUrl);
    } catch (err) {
      setAvatarUrl(user?.avatarUrl ?? null);
      setError(err instanceof Error ? err.message : "Could not update photo");
    } finally {
      URL.revokeObjectURL(preview);
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (clerkUser?.setProfileImage) {
        await clerkUser.setProfileImage({ file: null });
      }
      await persistAvatar(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    if (name.trim().length < 2) {
      setError("Enter your name (at least 2 characters)");
      return;
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
      const userRes = await fetch("/api/users/me", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: name.trim(), company: company.trim() }),
      });
      if (!userRes.ok) {
        const body = (await userRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save account details");
      }

      if (hasShop && shop) {
        const shopRes = await fetch("/api/suppliers/me", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
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
          const body = (await shopRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not save shop details");
        }
      }

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
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Account</p>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-1">
        Edit profile
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Update your details anytime. After GST verification, GSTIN stays locked until you
        re-verify.
      </p>

      <div className="space-y-6">
        <section className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Your account</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => !photoBusy && photoInputRef.current?.click()}
              disabled={photoBusy}
              className="relative w-20 h-20 rounded-full overflow-hidden border border-border bg-primary text-white shrink-0 group disabled:opacity-60"
              aria-label="Change profile photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
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
              <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {photoBusy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
              </span>
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Profile photo</p>
              <p className="text-xs text-muted-foreground mb-2">JPG, PNG, or WebP · up to 5 MB</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  {photoBusy ? "Updating…" : "Change photo"}
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    disabled={photoBusy}
                    onClick={() => void removePhoto()}
                    className="rounded-xl px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onPickPhoto(e)}
            />
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
          <section className="bg-white rounded-2xl border border-border p-5 sm:p-6">
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
            <section className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-foreground">Shop details</h2>
                {shop.verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                    <BadgeCheck size={12} /> Verified
                  </span>
                )}
              </div>
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

            <section className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-4">
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
                    until you complete GST verification again.
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
                    Finish seller verification to lock this GSTIN and get a verified badge.
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
