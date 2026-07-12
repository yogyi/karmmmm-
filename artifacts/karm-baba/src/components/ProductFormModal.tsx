import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useListCategories } from "@workspace/api-client-react";
import { ImageUploader } from "./ImageUploader";

interface ProductFormData {
  name: string;
  description: string;
  categoryId: number;
  minPrice: string;
  maxPrice: string;
  unit: string;
  minOrder: string;
  imageUrl: string;
  images: string[];
  inStock: boolean;
  tags: string;
}

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    categoryId: number;
    minPrice: number;
    maxPrice: number;
    unit: string;
    minOrder: number;
    imageUrl: string;
    images: string[];
    inStock: boolean;
    tags: string[];
  }) => Promise<void>;
  initialValues?: Partial<ProductFormData & { id: number }>;
  loading?: boolean;
  title?: string;
}

const UNITS = ["piece", "kg", "gram", "litre", "box", "set", "pair", "dozen", "meter", "roll"];

const DEFAULT_FORM: ProductFormData = {
  name: "",
  description: "",
  categoryId: 0,
  minPrice: "",
  maxPrice: "",
  unit: "piece",
  minOrder: "1",
  imageUrl: "",
  images: [],
  inStock: true,
  tags: "",
};

export function ProductFormModal({ open, onClose, onSubmit, initialValues, loading, title = "Add Product" }: ProductFormModalProps) {
  const { data: categories } = useListCategories();
  const [form, setForm] = useState<ProductFormData>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setForm({
          name: initialValues.name ?? "",
          description: initialValues.description ?? "",
          categoryId: initialValues.categoryId ?? 0,
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

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError("Product name is required"); return; }
    if (!form.categoryId) { setError("Please select a category"); return; }
    if (!form.minPrice || !form.maxPrice) { setError("Price range is required"); return; }
    const minP = parseFloat(form.minPrice);
    const maxP = parseFloat(form.maxPrice);
    if (isNaN(minP) || isNaN(maxP) || minP <= 0 || maxP < minP) {
      setError("Enter a valid price range (min ≤ max)");
      return;
    }

    const primaryImage = form.imageUrl || form.images[0] || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400";

    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        minPrice: minP,
        maxPrice: maxP,
        unit: form.unit,
        minOrder: parseInt(form.minOrder) || 1,
        imageUrl: primaryImage,
        images: form.images.length > 0 ? form.images : [primaryImage],
        inStock: form.inStock,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    }
  }

  function handleImagesChange(newImages: string[]) {
    set("images", newImages);
    if (newImages.length > 0 && !form.imageUrl) {
      set("imageUrl", newImages[0]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Product Images */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Product Images <span className="text-muted-foreground font-normal">(up to 5)</span>
            </label>
            <ImageUploader images={form.images} onChange={handleImagesChange} maxImages={5} />
            {form.images.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">First image will be the primary product photo</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Premium Cotton T-Shirt"
              className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Describe your product — material, specifications, use cases..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={form.categoryId}
              onChange={e => set("categoryId", parseInt(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
            >
              <option value={0}>Select a category</option>
              {categories?.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Min Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.minPrice}
                onChange={e => set("minPrice", e.target.value)}
                placeholder="100"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Max Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.maxPrice}
                onChange={e => set("maxPrice", e.target.value)}
                placeholder="500"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              />
            </div>
          </div>

          {/* Unit & MOQ */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Unit</label>
              <select
                value={form.unit}
                onChange={e => set("unit", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Min Order Qty</label>
              <input
                type="number"
                value={form.minOrder}
                onChange={e => set("minOrder", e.target.value)}
                placeholder="50"
                min="1"
                className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tags <span className="text-muted-foreground font-normal">(comma separated)</span>
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={e => set("tags", e.target.value)}
              placeholder="e.g. cotton, wholesale, export"
              className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>

          {/* In Stock */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="inStock"
              checked={form.inStock}
              onChange={e => set("inStock", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="inStock" className="text-sm font-medium text-foreground">In Stock</label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : title}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
