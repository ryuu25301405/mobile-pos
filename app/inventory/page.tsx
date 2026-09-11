"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  Boxes,
  Store,
  Search,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowUpDown,
  Building2,
  ScanBarcode,
  BarChart3,
} from "lucide-react";

interface StoreInventoryItem {
  id: string;
  store: string;
  sku: string;
  initial_stock: number;
  current_stock: number;
  safety_stock: number;
  last_replenished_at: string;
  style_code?: string;
  description?: string;
  category?: string;
  department?: string;
  price?: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export default function InventoryMonitoringPage() {
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStore, setSelectedStore] = useState<string>("All Stores");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStockStatus, setFilterStockStatus] = useState<"ALL" | "LOW" | "OUT">("ALL");

  // Restock Modal State
  const [isRestockOpen, setIsRestockOpen] = useState<boolean>(false);
  const [restockSku, setRestockSku] = useState<string>("");
  const [restockStore, setRestockStore] = useState<string>(STORES[1]);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockSubmitting, setRestockSubmitting] = useState<boolean>(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);

    let query = supabase.from("store_inventory").select(`
      *,
      inventory:sku (
        style_code,
        description,
        category,
        department,
        price
      )
    `);

    if (selectedStore !== "All Stores") {
      query = query.eq("store", selectedStore);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching store inventory:", error);
    } else if (data) {
      const flattened: StoreInventoryItem[] = data.map((row: any) => ({
        id: row.id,
        store: row.store,
        sku: row.sku,
        initial_stock: row.initial_stock,
        current_stock: row.current_stock,
        safety_stock: row.safety_stock ?? 5,
        last_replenished_at: row.last_replenished_at,
        style_code: row.inventory?.style_code || "-",
        description: row.inventory?.description || "Master item details pending",
        category: row.inventory?.category || "-",
        department: row.inventory?.department || "-",
        price: row.inventory?.price || 0,
      }));
      setItems(flattened);
    }
    setLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    fetchInventory();

    const channel = supabase
      .channel("store_inventory_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_inventory" },
        () => fetchInventory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInventory]);

  // Handle Receiving Stock (+ Stock In)
  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockSku.trim() || restockQty <= 0) return;

    setRestockSubmitting(true);
    try {
      // 1. Check if record exists
      const { data: existing } = await supabase
        .from("store_inventory")
        .select("id, current_stock, initial_stock")
        .eq("store", restockStore)
        .eq("sku", restockSku.trim())
        .maybeSingle();

      if (existing) {
        // Increment existing balance
        await supabase
          .from("store_inventory")
          .update({
            current_stock: existing.current_stock + restockQty,
            last_replenished_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Create initial store stock balance
        await supabase.from("store_inventory").insert([
          {
            store: restockStore,
            sku: restockSku.trim(),
            initial_stock: restockQty,
            current_stock: restockQty,
            safety_stock: 5,
          },
        ]);
      }

      // 2. Audit in ledger
      await supabase.from("inventory_movements").insert([
        {
          store: restockStore,
          sku: restockSku.trim(),
          type: "DELIVERY",
          quantity: restockQty,
        },
      ]);

      setIsRestockOpen(false);
      setRestockSku("");
      fetchInventory();
    } catch (err) {
      console.error("Restock failed:", err);
      alert("Failed to save incoming delivery.");
    } finally {
      setRestockSubmitting(false);
    }
  };

  // Filtered & Evaluated Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.sku.toLowerCase().includes(q) ||
        item.style_code?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.store.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterStockStatus === "LOW") {
        return item.current_stock > 0 && item.current_stock <= item.safety_stock;
      }
      if (filterStockStatus === "OUT") {
        return item.current_stock <= 0;
      }

      return true;
    });
  }, [items, searchQuery, filterStockStatus]);

  // Overall Inventory Stats
  const stats = useMemo(() => {
    const totalUnits = items.reduce((acc, curr) => acc + curr.current_stock, 0);
    const lowStockCount = items.filter(
      (i) => i.current_stock > 0 && i.current_stock <= i.safety_stock
    ).length;
    const outOfStockCount = items.filter((i) => i.current_stock <= 0).length;

    return { totalUnits, lowStockCount, outOfStockCount };
  }, [items]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Store Inventory Monitoring
            </h1>
            <p className="text-xs text-slate-400">
              Real-time branch stock levels, low-stock warnings, and delivery intake
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/scanview"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-2 rounded-lg text-xs font-semibold transition"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-indigo-400" />
            <span>Scanner</span>
          </Link>

          <Link
            href="/reports/daily-sales"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-2 rounded-lg text-xs font-semibold transition"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sales Report</span>
          </Link>

          <button
            onClick={() => setIsRestockOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Receive Delivery</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Current Stock Balance</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.totalUnits.toLocaleString()} units</h3>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setFilterStockStatus(filterStockStatus === "LOW" ? "ALL" : "LOW")}
          className={`bg-slate-900/60 border rounded-xl p-4 flex items-center justify-between cursor-pointer transition ${
            filterStockStatus === "LOW" ? "border-amber-500 bg-amber-500/10" : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-amber-400">Low Stock Alerts</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.lowStockCount} items</h3>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setFilterStockStatus(filterStockStatus === "OUT" ? "ALL" : "OUT")}
          className={`bg-slate-900/60 border rounded-xl p-4 flex items-center justify-between cursor-pointer transition ${
            filterStockStatus === "OUT" ? "border-rose-500 bg-rose-500/10" : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-400">Out of Stock</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.outOfStockCount} items</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SKU, Style, Description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              {STORES.map((s) => (
                <option key={s} value={s} className="bg-slate-900">{s}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchInventory}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300"
            title="Refresh Stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Store Location</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Style Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Available Stock</th>
                <th className="px-4 py-3 text-right">Safety Level</th>
                <th className="px-4 py-3 text-right">Last Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading store inventory data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isOut = item.current_stock <= 0;
                  const isLow = item.current_stock > 0 && item.current_stock <= item.safety_stock;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-300 whitespace-nowrap">
                        {item.store}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {item.style_code}
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-bold font-mono text-sm ${
                          isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 font-mono">
                        {item.safety_stock}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {new Date(item.last_replenished_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock In Delivery Modal */}
      {isRestockOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Receive Stock / New Delivery</h3>
              <button onClick={() => setIsRestockOpen(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleStockIn} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Destination Branch</label>
                <select
                  value={restockStore}
                  onChange={(e) => setRestockStore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                >
                  {STORES.filter((s) => s !== "All Stores").map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Product SKU / Barcode</label>
                <input
                  type="text"
                  required
                  placeholder="Scan or enter SKU..."
                  value={restockSku}
                  onChange={(e) => setRestockSku(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quantity Received</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="bg-emerald-500 text-slate-950 font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {restockSubmitting ? "Receiving..." : "Confirm Intake"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}