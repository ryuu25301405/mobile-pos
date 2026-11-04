'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Boxes, ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

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

interface ReconciliationItem {
  id: string;
  store: string;
  styleCode: string;
  sku: string;
  styleName: string;
  category: string;
  color: string;
  size: string;
  liveStock: number;
  auditScannedQty: number;
  variance: number;
  status: "matched" | "shortage" | "overage";
}

const normalizeKey = (store: string, code: string) => `${store.trim().toLowerCase()}|${code.trim().toLowerCase()}`;

export default function AuditReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState("Landmark Trinoma");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "variance">("all");
  const [items, setItems] = useState<ReconciliationItem[]>([]);

  const fetchReconciliationData = useCallback(async () => {
    setLoading(true);

    // 1. Fetch live inventory for the selected store
    let invQuery = supabase.from("store_inventory").select("*");
    if (selectedStore !== "All Stores") {
      invQuery = invQuery.eq("store", selectedStore);
    }
    const { data: invData, error: invError } = await invQuery;

    // 2. Fetch audit logs (transaction_mode = 'audit') for the selected store
    let auditQuery = supabase
      .from("scanned_logs")
      .select("*")
      .eq("transaction_mode", "audit");
      
    if (selectedStore !== "All Stores") {
      auditQuery = auditQuery.eq("store", selectedStore);
    }
    const { data: auditData, error: auditError } = await auditQuery;

    if (invError || auditError) {
      console.error("Error fetching reconciliation data:", invError || auditError);
      setLoading(false);
      return;
    }

    // Build a map of all store inventory items
    const inventoryMap = new Map<string, any>();
    (invData || []).forEach((inv: any) => {
      const store = inv.store ? inv.store.trim() : "Unassigned Store";
      const styleCode = inv.style_code ? String(inv.style_code).trim() : "N/A";
      const key = normalizeKey(store, styleCode);
      inventoryMap.set(key, inv);
    });

    // Build a map of all audit scan quantities from ScanView
    const auditMap = new Map<string, { qty: number; record: any }>();
    (auditData || []).forEach((log: any) => {
      const store = log.store ? log.store.trim() : "Unassigned Store";
      const styleCode = log.style_code ? String(log.style_code).trim() : "N/A";
      const key = normalizeKey(store, styleCode);
      const current = auditMap.get(key) || { qty: 0, record: log };
      auditMap.set(key, {
        qty: current.qty + (Number(log.quantity) || 1),
        record: log,
      });
    });

    // Combine both sets of keys so NO item is left behind (even if it's only in inventory or only in audit logs)
    const allKeys = new Set([...inventoryMap.keys(), ...auditMap.keys()]);
    const reconciliationMap: ReconciliationItem[] = [];

    allKeys.forEach((key) => {
      const inv = inventoryMap.get(key);
      const audit = auditMap.get(key);

      const store = inv?.store || audit?.record?.store || selectedStore;
      const styleCode = inv?.style_code || audit?.record?.style_code || "N/A";
      const sku = inv?.sku || audit?.record?.sku || "-";
      const styleName = inv?.style_name || audit?.record?.style_name || styleCode;
      const category = inv?.category || audit?.record?.category || "-";
      const color = inv?.color || audit?.record?.color || "-";
      const size = inv?.size || audit?.record?.size || "-";

      const liveStock = Number(inv?.current_stock ?? inv?.quantity) || 0;
      const auditScannedQty = audit ? audit.qty : 0;
      const variance = auditScannedQty - liveStock;

      let status: "matched" | "shortage" | "overage" = "matched";
      if (variance < 0) status = "shortage";
      else if (variance > 0) status = "overage";

      reconciliationMap.push({
        id: inv?.id || audit?.record?.id || `${styleCode}-${Math.random()}`,
        store,
        styleCode,
        sku,
        styleName,
        category,
        color,
        size,
        liveStock,
        auditScannedQty,
        variance,
        status,
      });
    });

    setItems(reconciliationMap);
    setLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    fetchReconciliationData();
  }, [fetchReconciliationData]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        item.styleCode.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.styleName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === "matched" && item.status !== "matched") return false;
      if (statusFilter === "variance" && item.status === "matched") return false;

      return true;
    });
  }, [items, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const totalItems = items.length;
    const matchedCount = items.filter(i => i.status === "matched").length;
    const shortageCount = items.filter(i => i.status === "shortage").length;
    const overageCount = items.filter(i => i.status === "overage").length;
    return { totalItems, matchedCount, shortageCount, overageCount };
  }, [items]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-[1600px] mx-auto antialiased space-y-5">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              href="/scanview"
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center space-x-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to ScanView</span>
            </Link>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
              Audit Control
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            Store Inventory vs. ScanView Audit Reconciliation
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchReconciliationData}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 transition border border-slate-800 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Reconciliation</span>
          </button>
        </div>
      </header>

      {/* KPI Summary Cards */}
      <section className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tracked Items</p>
            <p className="text-2xl font-black text-white mt-0.5">{metrics.totalItems}</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Boxes className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fully Tally / Matched</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{metrics.matchedCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shortages (Missing)</p>
            <p className="text-2xl font-black text-rose-400 mt-0.5">{metrics.shortageCount}</p>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <XCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overages (Excess)</p>
            <p className="text-2xl font-black text-amber-400 mt-0.5">{metrics.overageCount}</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* Control Filters Bar */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3 grid grid-cols-12 gap-3 items-center sticky top-2 z-40 shadow-xl backdrop-blur-md">
        <div className="col-span-5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search style code, SKU, product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="col-span-4 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center">
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

        <div className="col-span-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">Filter: All Statuses</option>
            <option value="matched">Matched Tally Only</option>
            <option value="variance">Discrepancies / Variances</option>
          </select>
        </div>
      </section>

      {/* Main Reconciliation Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Comparing store inventory with ScanView audit logs...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-bold text-white">No inventory items found for this store or filter.</p>
            <p className="text-xs text-slate-500">Ensure audit mode scans have been submitted for this location in ScanView.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Store Location</th>
                  <th className="py-3 px-4">Style Code / SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Live Store Inventory Qty</th>
                  <th className="py-3 px-4 text-center">ScanView Audit Qty</th>
                  <th className="py-3 px-4 text-center">Variance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/40 transition ${index % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/90"}`}
                  >
                    <td className="py-3 px-4 font-semibold text-emerald-400">
                      {item.store}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-200">{item.styleCode}</div>
                      <div className="font-mono text-[10px] text-blue-400">{item.sku}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-xs truncate">
                      {item.styleName}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.category}
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-slate-300">
                      <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                        {item.liveStock} pcs
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-indigo-400">
                      <span className="bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                        {item.auditScannedQty} pcs
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-center font-mono font-black ${
                      item.variance === 0 ? "text-emerald-400" : item.variance > 0 ? "text-amber-400" : "text-rose-400"
                    }`}>
                      {item.variance > 0 ? `+${item.variance}` : item.variance} pcs
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.status === "matched" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Matched ({item.liveStock} = {item.auditScannedQty})
                        </span>
                      )}
                      {item.status === "shortage" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <XCircle className="h-3.5 w-3.5" /> Shortage
                        </span>
                      )}
                      {item.status === "overage" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <AlertTriangle className="h-3.5 w-3.5" /> Overage
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}