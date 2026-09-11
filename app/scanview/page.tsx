"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  ScanBarcode,
  BarChart3,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

interface ScannedItem {
  id: string;
  sku: string | null;
  style_code: string | null;
  description: string | null;
  color: string | null;
  size: string | null;
  category: string | null;
  department: string | null;
  price: number | null;
  quantity?: number | null;
  store?: string | null;
  scanned_at: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ScanViewPage() {
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [recentScans, setRecentScans] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on input for physical hardware scanners
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch the 15 most recent scans on load
  useEffect(() => {
    async function loadRecentScans() {
      const { data, error } = await supabase
        .from("scanned_logs")
        .select("*")
        .order("scanned_at", { ascending: false })
        .limit(15);

      if (!error && data) {
        setRecentScans(data);
      }
    }
    loadRecentScans();

    // Listen for realtime insert events
    const channel = supabase
      .channel("scanview_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scanned_logs" },
        (payload) => {
          setRecentScans((prev) => [payload.new as ScannedItem, ...prev.slice(0, 14)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleBarcodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      // Find matching item in master inventory
      const { data: itemData, error: findError } = await supabase
        .from("inventory")
        .select("*")
        .or(`sku.eq.${barcode},style_code.eq.${barcode}`)
        .maybeSingle();

      if (findError) {
        throw new Error(findError.message);
      }

      const logPayload = {
        sku: itemData?.sku || barcode,
        style_code: itemData?.style_code || null,
        description: itemData?.description || "Manually Scanned Item",
        color: itemData?.color || null,
        size: itemData?.size || null,
        category: itemData?.category || "General",
        department: itemData?.department || "Unassigned",
        price: itemData?.price || 0,
        quantity: 1,
        store: itemData?.store || "Landmark Trinoma",
        scanned_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("scanned_logs")
        .insert([logPayload]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setStatusMessage({
        type: "success",
        text: `Logged: ${logPayload.sku} (${logPayload.description})`,
      });
      setBarcodeInput("");
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to log barcode scan.",
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <ScanBarcode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Active Scanner Terminal
            </h1>
            <p className="text-xs text-slate-400">
              High-speed barcode scanner terminal and live register log
            </p>
          </div>
        </div>

        {/* Dedicated Navigation Link to Daily Sales Report */}
        <Link
          href="/reports/daily-sales"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg border border-indigo-500/30 shadow-md shadow-indigo-950 transition-all hover:translate-x-0.5 cursor-pointer"
        >
          <BarChart3 className="w-4 h-4" />
          <span>View Daily Sales Report</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </Link>
      </div>

      {/* Barcode Input Bar */}
      <div className="max-w-3xl mx-auto space-y-3">
        <form onSubmit={handleBarcodeSubmit} className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Scan barcode or type SKU / Style Code..."
            disabled={loading}
            className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl pl-12 pr-28 py-3.5 text-base text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            disabled={loading || !barcodeInput.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
          >
            {loading ? "Logging..." : "Log Scan"}
          </button>
        </form>

        {/* Status Feedback Notice */}
        {statusMessage && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-xs border ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Live Recent Scanned Items Feed */}
      <div className="max-w-5xl mx-auto bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Recent Register Scans</h2>
          </div>
          <span className="text-[11px] text-slate-500">Live Sync Enabled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Style Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentScans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No items scanned yet. Scan a barcode above to begin.
                  </td>
                </tr>
              ) : (
                recentScans.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(item.scanned_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">
                      {item.sku || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {item.style_code || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {item.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {item.store || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400 whitespace-nowrap">
                      ₱{Number(item.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}