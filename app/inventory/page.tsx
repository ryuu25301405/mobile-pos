"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
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
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
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
  total_out: number;
}

interface BulkImportItem {
  store: string;
  style_code: string;
  sku: string;
  quantity: number;
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Single Restock Modal
  const [isRestockOpen, setIsRestockOpen] = useState<boolean>(false);
  const [restockStyleCode, setRestockStyleCode] = useState<string>("");
  const [restockSku, setRestockSku] = useState<string>("");
  const [restockStore, setRestockStore] = useState<string>(STORES[1]);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockSubmitting, setRestockSubmitting] = useState<boolean>(false);

  // Bulk Import Modal State
  const [isBulkOpen, setIsBulkOpen] = useState<boolean>(false);
  const [bulkDefaultStore, setBulkDefaultStore] = useState<string>(STORES[1]);
  const [bulkPreview, setBulkPreview] = useState<BulkImportItem[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStore, searchQuery, filterStockStatus, pageSize]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("store_inventory")
        .select("*")
        .order("current_stock", { ascending: true });

      if (selectedStore !== "All Stores") {
        query = query.eq("store", selectedStore);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const enriched: StoreInventoryItem[] = data.map((row: any) => {
          const initial = Number(row.initial_stock) || 0;
          const current = Number(row.current_stock) || 0;
          const calculatedOut = Math.max(0, initial - current);

          return {
            id: row.id,
            store: row.store,
            style_code: row.style_code || "-",
            sku: row.sku || null,
            initial_stock: initial,
            current_stock: current,
            safety_stock: row.safety_stock ?? 5,
            last_replenished_at: row.last_replenished_at,
            total_out: calculatedOut,
          };
        });

        setItems(enriched);
      }
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Realtime subscription with cleanup
  useEffect(() => {
    const channel = supabase
      .channel("store_inventory_feed")
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

  // Single Item Restock
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

  // Bulk File Upload Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      const parsed: BulkImportItem[] = data
        .map((row) => {
          const store =
            row["Store"] || row["store"] || row["Store Location"] || bulkDefaultStore;
          const style =
            row["Style Code"] ||
            row["style_code"] ||
            row["Style"] ||
            row["style"] ||
            "";
          const sku =
            row["SKU"] || row["sku"] || row["Barcode"] || row["barcode"] || "";
          const qty = Number(
            row["Quantity"] || row["quantity"] || row["Qty"] || row["qty"] || 0
          );

          return {
            store: String(store).trim(),
            style_code: String(style).trim(),
            sku: String(sku).trim(),
            quantity: Math.max(0, qty),
          };
        })
        .filter((item) => item.quantity > 0 && (item.style_code || item.sku));

      setBulkPreview(parsed);
    };

    reader.readAsBinaryString(file);
  };

  // Process Bulk Upsert via Supabase Stored Procedure
  const handleConfirmBulkDelivery = async () => {
    if (bulkPreview.length === 0) return;
    setBulkSubmitting(true);

    try {
      const { error } = await supabase.rpc("bulk_receive_delivery", {
        p_items: bulkPreview,
      });

      if (error) {
        throw error;
      }

      alert(`Successfully processed ${bulkPreview.length} delivery items!`);
      setIsBulkOpen(false);
      setBulkPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchInventory();
    } catch (err: any) {
      alert(`Bulk intake failed: ${err.message || "Unknown error"}`);
    } finally {
      setBulkSubmitting(false);
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

  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, startIndex, pageSize]);

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
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-indigo-600/10"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Bulk Delivery (Excel)</span>
          </button>

          <button
            onClick={() => setIsRestockOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-emerald-600/10"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Single Item</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-400">Total Scanned Out</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {stats.totalOut.toLocaleString()} <span className="text-xs text-rose-400 font-semibold">sold</span>
            </h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Available Balance</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {stats.totalAvailable.toLocaleString()} <span className="text-xs text-emerald-400 font-semibold">units</span>
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
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

      {/* Table Section with High-Visibility Header Division and Pagination */}
      <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 border-y-2 border-slate-700 text-slate-200 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3.5 border-r border-slate-700/80">
                  Store Location
                </th>
                <th className="px-4 py-3.5 border-r border-slate-700/80">
                  Style Code
                </th>
                <th className="px-4 py-3.5 border-r border-slate-700/80">
                  SKU
                </th>
                <th className="px-4 py-3.5 border-r border-slate-700/80 text-center">
                  Status
                </th>
                <th className="px-4 py-3.5 border-r border-slate-700/80 text-right bg-slate-800/30">
                  Delivered / In
                </th>
                <th className="px-4 py-3.5 border-r border-slate-700/80 text-right text-rose-400 bg-rose-950/20">
                  Total Out (Sold)
                </th>
                <th className="px-4 py-3.5 border-r border-slate-700/80 text-right text-emerald-400 bg-emerald-950/20">
                  Available Stock
                </th>
                <th className="px-4 py-3.5 border-r border-slate-700/80 text-right">
                  Safety Level
                </th>
                <th className="px-4 py-3.5 text-right">
                  Last Received
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    Loading inventory data...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isOut = item.current_stock <= 0;
                  const isLow = item.current_stock > 0 && item.current_stock <= item.safety_stock;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors divide-x divide-slate-800/50"
                    >
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
                          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200 whitespace-nowrap bg-slate-900/20">
                        {item.initial_stock}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap bg-rose-950/10">
                        {item.total_out > 0 ? `-${item.total_out}` : "0"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap bg-emerald-950/10">
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
                      <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap font-mono text-[11px]">
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

        {/* Pagination Controls */}
        <div className="p-4 border-t-2 border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-200">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{" "}
              <strong className="text-slate-200">{Math.min(startIndex + pageSize, totalItems)}</strong> of{" "}
              <strong className="text-slate-200">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-1.5">
              <span>| Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg text-slate-200 px-2 py-1 focus:outline-none cursor-pointer font-medium"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-200"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-slate-800 text-slate-200 rounded-lg border border-slate-700 font-medium">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-200"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: Bulk Delivery Excel Intake */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-2xl w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Bulk Delivery Intake (Spreadsheet)</h3>
              </div>
              <button
                onClick={() => {
                  setIsBulkOpen(false);
                  setBulkPreview([]);
                }}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-400 space-y-1">
                <p className="font-semibold text-slate-200">Supported Columns in Excel / CSV:</p>
                <p>
                  • <code className="text-indigo-300">Style Code</code> (or Style) • <code className="text-indigo-300">SKU</code> (or Barcode) • <code className="text-indigo-300">Quantity</code> • <code className="text-indigo-300">Store</code> (optional)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-slate-400 block mb-1">Default Store (Used if column missing in file)</label>
                  <select
                    value={bulkDefaultStore}
                    onChange={(e) => setBulkDefaultStore(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                  >
                    {STORES.filter((s) => s !== "All Stores").map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-slate-400 block mb-1">Select Excel / CSV File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-300 text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Parsed Preview Table */}
              {bulkPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span>Preview: {bulkPreview.length} items ready to update</span>
                    <span className="text-emerald-400 font-bold">
                      +{bulkPreview.reduce((acc, curr) => acc + curr.quantity, 0)} total units
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-2">Store</th>
                          <th className="p-2">Style Code</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2 text-right">Qty Received</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {bulkPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-2 truncate max-w-[120px]">{item.store}</td>
                            <td className="p-2 font-mono text-white">{item.style_code || "-"}</td>
                            <td className="p-2 font-mono text-blue-400">{item.sku || "-"}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">+{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsBulkOpen(false);
                  setBulkPreview([]);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkPreview.length === 0 || bulkSubmitting}
                onClick={handleConfirmBulkDelivery}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer text-xs flex items-center gap-1.5"
              >
                {bulkSubmitting ? (
                  <span>Updating Inventory...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Intake ({bulkPreview.length} Items)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Single Restock Delivery Modal */}
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