'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  Boxes, 
  ArrowLeft, 
  Search, 
  Edit3, 
  Trash2, 
  PlusCircle, 
  Save, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  SlidersHorizontal 
} from "lucide-react";

export const dynamic = 'force-dynamic';

const STORES = [
  "All Stores",
  "Metro Gaisano Ayala Cebu",
  "Metro Gaisano Colon",
  "Metro Gaisano Mandaue",
  "Metro Gaisano Market",
  "Natasha",
  "RML",
  "Landmark Makati",
  "Landmark Nuvali",
  "Landmark Trinoma",
];

interface ProductItem {
  id: string;
  style_code: string;
  sku: string;
  style_name: string;
  description: string;
  color: string;
  category: string;
  department: string;
  size: string;
  price: number;
}

interface InventoryItem {
  id: string;
  store: string;
  style_code: string;
  sku: string;
  style_name: string;
  current_stock: number;
  quantity: number;
  available_stock: number;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"products" | "inventory">("products");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState("All Stores");

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);

  // Notifications
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Edit Live Stock Modal State
  const [editingStockItem, setEditingStockItem] = useState<InventoryItem | null>(null);
  const [newStockValue, setNewStockValue] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Products
      const { data: prodData, error: prodError } = await supabase
        .from("products")
        .select("*")
        .order("style_name", { ascending: true });

      if (prodError) throw prodError;
      setProducts(prodData || []);

      // 2. Fetch Store Inventory
      let invQuery = supabase.from("store_inventory").select("*");
      if (selectedStore !== "All Stores") {
        invQuery = invQuery.eq("store", selectedStore);
      }
      const { data: invData, error: invError } = await invQuery;

      if (invError) throw invError;
      setInventoryList(invData || []);
    } catch (err: any) {
      console.error("Error fetching admin data:", err);
      setErrorMsg("Failed to load dashboard records.");
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- PRODUCT CRUD HANDLERS ---
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete product "${name}"?`)) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg("Product successfully deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete product.");
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({
          style_code: editingProduct.style_code.trim(),
          sku: editingProduct.sku.trim(),
          style_name: editingProduct.style_name.trim(),
          description: editingProduct.description.trim(),
          color: editingProduct.color.trim(),
          category: editingProduct.category.trim(),
          department: editingProduct.department.trim(),
          size: editingProduct.size.trim(),
          price: Number(editingProduct.price) || 0,
        })
        .eq("id", editingProduct.id);

      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? editingProduct : p))
      );
      setEditingProduct(null);
      setSuccessMsg("Product updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update product.");
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // --- LIVE INVENTORY STOCK UPDATE HANDLERS ---
  const handleOpenStockEdit = (item: InventoryItem) => {
    setEditingStockItem(item);
    setNewStockValue(String(item.current_stock ?? item.quantity ?? 0));
  };

  const handleSaveStockEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockItem) return;

    const parsedStock = parseInt(newStockValue, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setErrorMsg("Please enter a valid stock quantity.");
      return;
    }

    try {
      const { error } = await supabase
        .from("store_inventory")
        .update({
          current_stock: parsedStock,
          quantity: parsedStock,
          available_stock: parsedStock,
        })
        .eq("id", editingStockItem.id);

      if (error) throw error;

      setInventoryList((prev) =>
        prev.map((item) =>
          item.id === editingStockItem.id
            ? { ...item, current_stock: parsedStock, quantity: parsedStock, available_stock: parsedStock }
            : item
        )
      );

      setEditingStockItem(null);
      setSuccessMsg("Live on-hand inventory stock updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update live inventory stock.");
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // Filtered Lists
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.style_name.toLowerCase().includes(q) ||
        p.style_code.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const filteredInventory = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return inventoryList.filter(
      (i) =>
        String(i.style_name || "").toLowerCase().includes(q) ||
        String(i.style_code || "").toLowerCase().includes(q) ||
        String(i.sku || "").toLowerCase().includes(q) ||
        String(i.store || "").toLowerCase().includes(q)
    );
  }, [inventoryList, searchQuery]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-[1600px] mx-auto antialiased space-y-6">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/inventory"
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 p-2 rounded-xl border border-slate-800 transition cursor-pointer flex items-center justify-center"
            title="Back to Inventory"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
              Enterprise Control Center
            </span>
            <h1 className="text-2xl font-black text-white mt-1">Admin Management Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/products/new"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 transition shadow-lg shadow-emerald-500/10"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create New Product</span>
          </Link>
        </div>
      </header>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-2xl flex items-center space-x-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl flex items-center space-x-3 animate-in fade-in">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="text-xs font-semibold">{errorMsg}</p>
        </div>
      )}

      {/* Dashboard Navigation Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
        <button
          onClick={() => setActiveTab("products")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center space-x-2 ${
            activeTab === "products"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/40"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Products Catalog (CRUD)</span>
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center space-x-2 ${
            activeTab === "inventory"
              ? "bg-amber-600 text-slate-950 shadow-lg shadow-amber-600/20 border border-amber-500/40 font-extrabold"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Live Stock On-Hand Adjuster</span>
        </button>
      </div>

      {/* Filters Bar */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3 grid grid-cols-12 gap-3 items-center shadow-xl">
        <div className="col-span-7 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center space-x-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder={activeTab === "products" ? "Search product name, style code, SKU..." : "Search inventory store, style, SKU..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {activeTab === "inventory" && (
          <div className="col-span-5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-emerald-400 focus:outline-none cursor-pointer"
            >
              {STORES.map((store) => (
                <option key={store} value={store} className="bg-slate-900 text-white font-normal">
                  {store}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* TAB 1: PRODUCTS CATALOG CRUD */}
      {activeTab === "products" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400">Loading products catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-bold text-white">No products found.</p>
              <p className="text-xs text-slate-500">Create a new product using the button above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Style Code / SKU</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category / Dept</th>
                    <th className="py-3 px-4">Color / Size</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-800/40 transition ${index % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/90"}`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-200">{product.style_code}</div>
                        <div className="font-mono text-[10px] text-blue-400">{product.sku}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-white max-w-xs truncate">
                        {product.style_name}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {product.category !== "-" ? product.category : "Unassigned"} ({product.department})
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {product.color} / {product.size}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        ₱{Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center space-x-2">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.style_name)}
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: LIVE INVENTORY STOCK ADJUSTER */}
      {activeTab === "inventory" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400">Loading store inventory records...</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-bold text-white">No inventory stock records found for this store.</p>
              <p className="text-xs text-slate-500">Ensure items have been added to store inventory.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Store Location</th>
                    <th className="py-3 px-4">Style Code / SKU</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-center">Live On-Hand Stock</th>
                    <th className="py-3 px-4 text-center">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredInventory.map((item, index) => {
                    const stockQty = Number(item.available_stock ?? item.current_stock ?? item.quantity) || 0;
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-800/40 transition ${index % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/90"}`}
                      >
                        <td className="py-3 px-4 font-semibold text-emerald-400">
                          {item.store}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-200">{item.style_code}</div>
                          <div className="font-mono text-[10px] text-blue-400">{item.sku}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-white max-w-xs truncate">
                          {item.style_name || "Unassigned Item"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-emerald-400">
                          <span className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl text-sm inline-block">
                            {stockQty} pcs
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenStockEdit(item)}
                            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>Update Stock</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveProductEdit} className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                  Catalog Editor
                </span>
                <h3 className="text-lg font-black text-white mt-1">Edit Product Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Style Code</label>
                <input
                  type="text"
                  required
                  value={editingProduct.style_code}
                  onChange={(e) => setEditingProduct({ ...editingProduct, style_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</label>
                <input
                  type="text"
                  required
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Style Name</label>
                <input
                  type="text"
                  required
                  value={editingProduct.style_name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, style_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={editingProduct.description || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                <input
                  type="text"
                  value={editingProduct.category || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
                <input
                  type="text"
                  value={editingProduct.department || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</label>
                <input
                  type="text"
                  value={editingProduct.color || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, color: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Size</label>
                <input
                  type="text"
                  value={editingProduct.size || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, size: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Price (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end space-x-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition border border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 transition cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* UPDATE LIVE STOCK MODAL */}
      {editingStockItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveStockEdit} className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  Stock Adjuster
                </span>
                <h3 className="text-lg font-black text-white mt-1">Update On-Hand Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStockItem(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
              <div className="flex justify-between">
                <span className="text-slate-500">Store:</span>
                <span className="text-emerald-400 font-bold">{editingStockItem.store}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Item:</span>
                <span className="text-white font-bold truncate max-w-[220px]">{editingStockItem.style_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Style / SKU:</span>
                <span className="text-blue-400">{editingStockItem.style_code} ({editingStockItem.sku})</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                New Live On-Hand Quantity (pcs) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={newStockValue}
                onChange={(e) => setNewStockValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base text-emerald-400 font-mono font-black focus:outline-none focus:border-amber-500 transition text-center"
              />
            </div>

            <div className="pt-3 flex justify-end space-x-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStockItem(null)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition border border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 transition cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Save className="h-4 w-4" />
                <span>Update Stock</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}