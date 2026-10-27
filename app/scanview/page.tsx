"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { logUserActivity } from "@/lib/logger";
import {
  ScanBarcode,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Boxes,
  LayoutDashboard,
  Layers,
  ShoppingBag,
  History,
  Trash2,
  Search,
  Check,
  Zap,
  Truck,
  PackageCheck
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ProductMasterRecord {
  id: string;
  style_code: string;
  sku: string;
  style_name: string;
  department: string;
  category: string;
  color: string;
  size: string;
  price: number;
}

interface ScannedLog {
  id: string;
  store: string;
  transaction_mode: "sales" | "audit" | "delivery" | "pull_out";
  style_code: string;
  sku: string;
  style_name: string;
  color: string;
  size: string;
  category: string;
  department: string;
  price: number;
  quantity: number;
  scanned_at: string;
}

const STORES = [
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

const TRANSACTION_MODES = [
  { key: "sales", label: "POS Sales Transaction", icon: ShoppingBag, color: "emerald", desc: "Deducts stock & records retail sale" },
  { key: "pull_out", label: "Pull Out (Stock Removal)", icon: Truck, color: "rose", desc: "Deducts stock & increments pull-out count" },
  { key: "delivery", label: "Delivery / Receiving", icon: PackageCheck, color: "indigo", desc: "Increases stock upon receiving" },
  { key: "audit", label: "Physical Audit Log", icon: History, color: "purple", desc: "Records scan without modifying stock" },
];

export default function ScanViewPage() {
  const [productsMaster, setProductsMaster] = useState<ProductMasterRecord[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("Metro Gaisano Colon");
  const [transactionMode, setTransactionMode] = useState<"sales" | "audit" | "delivery" | "pull_out">("pull_out");
  
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [quantityInput, setQuantityInput] = useState<number>(1);
  
  const [recentScans, setRecentScans] = useState<ScannedLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, logRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("scanned_logs").select("*").order("scanned_at", { ascending: false }).limit(20)
      ]);

      if (!prodRes.error && prodRes.data) {
        setProductsMaster(prodRes.data.map((p: any) => ({ ...p, price: parseFloat(p.price) || 0 })));
      }
      if (!logRes.error && logRes.data) {
        setRecentScans(logRes.data as ScannedLog[]);
      }
    } catch (err) {
      console.error("Failed to load scanner data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  const handleProcessScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    setProcessing(true);
    setStatusMessage(null);

    try {
      const matchedProduct = productsMaster.find(
        (p) =>
          p.sku.toLowerCase() === query.toLowerCase() ||
          p.style_code.toLowerCase() === query.toLowerCase() ||
          p.style_name.toLowerCase().includes(query.toLowerCase())
      );

      if (!matchedProduct) {
        setStatusMessage({ type: "error", text: `Product not found for scan query: "${query}"` });
        setProcessing(false);
        return;
      }

      const qty = Number(quantityInput) || 1;

      // 1. Insert scan log
      const logPayload = {
        store: selectedStore,
        transaction_mode: transactionMode,
        style_code: matchedProduct.style_code,
        sku: matchedProduct.sku,
        style_name: matchedProduct.style_name,
        color: matchedProduct.color || "Default",
        size: matchedProduct.size || "Free Size",
        category: matchedProduct.category || "General",
        department: matchedProduct.department || "General",
        price: matchedProduct.price,
        quantity: qty,
      };

      const { data: insertedLog, error: logError } = await supabase
        .from("scanned_logs")
        .insert([logPayload])
        .select()
        .single();

      if (logError) throw new Error(`Failed to save scan log: ${logError.message}`);

      // 2. Fetch inventory record for store & style_code
      const { data: invRecord } = await supabase
        .from("store_inventory")
        .select("id, current_stock, pull_out, initial_stock")
        .eq("store", selectedStore)
        .eq("style_code", matchedProduct.style_code)
        .maybeSingle();

      const existingStock = invRecord ? Number(invRecord.current_stock) || 0 : 0;
      const existingPullOut = invRecord ? Number(invRecord.pull_out) || 0 : 0;

      // 3. Update store_inventory with explicit column adjustments
      if (transactionMode === "pull_out") {
        const newStock = Math.max(0, existingStock - qty);
        const newPullOut = existingPullOut + qty;

        if (invRecord) {
          const { error: updateErr } = await supabase
            .from("store_inventory")
            .update({
              current_stock: newStock,
              pull_out: newPullOut, // Explicitly updates the pull_out column
              last_replenished_at: new Date().toISOString(),
            })
            .eq("id", invRecord.id);

          if (updateErr) throw new Error(`Failed to update inventory pull out: ${updateErr.message}`);
        } else {
          const { error: insertErr } = await supabase.from("store_inventory").insert([
            {
              store: selectedStore,
              style_code: matchedProduct.style_code,
              sku: matchedProduct.sku,
              style_name: matchedProduct.style_name,
              color: matchedProduct.color,
              size: matchedProduct.size,
              department: matchedProduct.department,
              category: matchedProduct.category,
              initial_stock: qty,
              current_stock: 0,
              pull_out: qty,
              price: matchedProduct.price,
              last_replenished_at: new Date().toISOString(),
            },
          ]);

          if (insertErr) throw new Error(`Failed to insert store inventory: ${insertErr.message}`);
        }
      } else if (transactionMode === "sales") {
        const newStock = Math.max(0, existingStock - qty);
        if (invRecord) {
          await supabase.from("store_inventory").update({ current_stock: newStock }).eq("id", invRecord.id);
        }
      } else if (transactionMode === "delivery") {
        const newStock = existingStock + qty;
        const newInitial = (Number(invRecord?.initial_stock) || 0) + qty;
        if (invRecord) {
          await supabase.from("store_inventory").update({ current_stock: newStock, initial_stock: newInitial, last_replenished_at: new Date().toISOString() }).eq("id", invRecord.id);
        } else {
          await supabase.from("store_inventory").insert([
            {
              store: selectedStore,
              style_code: matchedProduct.style_code,
              sku: matchedProduct.sku,
              style_name: matchedProduct.style_name,
              color: matchedProduct.color,
              size: matchedProduct.size,
              department: matchedProduct.department,
              category: matchedProduct.category,
              initial_stock: qty,
              current_stock: qty,
              pull_out: 0,
              price: matchedProduct.price,
              last_replenished_at: new Date().toISOString(),
            },
          ]);
        }
      }

      if (insertedLog) {
        setRecentScans((prev) => [insertedLog as ScannedLog, ...prev]);
      }

      setStatusMessage({
        type: "success",
        text: `Processed ${transactionMode.toUpperCase()}: ${matchedProduct.style_name} (x${qty}) for ${selectedStore}`,
      });

      logUserActivity("SCAN_PROCESSED", `Processed ${transactionMode} scan for ${matchedProduct.style_code} at ${selectedStore}`);
      setBarcodeInput("");
      setQuantityInput(1);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: err.message || "An error occurred while saving the scan." });
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 p-4 sm:p-6 space-y-4 font-sans select-none">
      <nav className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <ScanBarcode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-tight text-white">MOBILE BARCODE SCANNER</span>
              <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Live Terminal</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Stock Movement & Transaction Logging Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/qlikview" className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition">
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" /><span>Analytics</span>
          </Link>
          <Link href="/inventory" className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition">
            <Boxes className="w-3.5 h-3.5 text-emerald-400" /><span>Inventory</span>
          </Link>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <StoreIcon className="w-3.5 h-3.5 text-indigo-400" /> Store Location *
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl text-emerald-400 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {STORES.map((st) => (
                <option key={st} value={st} className="bg-slate-900 text-white">{st}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" /> Transaction Mode *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TRANSACTION_MODES.map((mode) => {
                const IconComponent = mode.icon;
                const isSelected = transactionMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setTransactionMode(mode.key as any)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected ? "bg-slate-900 border-emerald-500 text-white shadow-md" : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <IconComponent className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-slate-500"}`} />
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{mode.label}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{mode.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleProcessScan} className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan SKU, Style Code, or Name..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs pl-9 pr-3 py-3 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
                  disabled={processing}
                />
              </div>
              <div className="w-20">
                <input
                  type="number"
                  min={1}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-center py-3 rounded-xl text-emerald-400 focus:outline-none focus:border-emerald-500"
                  disabled={processing}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={processing || !barcodeInput.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
            >
              {processing ? <span>Processing...</span> : <><Zap className="w-4 h-4" /><span>Process {transactionMode.toUpperCase()} Scan</span></>}
            </button>
          </form>

          {statusMessage && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${statusMessage.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
              {statusMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
              <span className="flex-1">{statusMessage.text}</span>
              <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col h-[580px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Live Scan Audit Feed</h3>
              <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">{recentScans.length} recent</span>
            </div>
            <button onClick={() => setRecentScans([])} className="text-xs text-slate-400 hover:text-rose-400 transition flex items-center gap-1 font-semibold cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /><span>Clear View</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 [scrollbar-width:thin]">
            {recentScans.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8 text-slate-500 text-xs italic">No recent scans logged in this session yet.</div>
            ) : (
              recentScans.map((scan) => (
                <div key={scan.id} className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs transition hover:border-slate-700">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{scan.style_name}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase border ${scan.transaction_mode === "pull_out" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : scan.transaction_mode === "delivery" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
                        {scan.transaction_mode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
                      <span>Code: {scan.style_code}</span>
                      <span>Store: {scan.store}</span>
                      <span>{new Date(scan.scanned_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-black text-emerald-400 text-sm block">x{scan.quantity}</span>
                    <span className="text-[11px] text-slate-400">₱{(scan.price * scan.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}