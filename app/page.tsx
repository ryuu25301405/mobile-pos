'use client';

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

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

interface Product {
  id?: string;
  styleCode: string;
  sku?: string;
  styleName: string;
  description?: string;
  category?: string;
  department?: string;
  color?: string;
  size?: string;
  price?: number;
}

export default function MobileScanPage() {
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [scannedInput, setScannedInput] = useState<string>("");
  const [scannedItem, setScannedItem] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input field
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [scannedItem, statusMessage]);

  // Handle parsing / searching scanned code (QR Code or Barcode)
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = scannedInput.trim();
    if (!query) return;

    if (!selectedStore) {
      setStatusMessage({
        type: "error",
        text: "Please select a store location first!",
      });
      return;
    }

    setStatusMessage({ type: "info", text: "Searching product database..." });

    // Lookup item in Supabase master products table
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or(`style_code.eq.${query},sku.eq.${query},barcode.eq.${query}`)
      .maybeSingle();

    if (error) {
      console.error("Database query error:", error);
      setStatusMessage({
        type: "error",
        text: "Error looking up item. Please try again.",
      });
      return;
    }

    if (data) {
      setScannedItem({
        styleCode: data.style_code || query,
        sku: data.sku || "-",
        styleName: data.style_name || "Unassigned Item",
        description: data.description || "",
        category: data.category || "-",
        department: data.department || "-",
        color: data.color || "-",
        size: data.size || "-",
        price: data.price || 0,
      });
      setQuantity(1);
      setStatusMessage(null);
    } else {
      // Fallback: If item code not found in DB, treat scanned value as Raw Style Code
      setScannedItem({
        styleCode: query,
        sku: "-",
        styleName: `Scanned Item (${query})`,
        category: "Unassigned",
        department: "Unassigned",
        color: "-",
        size: "-",
      });
      setStatusMessage({
        type: "info",
        text: "Item code not found in catalog. Created temporary log entry.",
      });
    }

    setScannedInput("");
  };

  // Confirm and log scanned item into Supabase scanned_logs
  const handleConfirmLog = async () => {
    if (!scannedItem || !selectedStore) return;

    setIsSubmitting(true);

    const logPayload = {
      store: selectedStore,
      style_code: scannedItem.styleCode,
      sku: scannedItem.sku !== "-" ? scannedItem.sku : null,
      style_name: scannedItem.styleName,
      description: scannedItem.description || "",
      category: scannedItem.category || "-",
      department: scannedItem.department || "-",
      color: scannedItem.color || "-",
      size: scannedItem.size || "-",
      quantity: quantity,
      scanned_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("scanned_logs").insert([logPayload]);

    if (error) {
      console.error("Error logging scan:", error);
      setStatusMessage({
        type: "error",
        text: "Failed to save scan record. Try again.",
      });
    } else {
      setStatusMessage({
        type: "success",
        text: `Successfully logged ${quantity} unit(s) of [${scannedItem.styleCode}]!`,
      });
      setScannedItem(null);
      setQuantity(1);
    }

    setIsSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto antialiased space-y-4 pb-12">
      {/* Header Bar */}
      <header className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            Mobile Terminal
          </span>
          <h1 className="text-xl font-black text-white mt-1">
            Barcode & QR Scanner
          </h1>
        </div>
      </header>

      {/* Store Selector */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Selected Store Location <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
        >
          <option value="" disabled className="bg-slate-900 text-slate-500">
            -- Select Active Store --
          </option>
          {STORES.map((store) => (
            <option key={store} value={store} className="bg-slate-900 text-white">
              {store}
            </option>
          ))}
        </select>
      </section>

      {/* Barcode/QR Scanner Input Field */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Scan Barcode / QR Code
        </label>
        <form onSubmit={handleScanSubmit} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Scan or enter code..."
            value={scannedInput}
            onChange={(e) => setScannedInput(e.target.value)}
            disabled={!selectedStore}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={!selectedStore || !scannedInput.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shrink-0"
          >
            Scan
          </button>
        </form>
      </section>

      {/* Notification / Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-start justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : statusMessage.type === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : "bg-blue-500/10 border-blue-500/30 text-blue-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Scanned Result Card */}
      {scannedItem && (
        <section className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 space-y-4 shadow-xl shadow-emerald-500/5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              Scan Match Found
            </span>
            <button
              onClick={() => setScannedItem(null)}
              className="text-xs text-slate-500 hover:text-red-400 transition"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-2">
            {/* Style Code & SKU Display */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1 rounded-lg">
                Style: {scannedItem.styleCode}
              </span>
              <span className="text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-blue-400 px-2.5 py-1 rounded-lg">
                SKU: {scannedItem.sku || "-"}
              </span>
            </div>

            <h2 className="text-base font-black text-white leading-snug">
              {scannedItem.styleName}
            </h2>

            {scannedItem.description && (
              <p className="text-xs text-slate-400 line-clamp-2">
                {scannedItem.description}
              </p>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl">
                <p className="text-[9px] font-bold uppercase text-slate-500">Category</p>
                <p className="text-xs font-bold text-slate-300 truncate">{scannedItem.category}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl">
                <p className="text-[9px] font-bold uppercase text-slate-500">Department</p>
                <p className="text-xs font-bold text-slate-300 truncate">{scannedItem.department}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl">
                <p className="text-[9px] font-bold uppercase text-slate-500">Color</p>
                <p className="text-xs font-bold text-slate-300 truncate">{scannedItem.color}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl">
                <p className="text-[9px] font-bold uppercase text-slate-500">Size</p>
                <p className="text-xs font-bold text-slate-300 truncate">{scannedItem.size}</p>
              </div>
            </div>
          </div>

          {/* Quantity Selector & Confirm Action */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Quantity to Log:</span>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 font-black text-sm flex items-center justify-center transition"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-black text-emerald-400">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 font-black text-sm flex items-center justify-center transition"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleConfirmLog}
              disabled={isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isSubmitting ? "Saving Entry..." : "Confirm & Save Log"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}