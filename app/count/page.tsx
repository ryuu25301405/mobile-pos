"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { logUserActivity } from "@/lib/logger";
import {
  ScanBarcode,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Search,
  Building2,
  ClipboardList,
  Save,
  Check,
  ArrowLeft,
  Package
} from "lucide-react";

export const dynamic = "force-dynamic";

interface InventoryItem {
  id: string;
  store: string;
  style_code: string;
  sku: string | null;
  style_name?: string;
  color?: string;
  size?: string;
  department?: string;
  category?: string;
  current_stock: number;
  counted_stock?: number;
  price?: number;
}

export default function PhysicalCountPage() {
  const [stores, setStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastScannedItem, setLastScannedItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("store_inventory").select("*");
    if (!error && data) {
      const parsed: InventoryItem[] = data.map((item: any) => ({
        ...item,
        store: item.store ? item.store.trim() : "Unassigned Store",
        current_stock: Number(item.current_stock) || 0,
        counted_stock: item.counted_stock !== undefined ? item.counted_stock : (Number(item.current_stock) || 0),
      }));

      setInventoryList(parsed);
      const uniqueStores = Array.from(new Set(parsed.map((i) => i.store))).sort();
      setStores(uniqueStores);
      if (uniqueStores.length > 0 && !selectedStore) {
        setSelectedStore(uniqueStores[0]);
      }
    }
    setLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const storeItems = useMemo(() => {
    return inventoryList.filter((item) => {
      const matchStore = !selectedStore || item.store === selectedStore;
      const matchSearch =
        !searchQuery.trim() ||
        [item.style_code, item.style_name, item.sku, item.color, item.size]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim());
      return matchStore && matchSearch;
    });
  }, [inventoryList, selectedStore, searchQuery]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const code = scanInput.trim().toLowerCase();
    const foundIndex = inventoryList.findIndex(
      (item) =>
        item.store === selectedStore &&
        (item.style_code.toLowerCase() === code ||
          (item.sku && item.sku.toLowerCase() === code) ||
          (item.style_name && item.style_name.toLowerCase() === code))
    );

    if (foundIndex !== -1) {
      const updated = [...inventoryList];
      const currentCount = updated[foundIndex].counted_stock ?? updated[foundIndex].current_stock;
      updated[foundIndex] = {
        ...updated[foundIndex],
        counted_stock: currentCount + 1,
      };
      setInventoryList(updated);
      setLastScannedItem(updated[foundIndex]);
      logUserActivity("PHYSICAL_COUNT_SCAN", `Scanned item ${updated[foundIndex].style_code} at ${selectedStore}`);
    } else {
      alert(`Item "${scanInput}" not found in inventory for store: ${selectedStore}`);
    }

    setScanInput("");
    if (inputRef.current) inputRef.current.focus();
  };

  const updateCount = (id: string, newCount: number) => {
    setInventoryList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, counted_stock: Math.max(0, newCount) } : item))
    );
  };

  // Commit session logs to physical_count_logs table instead of mutating store_inventory directly
  const handleCommitCount = async () => {
    if (!confirm(`Are you sure you want to submit the physical stocktake logs for ${selectedStore}?`)) {
      return;
    }

    setSaving(true);
    try {
      const logEntries = storeItems.map((item) => ({
        store: selectedStore,
        style_code: item.style_code,
        sku: item.sku || "-",
        system_stock: item.current_stock,
        counted_stock: item.counted_stock ?? item.current_stock,
        status: "PENDING"
      }));

      const { error } = await supabase.from("physical_count_logs").insert(logEntries);

      if (error) throw error;

      await logUserActivity("PHYSICAL_COUNT_SUBMIT", `Submitted stocktake audit session for ${selectedStore}. Total items: ${storeItems.length}`);
      setSuccessMessage(`Successfully submitted physical count session for ${selectedStore} into audit logs!`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error("Failed to commit physical count logs", err);
      alert("Error submitting stocktake logs to database.");
    } finally {
      setSaving(false);
    }
  };

  const totalSystemStock = storeItems.reduce((acc, curr) => acc + curr.current_stock, 0);
  const totalCountedStock = storeItems.reduce((acc, curr) => acc + (curr.counted_stock ?? curr.current_stock), 0);
  const varianceCount = totalCountedStock - totalSystemStock;

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 p-4 sm:p-6 space-y-6 font-sans select-none">
      
      {/* HEADER NAV */}
      <nav className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <Link href="/analytics/qlik" className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-white uppercase">Store Physical Stocktake & Inventory Count</span>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                Audit Logging Mode
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Scan items to log physical counts and submit audit session securely</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-bold"
            >
              {stores.map((st) => (
                <option key={st} value={st} className="bg-slate-900">{st}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCommitCount}
            disabled={saving || storeItems.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Submitting..." : "Submit Audit Session"}</span>
          </button>
        </div>
      </nav>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Expected Stock</p>
            <h3 className="text-2xl font-black text-white mt-1">{totalSystemStock.toLocaleString()} pcs</h3>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl"><Boxes className="w-5 h-5" /></div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Physical Counted Stock</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">{totalCountedStock.toLocaleString()} pcs</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl"><CheckCircle2 className="w-5 h-5" /></div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock Variance</p>
            <h3 className={`text-2xl font-black mt-1 ${varianceCount === 0 ? 'text-emerald-400' : varianceCount > 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
              {varianceCount > 0 ? `+${varianceCount}` : varianceCount} pcs
            </h3>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl"><AlertTriangle className="w-5 h-5" /></div>
        </div>
      </div>

      {/* BARCODE SCANNER INPUT BAR */}
      <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-3">
        <form onSubmit={handleScanSubmit} className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <ScanBarcode className="w-6 h-6 animate-pulse" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Click here and scan barcode, SKU, or style code to increment count..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 text-sm px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner font-mono"
            autoFocus
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs transition cursor-pointer"
          >
            Scan / Add
          </button>
        </form>

        {lastScannedItem && (
          <div className="bg-slate-950 border border-emerald-500/30 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-mono animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-white font-bold">Last Scanned:</span>
              <span className="text-emerald-300">{lastScannedItem.style_name || lastScannedItem.style_code} ({lastScannedItem.color} / {lastScannedItem.size})</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black">
              Counted: {lastScannedItem.counted_stock} pcs
            </span>
          </div>
        )}
      </div>

      {/* INVENTORY COUNT TABLE WORKSPACE */}
      <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">Store Inventory Count Sheet ({storeItems.length} items)</span>
          </div>

          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items in count list..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-xs pl-9 pr-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1 [scrollbar-width:thin]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md">
              <tr>
                <th className="px-5 py-3.5 border-r border-slate-800">Style Code & Name</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Variant (Color / Size)</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">System Stock</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">Physical Count</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">Variance</th>
                <th className="px-4 py-3.5 text-right">Quick Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-3 bg-slate-800 rounded w-32"></div></td>
                    <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-24"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-6 bg-slate-800 rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : storeItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-slate-500 italic">No inventory records found for {selectedStore}.</td>
                </tr>
              ) : (
                storeItems.map((item) => {
                  const counted = item.counted_stock ?? item.current_stock;
                  const variance = counted - item.current_stock;
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="px-5 py-3.5 border-r border-slate-900/50">
                        <span className="font-bold text-white block text-sm font-sans">{item.style_name || item.style_code}</span>
                        <span className="text-[11px] text-slate-400 font-mono">Code: {item.style_code} {item.sku && `• SKU: ${item.sku}`}</span>
                      </td>
                      <td className="px-4 py-3.5 border-r border-slate-900/50 text-slate-300 font-sans">
                        {item.color} / <strong className="text-white">{item.size}</strong>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-indigo-300 border-r border-slate-900/50 text-sm">
                        {item.current_stock} pcs
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-400 border-r border-slate-900/50 text-sm">
                        {counted} pcs
                      </td>
                      <td className={`px-4 py-3.5 text-right font-bold border-r border-slate-900/50 text-sm ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </td>
                      <td className="px-4 py-3.5 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => updateCount(item.id, counted - 1)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center justify-center cursor-pointer transition"
                          title="Decrease Count"
                        >
                          -
                        </button>
                        <button
                          onClick={() => updateCount(item.id, counted + 1)}
                          className="w-7 h-7 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg font-bold flex items-center justify-center cursor-pointer transition"
                          title="Increase Count"
                        >
                          +
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}