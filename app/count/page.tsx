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

  const initData = useCallback(async () => {
    setLoading(true);

    const { data: invData } = await supabase.from("store_inventory").select("store");
    if (invData && invData.length > 0) {
      const uniqueStores = Array.from(new Set(invData.map((i: any) => i.store ? i.store.trim() : "Main Store"))).sort();
      setStores(uniqueStores);
      setSelectedStore((prev) => prev || uniqueStores[0]);
    } else {
      setStores(["Main Store"]);
      setSelectedStore("Main Store");
    }

    const { data: logData, error } = await supabase.from("physical_count_logs").select("*").order("created_at", { ascending: false });
    if (!error && logData) {
      const parsed: PhysicalCountRecord[] = logData.map((item: any) => ({
        id: String(item.id),
        store: item.store ? item.store.trim() : "Main Store",
        style_code: item.style_code || "Unknown",
        sku: item.sku || "-",
        style_name: item.style_name || item.style_code || "-",
        color: item.color || "-",
        size: item.size || "-",
        description: item.description || "-",
        price: Number(item.price) || 0,
        system_stock: Number(item.system_stock) || 0,
        counted_stock: Number(item.counted_stock) || 1,
        status: item.status || "PENDING",
        created_at: item.created_at
      }));
      setCountRecords(parsed);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    initData();
  }, [initData]);

  const storeRecords = useMemo(() => {
    return countRecords.filter((item) => {
      const matchStore = !selectedStore || item.store.toLowerCase() === selectedStore.toLowerCase();
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

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    const targetStore = selectedStore || stores[0] || "Main Store";
    const code = scanInput.trim().toLowerCase();

    const existingRecord = countRecords.find(
      (item) =>
        item.store.toLowerCase() === targetStore.toLowerCase() &&
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
        logUserActivity("PHYSICAL_COUNT_SCAN", `Incremented count for ${existingRecord.style_code}`);
      } else {
        alert(`Update error: ${error.message}`);
      }
    } else {
      // 1. Search store_inventory with broad fallback matching
      const { data: storeInv } = await supabase.from("store_inventory").select("*").eq("store", targetStore);
      const matchedInv = storeInv?.find(
        (inv: any) =>
          String(inv.style_code || "").toLowerCase() === code || 
          String(inv.sku || "").toLowerCase() === code ||
          String(inv.barcode || "").toLowerCase() === code ||
          String(inv.item_code || "").toLowerCase() === code ||
          String(inv.style_name || "").toLowerCase() === code
      );

      // 2. Search global products master catalog as fallback
      const { data: prodData } = await supabase.from("products").select("*");
      const matchedProd = prodData?.find(
        (p: any) =>
          String(p.style_code || "").toLowerCase() === code ||
          String(p.sku || "").toLowerCase() === code ||
          String(p.barcode || "").toLowerCase() === code ||
          String(p.item_code || "").toLowerCase() === code ||
          String(p.style_name || "").toLowerCase() === code
      );

      const source = matchedInv || matchedProd || {};

      const newLogEntry = {
        store: targetStore,
        style_code: source.style_code || source.item_code || scanInput.trim(),
        sku: source.sku || source.barcode || "-",
        style_name: source.style_name || source.name || source.style_code || scanInput.trim(),
        color: source.color || source.colour || "-",
        size: source.size || source.dimension || "-",
        description: source.description || source.desc || "-",
        price: Number(source.price || source.retail_price || source.cost || 0),
        system_stock: Number(source.current_stock || source.stock || source.qty || 0),
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
        logUserActivity("PHYSICAL_COUNT_NEW_SCAN", `Added scan log for ${formatted.style_code}`);
      } else {
        console.error("Insert error details:", error);
        alert(`Failed to insert: ${error?.message || "Unknown database error"}`);
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
    if (!confirm(`Finalize session for ${selectedStore}?`)) return;
    setSaving(true);
    try {
      const updates = storeRecords.map((item) =>
        supabase.from("physical_count_logs").update({ status: "APPROVED" }).eq("id", item.id)
      );
      await Promise.all(updates);
      setSuccessMessage("Session approved successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);
      initData();
    } catch (err) {
      alert("Error approving session.");
    } finally {
      setSaving(false);
    }
  };

  const totalSystemStock = storeRecords.reduce((acc, curr) => acc + curr.system_stock, 0);
  const totalCountedStock = storeRecords.reduce((acc, curr) => acc + curr.counted_stock, 0);
  const varianceCount = totalCountedStock - totalSystemStock;

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 p-4 sm:p-6 space-y-6 font-sans select-none">
      <nav className="bg-[#0E1526]/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <Link href="/analytics/qlik" className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-white uppercase">Physical Count Logs</span>
            <p className="text-xs text-slate-400 font-mono">Scan item barcodes to log counts and view complete product details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="bg-slate-950 text-white border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
          >
            {stores.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <button
            onClick={handleCommitSession}
            disabled={saving || storeRecords.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
          >
            {saving ? "Approving..." : "Approve Session"}
          </button>
        </div>
      </nav>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs font-bold">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0E1526]/70 border border-slate-800/80 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold text-slate-400">System Stock</p>
          <h3 className="text-2xl font-black text-white mt-1">{totalSystemStock} pcs</h3>
        </div>
        <div className="bg-[#0E1526]/70 border border-slate-800/80 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold text-slate-400">Counted Stock</p>
          <h3 className="text-2xl font-black text-emerald-400 mt-1">{totalCountedStock} pcs</h3>
        </div>
        <div className="bg-[#0E1526]/70 border border-slate-800/80 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold text-slate-400">Variance</p>
          <h3 className={`text-2xl font-black mt-1 ${varianceCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {varianceCount > 0 ? `+${varianceCount}` : varianceCount} pcs
          </h3>
        </div>
      </div>

      <div className="bg-[#0E1526]/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-3">
        <form onSubmit={handleScanSubmit} className="flex items-center gap-3">
          <ScanBarcode className="w-6 h-6 text-emerald-400 animate-pulse ml-2" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Scan style code or SKU to record count..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 text-sm px-4 py-3 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
            autoFocus
          />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs cursor-pointer">
            Scan / Add
          </button>
        </form>

        {lastScannedItem && (
          <div className="bg-slate-950 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-mono text-emerald-300">
            Scanned: {lastScannedItem.style_name} ({lastScannedItem.color} / {lastScannedItem.size}) • ₱{lastScannedItem.price.toFixed(2)} - Qty: {lastScannedItem.counted_stock}
          </div>
        )}
      </div>

      <div className="bg-[#0E1526]/90 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
          <span className="text-sm font-bold text-white uppercase">Count Entries ({storeRecords.length})</span>
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-white w-64 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1 [scrollbar-width:thin]">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30">
              <tr>
                <th className="px-4 py-3.5 border-r border-slate-800">Style Code</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Style Name</th>
                <th className="px-4 py-3.5 border-r border-slate-800">SKU</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Size</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Color</th>
                <th className="px-4 py-3.5 border-r border-slate-800">Description</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">Price</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">System</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">Count</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-800">Variance</th>
                <th className="px-4 py-3.5 text-right">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {storeRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-16 text-center text-slate-500 italic">No scanned items found. Enter a barcode or style code above to start counting.</td>
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
                      <td className="px-4 py-3.5 text-right font-bold text-indigo-300 border-r border-slate-900/50">{item.system_stock}</td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-400 border-r border-slate-900/50">{item.counted_stock}</td>
                      <td className={`px-4 py-3.5 text-right font-bold border-r border-slate-900/50 ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </td>
                      <td className="px-4 py-3.5 text-right flex items-center justify-end gap-1.5">
                        <button onClick={() => updateCount(item.id, item.counted_stock - 1)} className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center justify-center cursor-pointer">-</button>
                        <button onClick={() => updateCount(item.id, item.counted_stock + 1)} className="w-7 h-7 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg font-bold flex items-center justify-center cursor-pointer">+</button>
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