import { useState } from "react";
import { useLocation } from "wouter";
import { Package, FileText, Clock, Eye, TrendingUp, Plus, CheckCircle, XCircle, MessageSquare, Pencil, Trash2, AlertTriangle, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetDashboardStats,
  useGetSupplierDashboard,
  useListRfqs,
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { ProductFormModal } from "@/components/ProductFormModal";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  responded: { label: "Responded", color: "bg-blue-100 text-blue-700", icon: <MessageSquare size={12} /> },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700", icon: <CheckCircle size={12} /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600", icon: <XCircle size={12} /> },
};

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

interface ProductRow {
  id: number;
  name: string;
  description?: string | null;
  categoryId: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  minOrder: number;
  imageUrl: string;
  images?: string[];
  inStock: boolean;
  tags?: string[];
  featured?: boolean;
}

interface DeleteConfirmProps {
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirm({ productName, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-600" />
        </div>
        <h3 className="font-bold text-foreground mb-1">Delete Product?</h3>
        <p className="text-sm text-muted-foreground mb-6">
          <span className="font-medium text-foreground">"{productName}"</span> will be permanently removed from the marketplace.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isSupplier = user?.role === "seller" || user?.role === "admin";
  const supplierId = user?.supplierId ?? 1;

  const { data: platformStats } = useGetDashboardStats();
  const { data: supplierDash } = useGetSupplierDashboard(supplierId, { query: { enabled: isSupplier } as any });
  const { data: allRfqs } = useListRfqs({}, { query: { enabled: true } as any });

  const { data: supplierProductsData, refetch: refetchProducts } = useListProducts(
    { supplierId },
    { query: { enabled: isSupplier } as any }
  );
  const supplierProducts = supplierProductsData?.items ?? [];

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "products">("overview");

  async function handleCreate(data: {
    name: string; description: string; categoryId: number;
    minPrice: number; maxPrice: number; unit: string; minOrder: number;
    imageUrl: string; images: string[]; inStock: boolean; tags: string[];
  }) {
    await createProduct.mutateAsync({
      data: { ...data, supplierId },
    });
    queryClient.invalidateQueries();
    refetchProducts();
    setAddModalOpen(false);
  }

  async function handleUpdate(data: {
    name: string; description: string; categoryId: number;
    minPrice: number; maxPrice: number; unit: string; minOrder: number;
    imageUrl: string; images: string[]; inStock: boolean; tags: string[];
  }) {
    if (!editProduct) return;
    await updateProduct.mutateAsync({
      id: editProduct.id,
      data,
    });
    queryClient.invalidateQueries();
    refetchProducts();
    setEditProduct(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteProduct.mutateAsync({ id: deleteTarget.id });
    queryClient.invalidateQueries();
    refetchProducts();
    setDeleteTarget(null);
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold mb-2">Please Sign In</h2>
        <p className="text-muted-foreground text-sm mb-4">You need to be logged in to view the dashboard.</p>
        <button onClick={() => navigate("/login")} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors">
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isSupplier ? "Supplier Dashboard" : "Platform Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {user.name}</p>
        </div>
        <div className="flex gap-2">
          {isSupplier && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Add Product
            </button>
          )}
          <button
            onClick={() => navigate("/rfq/new")}
            className="flex items-center gap-2 border border-border px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-muted transition-colors"
          >
            <FileText size={16} /> Post RFQ
          </button>
        </div>
      </div>

      {/* Tabs for suppliers */}
      {isSupplier && (
        <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl w-fit">
          {(["overview", "products"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "products" ? `My Products (${supplierProducts.length})` : "Overview"}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === "overview" ? (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {isSupplier && supplierDash ? (
                <>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                    <StatCard icon={<Package size={20} />} label="Your Products" value={supplierDash.productCount} color="bg-primary/10 text-primary" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                    <StatCard icon={<FileText size={20} />} label="Total RFQs" value={supplierDash.rfqCount} color="bg-blue-100 text-blue-600" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                    <StatCard icon={<Clock size={20} />} label="Pending RFQs" value={supplierDash.pendingRfqs} sub="Awaiting response" color="bg-yellow-100 text-yellow-600" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <StatCard icon={<Eye size={20} />} label="Profile Views" value={supplierDash.totalViews.toLocaleString()} color="bg-green-100 text-green-600" />
                  </motion.div>
                </>
              ) : platformStats ? (
                <>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                    <StatCard icon={<Package size={20} />} label="Total Products" value={platformStats.totalProducts.toLocaleString()} color="bg-primary/10 text-primary" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                    <StatCard icon={<TrendingUp size={20} />} label="Total Suppliers" value={platformStats.totalSuppliers.toLocaleString()} color="bg-blue-100 text-blue-600" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                    <StatCard icon={<FileText size={20} />} label="RFQs Processed" value={platformStats.totalRfqs.toLocaleString()} color="bg-yellow-100 text-yellow-600" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <StatCard icon={<Eye size={20} />} label="Registered Users" value={platformStats.totalUsers.toLocaleString()} color="bg-green-100 text-green-600" />
                  </motion.div>
                </>
              ) : (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse h-28" />
                ))
              )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* RFQ table */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <h2 className="font-bold text-foreground">Recent RFQs</h2>
                  <button onClick={() => navigate("/rfq")} className="text-sm text-primary hover:underline">View All</button>
                </div>
                <div className="divide-y divide-border">
                  {(isSupplier ? supplierDash?.recentRfqs : platformStats?.recentRfqs ?? allRfqs?.slice(0, 5))?.map(rfq => {
                    const status = statusConfig[rfq.status as keyof typeof statusConfig] ?? statusConfig.pending;
                    return (
                      <div
                        key={rfq.id}
                        onClick={() => navigate(`/rfq/${rfq.id}`)}
                        className="flex items-center justify-between p-4 hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-foreground truncate">{rfq.productName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {rfq.buyerName} · {rfq.quantity} {rfq.unit}
                            {rfq.targetPrice && ` · ₹${rfq.targetPrice}/${rfq.unit}`}
                            {isSupplier && rfq.status === "pending" ? " · Reply with quote →" : ""}
                          </div>
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ml-3 flex-shrink-0 ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </div>
                    );
                  }) ?? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No RFQs yet</div>
                  )}
                </div>
              </div>

              {/* Category breakdown / quick actions */}
              <div className="space-y-4">
                {platformStats?.categoryBreakdown && (
                  <div className="bg-white rounded-xl border border-border overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <h2 className="font-bold text-foreground">Categories</h2>
                    </div>
                    <div className="p-4 space-y-2">
                      {platformStats.categoryBreakdown.slice(0, 6).map(cat => (
                        <div key={cat.categoryName} className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground flex-1 truncate">{cat.categoryName}</div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden w-16">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (cat.count / 200) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-foreground w-6 text-right">{cat.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-border p-4">
                  <h2 className="font-bold text-foreground mb-3">Quick Actions</h2>
                  <div className="space-y-2">
                    {isSupplier && (
                      <button
                        onClick={() => setAddModalOpen(true)}
                        className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-lg hover:bg-muted transition-colors text-foreground"
                      >
                        <span className="text-primary"><Plus size={14} /></span>
                        Add New Product
                      </button>
                    )}
                    {[
                      { label: "Browse Products", path: "/products", icon: <Package size={14} /> },
                      { label: "Find Suppliers", path: "/suppliers", icon: <TrendingUp size={14} /> },
                      { label: "Post RFQ", path: "/rfq/new", icon: <FileText size={14} /> },
                      { label: "My RFQs", path: "/rfq", icon: <Clock size={14} /> },
                    ].map(action => (
                      <button
                        key={action.path}
                        onClick={() => navigate(action.path)}
                        className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-lg hover:bg-muted transition-colors text-foreground"
                      >
                        <span className="text-primary">{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Products management tab */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-bold text-foreground">My Products</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{supplierProducts.length} product{supplierProducts.length !== 1 ? "s" : ""} listed</p>
                </div>
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                  <Plus size={15} /> Add Product
                </button>
              </div>

              {supplierProducts.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Package size={28} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">No products yet</h3>
                  <p className="text-sm text-muted-foreground mb-5">Add your first product to start receiving inquiries from buyers.</p>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
                  >
                    <Plus size={16} /> Add First Product
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {supplierProducts.map(product => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={20} className="text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground text-sm truncate">{product.name}</h3>
                          {product.inStock ? (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">In Stock</span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Out of Stock</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ₹{product.minPrice.toLocaleString()} – ₹{product.maxPrice.toLocaleString()} / {product.unit}
                          <span className="mx-1.5">·</span>
                          MOQ: {product.minOrder} {product.unit}
                        </p>
                        {product.categoryName && (
                          <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                        )}
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => navigate(`/products/${product.id}`)}
                          className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="View product"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setEditProduct(product as ProductRow)}
                          className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Edit product"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(product as ProductRow)}
                          className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Delete product"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <ProductFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleCreate}
        loading={createProduct.isPending}
        title="Add Product"
      />

      {/* Edit Product Modal */}
      <ProductFormModal
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        onSubmit={handleUpdate}
        initialValues={editProduct ? {
          name: editProduct.name,
          description: editProduct.description ?? "",
          categoryId: editProduct.categoryId,
          minPrice: String(editProduct.minPrice),
          maxPrice: String(editProduct.maxPrice),
          unit: editProduct.unit,
          minOrder: String(editProduct.minOrder),
          imageUrl: editProduct.imageUrl,
          images: editProduct.images ?? [],
          inStock: editProduct.inStock,
          tags: (editProduct.tags ?? []).join(", "),
        } : undefined}
        loading={updateProduct.isPending}
        title="Edit Product"
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <DeleteConfirm
          productName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteProduct.isPending}
        />
      )}
    </div>
  );
}
