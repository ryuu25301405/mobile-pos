'use client';

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { triggerScanFeedback } from "@/lib/feedback";

const Scanner = dynamicImport(() => import("@/components/Scanner"), {
  ssr: false,
});

export const dynamic = 'force-dynamic';

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

interface ProductDetails {
  styleCode: string;
  sku?: string;
  styleName: string;
  description: string;
  color: string;
  category: string;
  department: string;
  size: string;
  quantity: number;
}

interface SessionScannedProduct extends ProductDetails {
  id: string;
  store: string;
  timestamp: string;
}

export default function Home() {
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [tempStore, setTempStore] = useState<string>("");
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local state for current active session scans
  const [sessionScans, setSessionScans] = useState<SessionScannedProduct[]>([]);
  const [lastScannedItem, setLastScannedItem] = useState<ProductDetails | null>(null);

  // Open scanner handler
  const handleOpenScanner = () => {
    if (!selectedStore) {
      setTempStore(STORES[0]);
      setIsStoreModalOpen(true);
      return;
    }
    setScanning(true);
    setIsPaused(false);
    setErrorMessage(null);
  };

  // Confirm store selection from popup modal
  const handleConfirmStore = () => {
    if (!tempStore) return;
    setSelectedStore(tempStore);
    setIsStoreModalOpen(false);
    setScanning(true);
    setIsPaused(false);
    setErrorMessage(null);
  };

  // Handle barcode/QR processing
  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);
    setErrorMessage(null);

    const cleanCode = scannedBarcode.trim().replace(/[\r\n]+/g, "");

    // Query products table by style_code, sku, or barcode
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or(`style_code.ilike.${cleanCode},sku.ilike.${cleanCode},barcode.ilike.${cleanCode}`)
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      triggerScanFeedback("error");
      setErrorMessage(`Code "${cleanCode}" not found in database.`);
    } else {
      triggerScanFeedback("success");

      const fetchedProduct: ProductDetails = {
        styleCode: data.style_code || cleanCode,
        sku: data.sku || "-",
        styleName: data.style_name || "Unassigned Item",
        description: data.description || "N/A",
        color: data.color || "-",
        category: data.category || "-",
        department: data.department || "-",
        size: data.size || "-",
        quantity: 1,
      };

      setLastScannedItem(fetchedProduct);

      const now = new Date();
      const formattedTimestamp = now.toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // Add to session list view instantly
      const newSessionItem: SessionScannedProduct = {
        ...fetchedProduct,
        id: `${cleanCode}-${Date.now()}`,
        store: selectedStore,
        timestamp: formattedTimestamp,
      };

      setSessionScans((prev) => [newSessionItem, ...prev]);

      // Direct auto-save to Supabase scanned_logs database
      await supabase.from("scanned_logs").insert([
        {
          store: selectedStore,
          style_code: fetchedProduct.styleCode,
          sku: fetchedProduct.sku !== "-" ? fetchedProduct.sku : null,
          style_name: fetchedProduct.styleName,
          description: fetchedProduct.description,
          color: fetchedProduct.color,
          category: fetchedProduct.category,
          department: fetchedProduct.department,
          size: fetchedProduct.size,
          quantity: 1,
          scanned_at: now.toISOString(),
        },
      ]);
    }
  };

  const handleScanNext = () => {
    setErrorMessage(null);
    setLastScannedItem(null);
    setIsPaused(false);
  };

  const handleRemoveFromSession = (id: string) => {
    setSessionScans((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCurrentSession = () => {
    setSessionScans([]);
  };

  const totalSessionItems = sessionScans.length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 max-w-2xl mx-auto antialiased">
      {/* Header & Store Selector */}
      <header className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Mobile Terminal
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Barcode / QR Scanner
            </h1>
          </div>

          <button
            onClick={handleOpenScanner}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Scan Now</span>
          </button>
        </div>

        {/* Store Location Picker Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Store Location <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-bold rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="" disabled className="text-slate-500">
              -- Select Store Location --
            </option>
            {STORES.map((store) => (
              <option key={store} value={store} className="text-white font-normal">
                {store}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Current Session Scanned Items View */}
      <section className="my-6 flex-1">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Current Session Scans
            </h2>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-[10px] px-2 py-0.5 rounded-full">
              {totalSessionItems}
            </span>
          </div>

          {totalSessionItems > 0 && (
            <button
              onClick={clearCurrentSession}
              className="text-[10px] text-slate-500 hover:text-red-400 font-bold transition"
            >
              Clear List
            </button>
          )}
        </div>

        {sessionScans.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 border-dashed rounded-3xl p-8 text-center my-auto space-y-2">
            <p className="text-sm font-bold text-slate-300">No active scans right now</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Select your store and tap "Scan Now" to begin adding items to this session.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {sessionScans.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-sm"
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-white text-sm leading-tight">{item.styleName}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 text-xs font-bold">{item.styleCode}</span>
                    {item.sku && item.sku !== "-" && (
                      <span className="font-mono text-blue-400 text-[10px]">({item.sku})</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {item.store} • {item.timestamp}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="bg-slate-950 text-slate-300 border border-slate-800 font-bold text-xs px-2.5 py-1 rounded-lg">
                    x{item.quantity}
                  </span>
                  <button
                    onClick={() => handleRemoveFromSession(item.id)}
                    className="text-slate-600 hover:text-red-400 text-xs font-bold p-1 transition"
                    title="Remove from current session"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Store Prompt Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 text-left">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Select Current Store</h2>
              <p className="text-xs text-slate-400">Please choose a store before opening camera.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Store</label>
              <select
                value={tempStore}
                onChange={(e) => setTempStore(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
              >
                {STORES.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleConfirmStore}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
              >
                Confirm & Open Scanner
              </button>
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="py-3 px-4 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Viewport Modal */}
      {scanning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs px-4">
              <span className="text-slate-400 font-medium">Store:</span>
              <span className="font-bold text-emerald-400">{selectedStore}</span>
            </div>

            <div className="relative aspect-square bg-black">
              <Scanner onScan={handleScan} isPaused={isPaused} />

              {loading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full border border-slate-800 backdrop-blur-md animate-pulse">
                  Verifying & Saving...
                </div>
              )}

              {/* Detailed Scan Results Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-5 text-center space-y-3 overflow-y-auto">
                  {errorMessage ? (
                    <div className="space-y-2 my-auto">
                      <div className="w-14 h-14 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                        ✕
                      </div>
                      <h3 className="text-base font-bold text-white">Item Not Found</h3>
                      <p className="text-xs text-red-300/80 max-w-xs">{errorMessage}</p>
                    </div>
                  ) : (
                    lastScannedItem && (
                      <div className="w-full space-y-3 my-auto text-left">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase">
                            ✓ Saved to {selectedStore}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-emerald-400 font-bold">
                              {lastScannedItem.styleCode}
                            </span>
                            {lastScannedItem.sku && lastScannedItem.sku !== "-" && (
                              <span className="text-xs font-mono text-blue-400 font-bold">
                                • {lastScannedItem.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white leading-snug">
                            {lastScannedItem.styleName}
                          </h3>
                          {lastScannedItem.description && lastScannedItem.description !== "N/A" && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {lastScannedItem.description}
                            </p>
                          )}
                        </div>

                        {/* All QR Code Fields Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              Category
                            </span>
                            <span className="text-slate-200 font-semibold truncate block">
                              {lastScannedItem.category}
                            </span>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              Department
                            </span>
                            <span className="text-slate-200 font-semibold truncate block">
                              {lastScannedItem.department}
                            </span>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              Color
                            </span>
                            <span className="text-slate-200 font-semibold truncate block">
                              {lastScannedItem.color}
                            </span>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              Size
                            </span>
                            <span className="text-slate-200 font-bold text-emerald-400 truncate block">
                              {lastScannedItem.size}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  <div className="flex space-x-2 w-full pt-2 border-t border-slate-800">
                    <button
                      onClick={handleScanNext}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                    >
                      Scan Next
                    </button>
                    <button
                      onClick={() => setScanning(false)}
                      className="py-3 px-4 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:text-white"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setScanning(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs border-t border-slate-700/60"
            >
              Close Camera View
            </button>
          </div>
        </div>
      )}

      <footer className="text-center py-2 text-[10px] text-slate-600 tracking-wider uppercase">
        Active Session Log
      </footer>
    </main>
  );
}