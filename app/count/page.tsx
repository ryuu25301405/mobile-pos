"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

interface PhysicalCountRecord {
  id: string;
  store: string;
  style_code: string;
  sku: string | null;
  style_name: string;
  color: string;
  size: string;
  description: string;
  price: number;
  system_stock: number;
  counted_stock: number;
  status: string;
  created_at?: string;
}

export default function PhysicalCountPage() {
  const [stores, setStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [countRecords, setCountRecords] = useState<PhysicalCountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastScannedItem, setLastScannedItem] = useState<PhysicalCountRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch count logs from physical_count_logs
  const fetchCountLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("physical_count_logs").select("*").order("created_at", { ascending: false });
    
    if (!error && data) {
      const parsed: PhysicalCountRecord[] = data.map((item: any) => ({
        id: String(item.id),
        store: item.store ? item.store.trim() : "Unassigned Store",
        style_code: item.style_code || "Unknown",
        sku: item.sku || "-",
        style_name: item.style_name || item.style_code || "Unassigned Name",
        color: item.color || "Default",
        size: item.size || "Free Size",
        description: item.description || "-",
        price: Number(item.price) || 0,
        system_stock: Number(item.system_stock) || 0,
        counted_stock: Number(item.counted_stock) || 0,
        status: item.status || "PENDING",
        created_at: item.created_at
      }));

      setCountRecords(parsed);
      const uniqueStores = Array.from(new Set(parsed.map((i) => i.store))).sort();
      setStores(uniqueStores);
      if (uniqueStores.length > 0 && !selectedStore) {
        setSelectedStore(uniqueStores[0]);
      }
    }
    setLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    fetchCountLogs();
  }, [fetchCountLogs]);

  // Filtered rows for the selected store
  const storeRecords = useMemo(() => {
    return countRecords.filter((item) => {
      const matchStore = !selectedStore || item.store === selectedStore;
      const matchSearch =
        !searchQuery.trim() ||
        [item.style_code, item.style_name, item.sku, item.color, item.size, item.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim());
      return matchStore && matchSearch;
    });
  }, [countRecords, selectedStore, searchQuery]);

  // Handle Barcode Scan / Enter
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const code = scanInput.trim().toLowerCase();

    const existingRecord = countRecords.find(
      (item) =>
        item.store === selectedStore &&
        (item.style_code.toLowerCase() === code || 
         (item.sku && item.sku.toLowerCase() === code) ||
         (item.style_name && item.style_name.toLowerCase() === code))
    );

    if (existingRecord) {
      const newCount = existingRecord.counted_stock + 1;
      const { error } = await supabase
        .from("physical_count_logs")
        .update({ counted_stock: newCount })
        .eq("id", existingRecord.id);

      if (!error) {
        setCountRecords((prev) =>
          prev.map((r) => (r.id === existingRecord.id ? { ...r, counted_stock: newCount } : r))
        );
        setLastScannedItem({ ...existingRecord, counted_stock: newCount });
        logUserActivity("PHYSICAL_COUNT_SCAN", `Incremented count for ${existingRecord.style_code} at ${selectedStore}`);
      }
    } else {
      const { data: invData } = await supabase
        .from("store_inventory")
        .select("*")
        .eq("store", selectedStore);

      const matchedInv = invData?.find(
        (inv: any) =>
          inv.style_code?.toLowerCase() === code || 
          inv.sku?.toLowerCase() === code ||
          inv.style_name?.toLowerCase() === code
      );

      if (matchedInv) {
        const newLogEntry = {
          store: selectedStore,
          style_code: matchedInv.style_code || code,
          sku: matchedInv.sku || "-",
          style_name: matchedInv.style_name || matchedInv.style_code || "Scanned Item",
          color: matchedInv.color || "Default",
          size: matchedInv.size || "Free Size",
          description: matchedInv.description || "-",
          price: Number(matchedInv.price) || 299.0,
          system_stock: Number(matchedInv.current_stock) || 0,
          counted_stock: 1,
          status: "PENDING"
        };

        const { data: inserted, error } = await supabase
          .from("physical_count_logs")
          .insert([newLogEntry])
          .select()
          .single();

        if (!error && inserted) {
          const formatted: PhysicalCountRecord = {
            id: String(inserted.id),
            store: inserted.store,
            style_code: inserted.style_code,
            sku: inserted.sku,
            style_name: inserted.style_name,
            color: inserted.color,
            size: inserted.size,
            description: inserted.description,
            price: Number(inserted.price),
            system_stock: Number(inserted.system_stock),
            counted_stock: Number(inserted.counted_stock),
            status: inserted.status,
            created_at: inserted.created_at
          };
          setCountRecords((prev) => [formatted, ...prev]);
          setLastScannedItem(formatted);
          if (stores.length === 0) setStores([selectedStore]);
          logUserActivity("PHYSICAL_COUNT_NEW_SCAN", `Added new scan log for ${formatted.style_code} at ${selectedStore}`);
        }
      } else {
        alert(`Item "${scanInput}" could not be matched in store inventory for ${selectedStore}.`);
      }
    }

    setScanInput("");
    if (inputRef.current) inputRef.current.focus();
  };

  const updateCount = async (id: string, newCount: number) => {
    const validCount = Math.max(0, newCount);
    const { error } = await supabase
      .from("physical_count_logs")
      .update({ counted_stock: validCount })
      .eq("id", id);

    if (!error) {
      setCountRecords((prev) =>
        prev.map((item) => (item.id === id ? { ...item, counted_stock: validCount } : item))
      );
    }
  };

  const handleCommitSession = async () => {
    if (!confirm(`Are you sure you want to finalize and lock the physical count session for ${selectedStore}?`)) {
      return;
    }

    setSaving(true);
    try {
      const updates = storeRecords.map((item) =>
        supabase
          .from("physical_count_logs")
          .update({ status: "APPROVED" })
          .eq("id", item.id)
      );

      await Promise.all(updates);
      await logUserActivity("PHYSICAL_COUNT_APPROVE", `Approved stocktake session for ${selectedStore}`);
      setSuccessMessage(`Successfully approved count session for ${selectedStore}!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchCountLogs();
    } catch (err) {
      console.error("Failed to approve count logs", err);
      alert("Error finalizing audit session.");
    } finally {
      setSaving(false);
    }
  };

  const totalSystemStock = storeRecords.reduce((acc, curr) => acc + curr.system_stock, 0);
  const totalCountedStock = storeRecords.reduce((acc, curr) => acc + curr.counted_stock, 0);
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
              <span className="text-sm font-black tracking-tight text-white uppercase">Physical Count Logs (`physical_count_logs`)</span>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                Detailed Grid View
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Viewing scanned items with dedicated columns for Style Code, Name, SKU, Size, Color, Description, and Price</p>
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
              {stores.length === 0 && <option value="">No Store Available</option>}
              {stores.map((st) => (
                <option key={st} value={st} className="bg-slate-900">{st}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCommitSession}
            disabled={saving || storeRecords.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Finalizing..." : "Approve Session"}</span>
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
            placeholder="Scan style code, name, or SKU to log physical count..."
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
              <span className="text-white font-bold">Successfully Scanned:</span>
              <span className="text-emerald-300">{lastScannedItem.style_name} ({lastScannedItem.color} / {lastScannedItem.size}) • ₱{lastScannedItem.price}</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black">
              Counted: {lastScannedItem.counted_stock} pcs
            </span>
          </div>
        )}
      </div>

      {/* TABLE WORKSPACE WITH SEPARATE COLUMNS FOR EACH DETAIL */}
      <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">Physical Count Log Entries ({storeRecords.length} items)</span>
          </div>

          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search scanned logs..."
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
                <th className="px-4 py-3.5 border-r border-slate-800">Style Code</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Style Name</th>
                <th className="px-4 py-3.5 border-r border-slate-800">SKU</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Size</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Color</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Description</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">Price</th>
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
                    <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-10"></div></td>
                    <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-12"></div></td>
                    <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-28"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-10 ml-auto"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-10 ml-auto"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-10 ml-auto"></div></td>
                    <td className="px-4 py-4 text-right"><div className="h-6 bg-slate-800 rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : storeRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-16 text-center text-slate-500 italic">No scanned items found in `physical_count_logs` for {selectedStore || "this store"}. Start scanning items above!</td>
                </tr>
              ) : (
                storeRecords.map((item) => {
                  const variance = item.counted_stock - item.system_stock;
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="px-4 py-3.5 border-r border-slate-900/50 font-bold text-emerald-400">{item.style_code}</td>
                      <td className="px-4 py-3.5 border-r border-slate-900/50 text-white font-sans">{item.style_name}</td>
                      <td className="px-4 py-3.5 border-r border-slate-900/50 text-slate-300">{item.sku}</td>
                      <td className="px-4 py-3.5 border-r border-slate-900/50 text-slate-300">{item.size}</td>
                      <td className="px-4 py-3.5 border-r border-slate-900/50 text-slate-300">{item.color}</td>
                      <td className="px-4 py-3.5 border-r border-slate-900/50 text-slate-400 font-sans">{item.description}</td>
                      <td className="px-4 py-3.5 text-right border-r border-slate-900/50 text-emerald-400 font-bold">₱{item.price.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-indigo-300 border-r border-slate-900/50">{item.system_stock} pcs</td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-400 border-r border-slate-900/50 text-sm">{item.counted_stock} pcs</td>
                      <td className={`px-4 py-3.5 text-right font-bold border-r border-slate-900/50 text-sm ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </td>
                      <td className="px-4 py-3.5 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => updateCount(item.id, item.counted_stock - 1)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center justify-center cursor-pointer transition"
                          title="Decrease Count"
                        >
                          -
                        </button>
                        <button
                          onClick={() => updateCount(item.id, item.counted_stock + 1)}
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