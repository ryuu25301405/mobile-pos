"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Boxes,
  Store,
  Search,
  PlusCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ScanBarcode,
  BarChart3,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

interface StoreInventoryItem {
  id: string;
  store: string;
  style_code: string;
  sku: string | null;
  initial_stock: number;
  current_stock: number;
  safety_stock: number;
  last_replenished_at: string;
  total_out: number; // Scanned quantity sold out
}

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
  const [restockStyleCode, setRestockStyleCode] = useState<string>("");
  const [restockSku, setRestockSku] = useState<string>("");
  const [restockStore, setRestockStore] = useState<string>(STORES[1]);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockSubmitting, setRestockSubmitting] = useState<boolean>(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Fetch Store Inventory (Current balances)
      let invQuery = supabase
        .from("store_inventory")
        .select("*")
        .order("current_stock", { ascending: true });

      if (selectedStore !== "All Stores") {
        invQuery = invQuery.eq("store", selectedStore);
      }

      // 2. Fetch Scanned Logs (Total sales / units out)
      let salesQuery = supabase
        .from("scanned_logs")
        .select("store, style_code, sku, quantity");

      if (selectedStore !== "All Stores") {
        salesQuery = salesQuery.eq("store", selectedStore);
      }

      const [invRes, salesRes] = await Promise.all([invQuery, salesQuery]);

      if (invRes.error) throw invRes.error;
      if (salesRes.error) throw salesRes.error;

      const rawInventory = invRes.data || [];
      const salesLogs = salesRes.data || [];

      // Build quick map for aggregate total out per (store, code)
      const salesOutMap = new Map<string, number>();

      salesLogs.forEach((log) => {
        const qty = Number(log.quantity) || 1;
        const store = log.store || "Unassigned Store";
        const style = log.style_code ? log.style_code.trim().toLowerCase() : null;
        const sku = log.sku ? log.sku.trim().toLowerCase() : null;

        if (style) {
          const key = `${store}:::${style}`;
          salesOutMap.set(key, (salesOutMap.get(key) || 0) + qty);
        }
        if (sku) {
          const key = `${store}:::${sku}`;
          salesOutMap.set(key, (salesOutMap.get(key) || 0) + qty);
        }
      });

      // Merge Total Out into each Inventory Item
      const enriched: StoreInventoryItem[] = rawInventory.map((row: any) => {
        const styleKey = row.style_code
          ? `${row.store}:::${row.style_code.trim().toLowerCase()}`
          : null;
        const skuKey = row.sku ? `${row.store}:::${row.sku.trim().toLowerCase()}` : null;

        // Take the matched out count
        const totalOut =
          (styleKey ? salesOutMap.get(styleKey) : undefined) ??
          (skuKey ? salesOutMap.get(skuKey) : undefined) ??
          0;

        return {
          id: row.id,
          store: row.store,
          style_code: row.style_code || "-",
          sku: row.sku || null,
          initial_stock: row.initial_stock ?? 0,
          current_stock: row.current_stock ?? 0,
          safety_stock: row.safety_stock ?? 5,
          last_replenished_at: row.last_replenished_at,
          total_out: totalOut,
        };
      });

      setItems(enriched);
    } catch (err) {
      console.error("Error fetching inventory & sales out:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  // Effect 1: HTTP fetch on store filter changes
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Effect 2: Realtime WebSocket (Mounted ONCE with explicit removeChannel teardown)
  useEffect(() => {
    const channel = supabase
      .channel("store_inventory_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_inventory" },
        () => fetchInventory()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scanned_logs" },
        () => fetchInventory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInventory]);

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const styleCode = restockStyleCode.trim();
    if (!styleCode || restockQty <= 0) return;

    setRestockSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from("store_inventory")
        .select("id, current_stock, initial_stock")
        .eq("store", restockStore)
        .eq("style_code", styleCode)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("store_inventory")
          .update({
            initial_stock: existing.initial_stock + restockQty,
            current_stock: existing.current_stock + restockQty,
            sku: restockSku.trim() || undefined,
            last_replenished_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("store_inventory").insert([
          {
            store: restockStore,
            style_code: styleCode,
            sku: restockSku.trim() || null,
            initial_stock: restockQty,
            current_stock: restockQty,
            safety_stock: 5,
          },
        ]);
      }

      await supabase.from("inventory_movements").insert([
        {
          store: restockStore,
          sku: styleCode,
          type: "DELIVERY",
          quantity: restockQty,
        },
      ]);

      setIsRestockOpen(false);
      setRestockStyleCode("");
      setRestockSku("");
      fetchInventory();
    } catch (err) {
      alert("Failed to save incoming delivery.");
    } finally {
      setRestockSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.style_code?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
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
    const totalIn = items.reduce((acc, curr) => acc + curr.initial_stock, 0);
    const totalOut = items.reduce((acc, curr) => acc + curr.total_out, 0);
    const totalAvailable = items.reduce((acc, curr) => acc + curr.current_stock, 0);
    const lowStockCount = items.filter(
      (i) => i.current_stock > 0 && i.current_stock <= i.safety_stock
    ).length;
    const outOfStockCount = items.filter((i) => i.current_stock <= 0).length;

    return { totalIn, totalOut, totalAvailable, lowStockCount, outOfStockCount };
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
            <h1 className="text-2xl font-bold tracking-tight text-white">Store Inventory Monitoring</h1>
            <p className="text-xs text-slate-400">
              Track Inflow (Delivered), Outflow (Scanned Out), and Current Stock per branch
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

      {/* KPI Cards: Total In, Total Out, Available, and Warnings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Out */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-400">Total Scanned Out</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.totalOut.toLocaleString()} <span className="text-xs text-rose-400 font-semibold">sold</span></h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Current Available */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Available Balance</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.totalAvailable.toLocaleString()} <span className="text-xs text-emerald-400 font-semibold">units</span></h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Low Stock Alerts Filter */}
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

        {/* Out of Stock Filter */}
        <div
          onClick={() => setFilterStockStatus(filterStockStatus === "OUT" ? "ALL" : "OUT")}
          className={`bg-slate-900/60 border rounded-xl p-4 flex items-center justify-between cursor-pointer transition ${
            filterStockStatus === "OUT" ? "border-rose-500 bg-rose-500/10" : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Depleted Items</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.outOfStockCount} items</h3>
          </div>
          <div className="p-3 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl">
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
            placeholder="Search Style Code, SKU, Store..."
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
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
            title="Refresh Stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table: Includes Delivered, Total Out, and Balance */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Store Location</th>
                <th className="px-4 py-3">Style Code</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Delivered / In</th>
                <th className="px-4 py-3 text-right text-rose-400">Total Out (Sold)</th>
                <th className="px-4 py-3 text-right text-emerald-400">Available Stock</th>
                <th className="px-4 py-3 text-right">Safety Level</th>
                <th className="px-4 py-3 text-right">Last Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Loading inventory and sales out counts...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
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
                        {item.style_code}
                      </td>
                      <td className="px-4 py-3 text-blue-400 font-mono whitespace-nowrap">
                        {item.sku || "-"}
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
                      
                      {/* Delivered / In */}
                      <td className="px-4 py-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        {item.initial_stock}
                      </td>

                      {/* Total Out (Scanned) */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                        {item.total_out > 0 ? `-${item.total_out}` : "0"}
                      </td>

                      {/* Available Balance */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`font-bold font-mono text-sm ${
                            isOut
                              ? "text-rose-400"
                              : isLow
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {item.current_stock}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right text-slate-400 font-mono">
                        {item.safety_stock}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {item.last_replenished_at
                          ? new Date(item.last_replenished_at).toLocaleDateString("en-PH")
                          : "N/A"}
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
              <h3 className="font-bold text-white text-sm">Receive Delivery / Initialize Stock</h3>
              <button
                onClick={() => setIsRestockOpen(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStockIn} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Store / Branch</label>
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
                <label className="text-slate-400 block mb-1">Style Code (Primary Identifier)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HUGA SL BRIEF 2XL ASTD"
                  value={restockStyleCode}
                  onChange={(e) => setRestockStyleCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">SKU (Optional / Barcode)</label>
                <input
                  type="text"
                  placeholder="e.g. 3076566299"
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
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {restockSubmitting ? "Saving..." : "Confirm Intake"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}