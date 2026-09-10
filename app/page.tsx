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
  styleCode: string;
  sku: string;
  styleName: string;
  description: string;
  category: string;
  department: string;
  color: string;
  size: string;
}

export default function MobileScanPage() {
  const [selectedStore, setSelectedStore] = useState<string>("Metro Gaisano Ayala Cebu");
  const [scannedInput, setScannedInput] = useState<string>("");
  const [scannedItem, setScannedItem] = useState<Product | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [scannedItem, isProcessing]);

  // Handle instant scanning, catalog lookup, and direct auto-saving
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

    setIsProcessing(true);
    setStatusMessage({ type: "info", text: "Processing scan..." });

    // 1. Fetch all product details from catalog database using style_code, sku, or barcode
    const { data: product, error: lookupError } = await supabase
      .from("products")
      .select("*")
      .or(`style_code.eq.${query},sku.eq.${query},barcode.eq.${query}`)
      .maybeSingle();

    if (lookupError) {
      console.error("Lookup error:", lookupError);
      setStatusMessage({
        type: "error",
        text: "Failed to query catalog database.",
      });
      setIsProcessing(false);
      return;
    }

    // Prepare complete item object (populate all fields or fallback to placeholders)
    const matchedProduct: Product = {
      styleCode: product?.style_code || query,
      sku: product?.sku || "-",
      styleName: product?.style_name || `Scanned Item (${query})`,
      description: product?.description || "",
      category: product?.category || "-",
      department: product?.department || "-",
      color: product?.color || "-",
      size: product?.size || "-",
    };

    // 2. Direct Auto-Save to `scanned_logs`
    const logPayload = {
      store: selectedStore,
      style_code: matchedProduct.styleCode,
      sku: matchedProduct.sku !== "-" ? matchedProduct.sku : null,
      style_name: matchedProduct.styleName,
      description: matchedProduct.description,
      category: matchedProduct.category,
      department: matchedProduct.department,
      color: matchedProduct.color,
      size: matchedProduct.size,
      quantity: 1,
      scanned_at: new Date().toISOString(),
    };

    const { error: logError } = await supabase.from("scanned_logs").insert([logPayload]);

    if (logError) {
      console.error("Auto-save log error:", logError);
      setStatusMessage({
        type: "error",
        text: "Failed to automatically save scan to logs.",
      });
    } else {
      // 3. Display all retrieved fields on UI overlay
      setScannedItem(matchedProduct);
      setStatusMessage({
        type: "success",
        text: `Saved to ${selectedStore}`,
      });
    }

    setScannedInput("");
    setIsProcessing(false);
  };

  const handleNextScan = () => {
    setScannedItem(null);
    setStatusMessage(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col justify-between p-4 font-sans text-white">
      {/* Top Store Header */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2 py-1">
        <label htmlFor="storeSelect">Store:</label>
        <select
          id="storeSelect"
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          className="bg-transparent font-semibold text-emerald-400 focus:outline-none cursor-pointer text-right"
        >
          {STORES.map((store) => (
            <option key={store} value={store} className="bg-slate-900 text-white">
              {store}
            </option>
          ))}
        </select>
      </div>

      {/* Barcode/QR Input Bar (Supports Hardware Scanners & Manual Enter) */}
      {!scannedItem && (
        <div className="max-w-md mx-auto w-full my-auto space-y-4">
          <form onSubmit={handleScanSubmit} className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Ready to Scan QR / Barcode
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Scan code here..."
                value={scannedInput}
                onChange={(e) => setScannedInput(e.target.value)}
                disabled={isProcessing}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="submit"
                disabled={isProcessing || !scannedInput.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-5 rounded-2xl text-xs transition cursor-pointer shrink-0"
              >
                Scan
              </button>
            </div>
          </form>

          {statusMessage && (
            <p className={`text-xs text-center font-bold ${
              statusMessage.type === "error" ? "text-red-400" : "text-emerald-400"
            }`}>
              {statusMessage.text}
            </p>
          )}
        </div>
      )}

      {/* Main Success Overlay Card (Displays All Fields After Auto-Save) */}
      {scannedItem && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-md space-y-4 max-w-md mx-auto w-full my-auto">
          {/* Status Bar */}
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">
              Scanner paused
            </p>
          </div>

          {/* Badges: Saved Store Confirmation + Code & SKU */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
              ✓ SAVED TO {selectedStore.toUpperCase()}
            </span>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-emerald-400 font-mono font-bold text-xs bg-slate-950 border border-slate-800 px-2 py-1 rounded-md shrink-0">
                {scannedItem.styleCode}
              </span>
              <span className="text-blue-400 font-mono font-bold text-xs bg-slate-950 border border-slate-800 px-2 py-1 rounded-md shrink-0">
                SKU: {scannedItem.sku}
              </span>
            </div>
          </div>

          {/* Product Header */}
          <div className="space-y-0.5 pt-1">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {scannedItem.styleName}
            </h2>
            <p className="text-xs text-slate-400 uppercase font-medium">
              {scannedItem.description || "N/A"}
            </p>
          </div>

          {/* All Detailed Fields Display (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
              <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
                CATEGORY
              </p>
              <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                {scannedItem.category}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
              <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
                DEPARTMENT
              </p>
              <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                {scannedItem.department}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
              <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
                COLOR
              </p>
              <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                {scannedItem.color}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
              <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
                SIZE
              </p>
              <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                {scannedItem.size}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleNextScan}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              Scan Next
            </button>
            <button
              onClick={handleNextScan}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="text-center py-3">
        <p className="text-[10px] text-slate-600">Mobile Scanner Active</p>
      </div>
    </div>
  );
}