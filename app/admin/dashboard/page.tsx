'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
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
  SlidersHorizontal,
  Boxes,
  Store,
  Sparkles,
  History
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

interface StockHistoryItem {
  id: string;
  store: string;
  style_code: string;
  sku: string;
  style_name: string;
  old_stock: number;
  new_stock: number;
  changed_by: string;
  created_at: string;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"products" | "inventory" | "history">("products");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState("All Stores");

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [stockHistoryList, setStockHistoryList] = useState<StockHistoryItem[]>([]);

  // Pagination States for Products
  const [currentProdPage, setCurrentProdPage] = useState<number>(1);
  const [prodItemsPerPage, setProdItemsPerPage] = useState<number>(10);

  // Pagination States for Inventory
  const [currentInvPage, setCurrentInvPage] = useState<number>(1);
  const [invItemsPerPage, setInvItemsPerPage] = useState<number>(10);

  // Pagination States for History
  const [currentHistPage, setCurrentHistPage] = useState<number>(1);
  const [histItemsPerPage, setHistItemsPerPage] = useState<number>(10);

  // Notifications
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Create Product Modal State
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    style_code: "",
    sku: "",
    style_name: "",
    description: "",
    category: "",
    department: "",
    color: "",
    size: "",
    price: "",
  });
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Edit Live Stock Modal State
  const [editingStockItem, setEditingStockItem] = useState<InventoryItem | null>(null);
  const [newStockValue, setNewStockValue] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Products with chunking loop to bypass the 1,000 limit
      let allProducts: any[] = [];
      let page = 0;
      let fetchMoreProducts = true;
      const pageSize = 1000;

      while (fetchMoreProducts) {
        const { data: prodData, error: prodError } = await supabase
          .from("products")
          .select("*")
          .order("style_name", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (prodError) throw prodError;

        if (!prodData || prodData.length === 0) {
          fetchMoreProducts = false;
        } else {
          allProducts = [...allProducts, ...prodData];
          if (prodData.length < pageSize) {
            fetchMoreProducts = false;
          } else {
            page++;
          }
        }
      }
      setProducts(allProducts);

      // Create a fast lookup map for style_code / sku -> style_name
      const productMap = new Map<string, string>();
      allProducts.forEach((p) => {
        if (p.style_code) productMap.set(p.style_code.trim(), p.style_name);
        if (p.sku) productMap.set(p.sku.trim(), p.style_name);
      });

      // 2. Fetch Store Inventory with chunking loop & in-memory product name resolution
      let allInventory: any[] = [];
      let invPage = 0;
      let fetchMoreInv = true;

      while (fetchMoreInv) {
        let invQuery = supabase
          .from("store_inventory")
          .select("*")
          .range(invPage * pageSize, (invPage + 1) * pageSize - 1);

        if (selectedStore !== "All Stores") {
          invQuery = invQuery.eq("store", selectedStore);
        }

        const { data: invData, error: invError } = await invQuery;

        if (invError) throw invError;

        if (!invData || invData.length === 0) {
          fetchMoreInv = false;
        } else {
          const mappedInv = invData.map((item: any) => {
            const resolvedName = 
              item.style_name || 
              (item.style_code ? productMap.get(item.style_code.trim()) : undefined) ||
              (item.sku ? productMap.get(item.sku.trim()) : undefined) ||
              "Unassigned Item";

            return {
              ...item,
              style_name: resolvedName,
            };
          });

          allInventory = [...allInventory, ...mappedInv];
          if (invData.length < pageSize) {
            fetchMoreInv = false;
          } else {
            invPage++;
          }
        }
      }
      setInventoryList(allInventory);

      // 3. Fetch Stock History audit logs
      const { data: histData, error: histError } = await supabase
        .from("stock_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!histError) {
        setStockHistoryList(histData || []);
      }
      setErrorMsg("");
    } catch (err: any) {
      console.error("Error fetching admin data:", err);
      setErrorMsg(err.message || "Failed to load dashboard records.");
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentProdPage(1);
    setCurrentInvPage(1);
    setCurrentHistPage(1);
  }, [searchQuery, selectedStore, activeTab, prodItemsPerPage, invItemsPerPage, histItemsPerPage]);

  // Derive unique dropdown options from existing products table data
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category && p.category !== "-") set.add(p.category.trim()); });
    return Array.from(set).sort();
  }, [products]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.department && p.department !== "-") set.add(p.department.trim()); });
    return Array.from(set).sort();
  }, [products]);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.color && p.color !== "-") set.add(p.color.trim()); });
    return Array.from(set).sort();
  }, [products]);

  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.size && p.size !== "-") set.add(p.size.trim()); });
    return Array.from(set).sort();
  }, [products]);

  // Executive KPI summary calculations
  const totalCatalogProducts = products.length;
  const totalStockUnits = useMemo(() => {
    return inventoryList.reduce((acc, curr) => acc + (Number(curr.available_stock ?? curr.current_stock ?? curr.quantity) || 0), 0);
  }, [inventoryList]);

  // --- PRODUCT CREATE HANDLER ---
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingLoading(true);
    setErrorMsg("");

    try {
      if (!newProductForm.style_code || !newProductForm.style_name || !newProductForm.sku || !newProductForm.price) {
        throw new Error("Please fill in all required fields (Style Code, Style Name, SKU, and Price).");
      }

      const { data, error } = await supabase.from("products").insert([
        {
          style_code: newProductForm.style_code.trim(),
          style_name: newProductForm.style_name.trim(),
          description: newProductForm.description.trim(),
          color: newProductForm.color.trim() || "-",
          category: newProductForm.category.trim() || "-",
          department: newProductForm.department.trim() || "-",
          size: newProductForm.size.trim() || "-",
          sku: newProductForm.sku.trim(),
          price: parseFloat(newProductForm.price) || 0,
          created_at: new Date().toISOString(),
        },
      ]).select();

      if (error) throw error;

      if (data && data.length > 0) {
        setProducts((prev) => [data[0], ...prev]);
      }

      setIsCreatingProduct(false);
      setNewProductForm({
        style_code: "",
        sku: "",
        style_name: "",
        description: "",
        category: "",
        department: "",
        color: "",
        size: "",
        price: "",
      });
      setSuccessMsg("Product successfully created and saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create product.");
    } finally {
      setIsCreatingLoading(false);
    }
  };

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

  // --- LIVE INVENTORY STOCK UPDATE HANDLER WITH HISTORY LOGGING ---
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

    const oldStock = Number(editingStockItem.available_stock ?? editingStockItem.current_stock ?? editingStockItem.quantity) || 0;

    try {
      // 1. Update store_inventory table
      const { error: updateError } = await supabase
        .from("store_inventory")
        .update({
          current_stock: parsedStock,
          quantity: parsedStock,
          available_stock: parsedStock,
        })
        .eq("id", editingStockItem.id);

      if (updateError) throw updateError;

      // 2. Insert into stock_history table
      const timestamp = new Date().toISOString();
      const { data: histData, error: historyError } = await supabase.from("stock_history").insert([
        {
          inventory_id: editingStockItem.id,
          store: editingStockItem.store,
          style_code: editingStockItem.style_code,
          sku: editingStockItem.sku,
          style_name: editingStockItem.style_name || "Unassigned Item",
          old_stock: oldStock,
          new_stock: parsedStock,
          changed_by: "Admin",
          created_at: timestamp,
        }
      ]).select();

      if (historyError) {
        console.error("Failed to record stock history:", historyError.message);
      } else if (histData && histData.length > 0) {
        setStockHistoryList((prev) => [histData[0], ...prev]);
      }

      // Update local state
      setInventoryList((prev) =>
        prev.map((item) =>
          item.id === editingStockItem.id
            ? { ...item, current_stock: parsedStock, quantity: parsedStock, available_stock: parsedStock }
            : item
        )
      );

      setEditingStockItem(null);
      setSuccessMsg("Live stock updated & recorded in audit history log!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update live inventory stock.");
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.style_name.toLowerCase().includes(q) ||
        p.style_code.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Paginated Products
  const totalProdPages = Math.ceil(filteredProducts.length / prodItemsPerPage) || 1;
  const prodStartIndex = (currentProdPage - 1) * prodItemsPerPage;
  const prodEndIndex = Math.min(prodStartIndex + prodItemsPerPage, filteredProducts.length);
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(prodStartIndex, prodEndIndex);
  }, [filteredProducts, prodStartIndex, prodEndIndex]);

  // Filtered & Paginated Inventory
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

  const totalInvPages = Math.ceil(filteredInventory.length / invItemsPerPage) || 1;
  const invStartIndex = (currentInvPage - 1) * invItemsPerPage;
  const invEndIndex = Math.min(invStartIndex + invItemsPerPage, filteredInventory.length);
  const paginatedInventory = useMemo(() => {
    return filteredInventory.slice(invStartIndex, invEndIndex);
  }, [filteredInventory, invStartIndex, invEndIndex]);

  // Filtered & Paginated History
  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return stockHistoryList.filter(
      (h) =>
        String(h.style_name || "").toLowerCase().includes(q) ||
        String(h.style_code || "").toLowerCase().includes(q) ||
        String(h.sku || "").toLowerCase().includes(q) ||
        String(h.store || "").toLowerCase().includes(q) ||
        String(h.changed_by || "").toLowerCase().includes(q)
    );
  }, [stockHistoryList, searchQuery]);

  const totalHistPages = Math.ceil(filteredHistory.length / histItemsPerPage) || 1;
  const histStartIndex = (currentHistPage - 1) * histItemsPerPage;
  const histEndIndex = Math.min(histStartIndex + histItemsPerPage, filteredHistory.length);
  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(histStartIndex, histEndIndex);
  }, [filteredHistory, histStartIndex, histEndIndex]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 max-w-[1600px] mx-auto antialiased space-y-5 sm:space-y-6 selection:bg-indigo-500 selection:text-white">
      {/* Executive Glass Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border-2 border-slate-800 p-4 sm:p-5 rounded-3xl shadow-2xl">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link
            href="/inventory"
            className="bg-slate-950 hover:bg-slate-800 text-slate-300 p-2.5 sm:p-3 rounded-2xl border border-slate-700 transition cursor-pointer flex items-center justify-center shadow-inner group shrink-0"
            title="Back to Inventory"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2.5 sm:px-3 py-0.5 rounded-full inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-400" /> Administrative Hub
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-mono font-medium">v2.5</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">Product Catalog & Inventory Center</h1>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={() => setIsCreatingProduct(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 sm:px-5 py-2.5 rounded-2xl text-xs flex items-center justify-center space-x-2 transition shadow-xl shadow-emerald-500/20 cursor-pointer active:scale-95"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>Create New Product</span>
          </button>
        </div>
      </header>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-300 p-3.5 sm:p-4 rounded-2xl flex items-center space-x-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-bold">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-500/10 border-2 border-rose-500/40 text-rose-300 p-3.5 sm:p-4 rounded-2xl flex items-center space-x-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="text-xs font-bold">{errorMsg}</p>
        </div>
      )}

      {/* SECTION DIVIDER 1: HEADER TO KPI METRICS */}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t-2 border-slate-800/90" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-950 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-800 rounded-full">
            Key Metrics Overview
          </span>
        </div>
      </div>

      {/* Modern KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Catalog Master Items</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{totalCatalogProducts.toLocaleString()} <span className="text-xs font-sans text-indigo-400 font-bold">styles</span></p>
            </div>
            <div className="p-2.5 sm:p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400 shadow-inner">
              <Package className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-slate-400 font-semibold space-x-1">
            <span className="text-emerald-400 font-bold">● Active catalog sync (Bypassed 1k limit)</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Store On-Hand Total Volume</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{totalStockUnits.toLocaleString()} <span className="text-xs font-sans text-emerald-400 font-bold">units</span></p>
            </div>
            <div className="p-2.5 sm:p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 shadow-inner">
              <Boxes className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-slate-400 font-semibold space-x-1">
            <span className="text-emerald-400 font-bold">● Real-time store availability</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Regional Outlets</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{STORES.length - 1} <span className="text-xs font-sans text-amber-400 font-bold">branches</span></p>
            </div>
            <div className="p-2.5 sm:p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shadow-inner">
              <Store className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-slate-400 font-semibold space-x-1">
            <span className="text-amber-400 font-bold">● Multi-location retail network</span>
          </div>
        </div>
      </section>

      {/* SECTION DIVIDER 2: KPI METRICS TO CONTROLS & TABLES */}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t-2 border-indigo-500/30" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-950 px-3 text-[10px] font-black uppercase tracking-widest text-indigo-400 border border-indigo-500/40 rounded-full">
            Data Control & Operations
          </span>
        </div>
      </div>

      {/* Control Navigation & Filter Bar */}
      <section className="bg-slate-900/90 backdrop-blur-md border-2 border-slate-800 rounded-3xl p-3 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center sticky top-2 sm:top-4 z-30 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <button
            onClick={() => setActiveTab("products")}
            className={`py-2.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-2 border ${
              activeTab === "products"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/20 border-indigo-400/60"
                : "bg-slate-950/60 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/60"
            }`}
          >
            <Package className="h-4 w-4 shrink-0" />
            <span>Products Catalog (CRUD)</span>
          </button>

          <button
            onClick={() => setActiveTab("inventory")}
            className={`py-2.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-2 border ${
              activeTab === "inventory"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 border-amber-400/60 font-extrabold"
                : "bg-slate-950/60 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/60"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            <span>Live Stock Adjuster</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`py-2.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-2 border ${
              activeTab === "history"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20 border-emerald-400/60 font-extrabold"
                : "bg-slate-950/60 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/60"
            }`}
          >
            <History className="h-4 w-4 shrink-0" />
            <span>Stock History Audit Log</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
          <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl px-3.5 py-2.5 flex items-center space-x-2 w-full lg:w-72">
            <Search className="h-4 w-4 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder={activeTab === "products" ? "Search product, style, SKU..." : activeTab === "inventory" ? "Search store, style, SKU..." : "Search audit history logs..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {activeTab === "inventory" && (
            <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl px-3.5 py-2 flex items-center w-full lg:w-64">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full bg-transparent text-xs font-black text-emerald-400 focus:outline-none cursor-pointer"
              >
                {STORES.map((store) => (
                  <option key={store} value={store} className="bg-slate-900 text-white font-normal">
                    {store}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* TAB 1: PRODUCTS CATALOG CRUD TABLE */}
      {activeTab === "products" && (
        <section className="bg-slate-900/80 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400 font-medium">Synchronizing products database...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <p className="text-sm font-bold text-white">No products found matching your filter.</p>
              <p className="text-xs text-slate-500">Create a new product catalog item to populate records.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-950 border-b-2 border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-4 px-5">Style Code</th>
                      <th className="py-4 px-5">SKU</th>
                      <th className="py-4 px-5">Product Name</th>
                      <th className="py-4 px-5">Description</th>
                      <th className="py-4 px-5">Category</th>
                      <th className="py-4 px-5">Department</th>
                      <th className="py-4 px-5">Color</th>
                      <th className="py-4 px-5">Size</th>
                      <th className="py-4 px-5 text-right">Price</th>
                      <th className="py-4 px-5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {paginatedProducts.map((product, index) => (
                      <tr
                        key={product.id}
                        className={`hover:bg-indigo-500/5 transition ${index % 2 === 0 ? "bg-slate-900/30" : "bg-slate-900/80"}`}
                      >
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-200">
                          {product.style_code}
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-blue-400">
                          {product.sku}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-white max-w-xs truncate">
                          {product.style_name}
                        </td>
                        <td className="py-3.5 px-5 text-slate-400 max-w-xs truncate font-normal">
                          {product.description || "-"}
                        </td>
                        <td className="py-3.5 px-5 text-slate-300 font-semibold">
                          <span className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl inline-block">
                            {product.category !== "-" ? product.category : "-"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-400 font-medium">
                          {product.department !== "-" ? product.department : "-"}
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">
                          {product.color !== "-" ? product.color : "-"}
                        </td>
                        <td className="py-3.5 px-5 text-slate-400 font-mono font-semibold">
                          {product.size !== "-" ? product.size : "-"}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono font-black text-emerald-400 text-sm">
                          ₱{Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => setEditingProduct(product)}
                              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition cursor-pointer inline-flex items-center gap-1 shadow-sm"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id, product.style_name)}
                              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition cursor-pointer inline-flex items-center gap-1 shadow-sm"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="bg-slate-950 border-t-2 border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
                  <span className="text-xs text-slate-400 font-medium">
                    Showing <span className="text-white font-bold">{prodStartIndex + 1}</span> to{" "}
                    <span className="text-white font-bold">{prodEndIndex}</span> of{" "}
                    <span className="text-white font-bold">{filteredProducts.length}</span> items
                  </span>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 font-medium">Per page:</span>
                    <select
                      value={prodItemsPerPage}
                      onChange={(e) => setProdItemsPerPage(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentProdPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentProdPage === 1}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-400 font-mono px-2">
                    Page {currentProdPage} of {totalProdPages}
                  </span>
                  <button
                    onClick={() => setCurrentProdPage((prev) => Math.min(prev + 1, totalProdPages))}
                    disabled={currentProdPage === totalProdPages}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* TAB 2: LIVE INVENTORY STOCK ADJUSTER TABLE */}
      {activeTab === "inventory" && (
        <section className="bg-slate-900/80 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400 font-medium">Fetching live store inventory...</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <p className="text-sm font-bold text-white">No inventory stock records found for this store selection.</p>
              <p className="text-xs text-slate-500">Select another store branch or adjust search term.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-950 border-b-2 border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-4 px-5">Store Location</th>
                      <th className="py-4 px-5">Style Code</th>
                      <th className="py-4 px-5">SKU</th>
                      <th className="py-4 px-5">Product Name</th>
                      <th className="py-4 px-5 text-center">Live On-Hand Stock</th>
                      <th className="py-4 px-5 text-center">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {paginatedInventory.map((item, index) => {
                      const stockQty = Number(item.available_stock ?? item.current_stock ?? item.quantity) || 0;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-amber-500/5 transition ${index % 2 === 0 ? "bg-slate-900/30" : "bg-slate-900/80"}`}
                        >
                          <td className="py-3.5 px-5 font-bold text-emerald-400">
                            {item.store}
                          </td>
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-200">
                            {item.style_code}
                          </td>
                          <td className="py-3.5 px-5 font-mono font-bold text-blue-400">
                            {item.sku}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-white max-w-xs truncate">
                            {item.style_name || "Unassigned Item"}
                          </td>
                          <td className="py-3.5 px-5 text-center font-bold font-mono">
                            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1 rounded-2xl text-xs font-black inline-block shadow-inner">
                              {stockQty} pcs
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              onClick={() => handleOpenStockEdit(item)}
                              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-amber-500/10"
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

              {/* Pagination Bar */}
              <div className="bg-slate-950 border-t-2 border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
                  <span className="text-xs text-slate-400 font-medium">
                    Showing <span className="text-white font-bold">{invStartIndex + 1}</span> to{" "}
                    <span className="text-white font-bold">{invEndIndex}</span> of{" "}
                    <span className="text-white font-bold">{filteredInventory.length}</span> records
                  </span>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 font-medium">Per page:</span>
                    <select
                      value={invItemsPerPage}
                      onChange={(e) => setInvItemsPerPage(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentInvPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentInvPage === 1}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-400 font-mono px-2">
                    Page {currentInvPage} of {totalInvPages}
                  </span>
                  <button
                    onClick={() => setCurrentInvPage((prev) => Math.min(prev + 1, totalInvPages))}
                    disabled={currentInvPage === totalInvPages}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* TAB 3: STOCK HISTORY AUDIT LOG TABLE */}
      {activeTab === "history" && (
        <section className="bg-slate-900/80 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400 font-medium">Fetching stock history audit logs...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <p className="text-sm font-bold text-white">No stock history audit records found.</p>
              <p className="text-xs text-slate-500">Stock updates will automatically log changes here.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-950 border-b-2 border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-4 px-5">Timestamp</th>
                      <th className="py-4 px-5">Store Outlet</th>
                      <th className="py-4 px-5">Style Code / SKU</th>
                      <th className="py-4 px-5">Product Name</th>
                      <th className="py-4 px-5 text-center">Stock Change</th>
                      <th className="py-4 px-5">Changed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {paginatedHistory.map((hist, index) => {
                      const diff = hist.new_stock - hist.old_stock;
                      return (
                        <tr
                          key={hist.id}
                          className={`hover:bg-emerald-500/5 transition ${index % 2 === 0 ? "bg-slate-900/30" : "bg-slate-900/80"}`}
                        >
                          <td className="py-3.5 px-5 font-mono text-slate-400 text-[11px]">
                            {new Date(hist.created_at).toLocaleString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-emerald-400">
                            {hist.store}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="font-mono font-bold text-slate-200">{hist.style_code}</div>
                            <div className="font-mono text-[10px] text-blue-400">{hist.sku}</div>
                          </td>
                          <td className="py-3.5 px-5 font-bold text-white max-w-xs truncate">
                            {hist.style_name}
                          </td>
                          <td className="py-3.5 px-5 text-center font-mono font-bold">
                            <span className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-xl inline-flex items-center gap-2">
                              <span className="text-slate-400">{hist.old_stock}</span>
                              <span className="text-slate-600">→</span>
                              <span className="text-emerald-400">{hist.new_stock}</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${diff >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                                {diff >= 0 ? `+${diff}` : diff}
                              </span>
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-indigo-300 font-semibold">
                            {hist.changed_by}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="bg-slate-950 border-t-2 border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
                  <span className="text-xs text-slate-400 font-medium">
                    Showing <span className="text-white font-bold">{histStartIndex + 1}</span> to{" "}
                    <span className="text-white font-bold">{histEndIndex}</span> of{" "}
                    <span className="text-white font-bold">{filteredHistory.length}</span> audit logs
                  </span>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 font-medium">Per page:</span>
                    <select
                      value={histItemsPerPage}
                      onChange={(e) => setHistItemsPerPage(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentHistPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentHistPage === 1}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-400 font-mono px-2">
                    Page {currentHistPage} of {totalHistPages}
                  </span>
                  <button
                    onClick={() => setCurrentHistPage((prev) => Math.min(prev + 1, totalHistPages))}
                    disabled={currentHistPage === totalHistPages}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* CREATE PRODUCT MODAL */}
      {isCreatingProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleCreateProductSubmit} className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 rounded-full">
                  Catalog Creator
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-1">Create New Product Item</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingProduct(false)}
                className="text-slate-400 hover:text-white p-2 rounded-2xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Style Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 030767641673"
                  value={newProductForm.style_code}
                  onChange={(e) => setNewProductForm({ ...newProductForm, style_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  SKU <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 764167"
                  value={newProductForm.sku}
                  onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Style Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3076 COMBO2 BRF1SO"
                  value={newProductForm.style_name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, style_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea
                  rows={2}
                  placeholder="Product specification details..."
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white resize-none focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                <select
                  value={newProductForm.category}
                  onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select Category...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
                <select
                  value={newProductForm.department}
                  onChange={(e) => setNewProductForm({ ...newProductForm, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select Department...</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</label>
                <select
                  value={newProductForm.color}
                  onChange={(e) => setNewProductForm({ ...newProductForm, color: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select Color...</option>
                  {availableColors.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Size</label>
                <select
                  value={newProductForm.size}
                  onChange={(e) => setNewProductForm({ ...newProductForm, size: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select Size...</option>
                  {availableSizes.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Price (₱) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={newProductForm.price}
                  onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row justify-end gap-2 border-t-2 border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreatingProduct(false)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingLoading}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {isCreatingLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                <span>Save Product</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleSaveProductEdit} className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-0.5 rounded-full">
                  Catalog Editor
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-1">Edit Product Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white p-2 rounded-2xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Style Code</label>
                <input
                  type="text"
                  required
                  value={editingProduct.style_code}
                  onChange={(e) => setEditingProduct({ ...editingProduct, style_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</label>
                <input
                  type="text"
                  required
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Style Name</label>
                <input
                  type="text"
                  required
                  value={editingProduct.style_name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, style_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={editingProduct.description || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white resize-none focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                <select
                  value={editingProduct.category || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-indigo-500 focus:outline-none"
                >
                  <option value="-">Select Category...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
                <select
                  value={editingProduct.department || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-indigo-500 focus:outline-none"
                >
                  <option value="-">Select Department...</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</label>
                <select
                  value={editingProduct.color || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, color: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-indigo-500 focus:outline-none"
                >
                  <option value="-">Select Color...</option>
                  {availableColors.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Size</label>
                <select
                  value={editingProduct.size || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, size: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white cursor-pointer focus:border-indigo-500 focus:outline-none"
                >
                  <option value="-">Select Size...</option>
                  {availableSizes.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Price (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row justify-end gap-2 border-t-2 border-slate-800">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleSaveStockEdit} className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-0.5 rounded-full">
                  Stock Adjuster
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-1">Update Live On-Hand Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStockItem(null)}
                className="text-slate-400 hover:text-white p-2 rounded-2xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-inner">
              <div className="flex justify-between">
                <span className="text-slate-500">Store Outlet:</span>
                <span className="text-emerald-400 font-bold">{editingStockItem.store}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Product Name:</span>
                <span className="text-white font-bold truncate max-w-[200px]">{editingStockItem.style_name}</span>
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
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-lg text-emerald-400 font-mono font-black focus:outline-none focus:border-amber-500 transition text-center shadow-inner"
              />
            </div>

            <div className="pt-3 flex flex-col sm:flex-row justify-end gap-2 border-t-2 border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStockItem(null)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
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