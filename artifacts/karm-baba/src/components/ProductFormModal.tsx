import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, Loader2, Package, X } from "lucide-react";
import { useListCategories } from "@workspace/api-client-react";
import { ImageUploader } from "./ImageUploader";

interface ProductFormData {
  name: string;
  description: string;
  categoryId: number;
  customCategory: string;
  minPrice: string;
  maxPrice: string;
  unit: string;
  minOrder: string;
  imageUrl: string;
  images: string[];
  inStock: boolean;
  tags: string;
}

interface ProductSubmitData {
  name: string;
  description: string;
  categoryId: number;
  customCategory?: string;
  minPrice: number;
  maxPrice: number;
  unit: string;
  minOrder: number;
  imageUrl: string;
  images: string[];
  inStock: boolean;
  tags: string[];
}

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProductSubmitData) => Promise<void>;
  initialValues?: Partial<ProductFormData & { id: number }>;
  loading?: boolean;
  title?: string;
}

const UNITS = ["piece", "kg", "gram", "litre", "box", "set", "pair", "dozen", "meter", "roll"];
const OTHERS_CATEGORY_ID = -1;

const DEFAULT_FORM: ProductFormData = {
  name: "",
  description: "",
  categoryId: 0,
  customCategory: "",
  minPrice: "",
  maxPrice: "",
  unit: "piece",
  minOrder: "1",
  imageUrl: "",
  images: [],
  inStock: true,
  tags: "",
};

const fieldClass =
  "w-full rounded-xl border border-border/80 bg-white px-3.5 py-2.5 text-sm text-secondary outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/70";

const labelClass = "mb-1.5 block text-xs font-semibold text-secondary/70";

export function ProductFormModal({
  open,
  onClose,
  onSubmit,
  initialValues,
  loading,
  title = "Add Product",
}: ProductFormModalProps) {
  const { data: categories } = useListCategories();
  const [form, setForm] = useState<ProductFormData>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setForm({
          name: initialValues.name ?? "",
          description: initialValues.description ?? "",
          categoryId: initialValues.categoryId ?? 0,
          customCategory: initialValues.customCategory ?? "",
          minPrice: initialValues.minPrice ?? "",
          maxPrice: initialValues.maxPrice ?? "",
          unit: initialValues.unit ?? "piece",
          minOrder: initialValues.minOrder ?? "1",
          imageUrl: initialValues.imageUrl ?? "",
          images: initialValues.images ?? [],
          inStock: initialValues.inStock ?? true,
          tags: (initialValues.tags ?? "").toString(),
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setError(null);
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && document.body.getAttribute("data-kb-camera-open") !== "1") {
        onClose();
      }
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Product name is required");
      return;
    }
    if (form.categoryId === OTHERS_CATEGORY_ID) {
      if (form.customCategory.trim().length < 2) {
        setError("Please enter a custom category");
        return;
      }
    } else if (!form.categoryId) {
      setError("Please select a category");
      return;
    }
    if (!form.minPrice || !form.maxPrice) {
      setError("Price range is required");
      return;
    }
    const minP = parseFloat(form.minPrice);
    const maxP = parseFloat(form.maxPrice);
    if (isNaN(minP) || isNaN(maxP) || minP <= 0 || maxP < minP) {
      setError("Enter a valid price range (min ≤ max)");
      return;
    }

    const primaryImage = form.imageUrl || form.images[0] || "";
    if (!primaryImage || form.images.length === 0) {
      setError("Upload at least one product image");
      return;
    }
    if (form.images.some((u) => u.startsWith("data:"))) {
      setError("Image upload did not finish. Remove the image and upload again.");
      return;
    }

    const usingCustom = form.categoryId === OTHERS_CATEGORY_ID;
    const customName = form.customCategory.trim();

    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        categoryId: usingCustom ? OTHERS_CATEGORY_ID : form.categoryId,
        customCategory: usingCustom ? customName : undefined,
        minPrice: minP,
        maxPrice: maxP,
        unit: form.unit,
        minOrder: parseInt(form.minOrder) || 1,
        imageUrl: primaryImage,
        images: form.images,
        inStock: form.inStock,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    }
  }

  function handleImagesChange(newImages: string[]) {
    setForm((prev) => ({
      ...prev,
      images: newImages,
      imageUrl: newImages[0] ?? prev.imageUrl,
    }));
  }

  if (!open || !mounted) return null;

  const isEdit = Boolean(initialValues && "id" in initialValues && initialValues.id);

  const modal = (
    <div
      className="fixed inset-0 z-[300] kb-z-modal flex items-end justify-center sm:items-center sm:p-4 backdrop-blur-[2px]"
      style={{
        // Strong scrim so sticky header + site footer don't compete with the form
        background:
          "radial-gradient(720px 360px at 18% 0%, hsl(28 100% 50% / 0.14), transparent 55%), rgba(10, 16, 32, 0.88)",
      }}
      onClick={(e) => {
        if (document.body.getAttribute("data-kb-camera-open") === "1") return;
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="flex w-full max-w-2xl max-h-[min(92dvh,900px)] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="relative shrink-0 overflow-hidden bg-secondary text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "linear-gradient(135deg, hsl(220 60% 16%) 0%, hsl(220 55% 26%) 48%, hsl(28 90% 42%) 140%)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-30"
            style={{
              background: "radial-gradient(circle, hsl(28 100% 60%) 0%, transparent 70%)",
            }}
          />
          <div className="relative flex items-start justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Package size={20} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  Seller catalog
                </p>
                <h2 className="truncate font-heading text-xl font-bold tracking-tight">{title}</h2>
                <p className="mt-0.5 text-sm text-white/65">
                  {isEdit
                    ? "Update photos, pricing, and listing details."
                    : "Add photos and details buyers see on your shop."}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/15"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <section className="rounded-2xl border border-primary/15 bg-gradient-to-b from-accent/80 to-white p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon size={16} className="text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-secondary">Product photos</h3>
                  <p className="text-xs text-muted-foreground">
                    Up to 5 · first image is the cover buyers see
                  </p>
                </div>
              </div>
              <ImageUploader images={form.images} onChange={handleImagesChange} maxImages={5} />
            </section>

            <section className="space-y-4">
              <div>
                <label className={labelClass}>
                  Product name <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Premium Cotton T-Shirt"
                  className={fieldClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Material, specs, use cases…"
                  rows={3}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Category <span className="text-primary">*</span>
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => {
                    const nextId = parseInt(e.target.value, 10);
                    setForm((prev) => ({
                      ...prev,
                      categoryId: nextId,
                      customCategory:
                        nextId === OTHERS_CATEGORY_ID ? prev.customCategory : "",
                    }));
                  }}
                  className={`${fieldClass} bg-white`}
                >
                  <option value={0}>Select a category</option>
                  {categories
                    ?.filter((cat) => cat.name.toLowerCase() !== "others")
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  <option value={OTHERS_CATEGORY_ID}>Others</option>
                </select>
                {form.categoryId === OTHERS_CATEGORY_ID && (
                  <div className="mt-3">
                    <label className={labelClass}>
                      Custom category <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.customCategory}
                      onChange={(e) => set("customCategory", e.target.value)}
                      placeholder="e.g. Packaging, Chemicals"
                      className={fieldClass}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-secondary/10 bg-secondary/[0.03] p-4 sm:p-5">
              <h3 className="text-sm font-bold text-secondary">Pricing & order</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Min price (₹) <span className="text-primary">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.minPrice}
                    onChange={(e) => set("minPrice", e.target.value)}
                    placeholder="100"
                    min="0"
                    step="0.01"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Max price (₹) <span className="text-primary">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.maxPrice}
                    onChange={(e) => set("maxPrice", e.target.value)}
                    placeholder="500"
                    min="0"
                    step="0.01"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => set("unit", e.target.value)}
                    className={`${fieldClass} bg-white`}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Min order qty</label>
                  <input
                    type="number"
                    value={form.minOrder}
                    onChange={(e) => set("minOrder", e.target.value)}
                    placeholder="50"
                    min="1"
                    className={fieldClass}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 pb-2">
              <div>
                <label className={labelClass}>
                  Tags <span className="font-normal text-muted-foreground">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="cotton, wholesale, export"
                  className={fieldClass}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-white px-3.5 py-3 transition-colors hover:border-primary/30">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={(e) => set("inStock", e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-semibold text-secondary">In stock</span>
                <span className="ml-auto text-xs text-muted-foreground">Visible to buyers</span>
              </label>
            </section>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
          </div>

          <div
            className="flex shrink-0 gap-3 border-t border-border/70 bg-white px-5 py-3.5 sm:px-6 sm:py-4"
            style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold text-secondary transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(255,122,0,0.9)] transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving…
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Publish product"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
