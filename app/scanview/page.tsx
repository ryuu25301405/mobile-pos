'use client';

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { triggerScanFeedback } from "@/lib/feedback";

const Scanner = dynamicImport(() => import("@/components/Scanner"), {
  ssr: false,
});

export const dynamic = 'force-dynamic';

interface ProductDetails {
  styleCode: string;
  styleName: string;
  description: string;
  color: string;
  category: string;
  department: string;
  size: string;
  quantity: number;
}

interface ScannedProduct extends ProductDetails {
  id: string;
  timestamp: string;
}

export default function ScanViewPage() {
  const [scanning, setScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [scannedItems, setScannedItems] = useState<ScannedProduct[]>([]);
  const [lastScannedItem, setLastScannedItem] = useState<ProductDetails | null>(null);

  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);
    setErrorMessage(null);

    const cleanCode = scannedBarcode.trim().replace(/[\r\n]+/g, "");

    // 1. Fetch item details from Supabase products table
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("style_code", cleanCode)
      .single();

    setLoading(false);

    if (error || !data) {
      triggerScanFeedback("error");
      setErrorMessage(`Code "${cleanCode}" not found in database.`);
    } else {
      triggerScanFeedback("success");

      const fetchedProduct: ProductDetails = {
        styleCode: data.style_code || cleanCode,
        styleName: data.style_name || "Unassigned Item",
        description: data.description || "",
        color: data.color || "-",
        category: data.category || "-",
        department: data.department || "-",
        size: data.size || "-",
        quantity: 1,
      };

      setLastScannedItem(fetchedProduct);

      const now = new Date();
      const currentIsoTime = now.toISOString();
      const phFormattedTimestamp = now.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "short",
        timeStyle: "medium",
      });

      // 2. Add or increment item in local dashboard table
      setScannedItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.styleCode === cleanCode);

        if (existingIndex > -1) {
          const updatedList = [...prev];
          const existingItem = updatedList[existingIndex];
          updatedList[existingIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + 1,
            timestamp: phFormattedTimestamp,
          };
          return updatedList;
        } else {
          return [
            {
              ...fetchedProduct,
              id: `${cleanCode}-${Date.now()}`,
              timestamp: phFormattedTimestamp,
            },
            ...prev,
          ];
        }
      });

      // 3. Log scan entry into Supabase database
      await supabase.from("scanned_logs").insert([
        {
          style_code: fetchedProduct.styleCode,
          style_name: fetchedProduct.styleName,
          description: fetchedProduct.description,
          color: fetchedProduct.color,
          category: fetchedProduct.category,
          department: fetchedProduct.department,
          size: fetchedProduct.size,
          quantity: 1,
          scanned_at: currentIsoTime,
        },
      ]);
    }
  };

  const handleScanNext = () => {
    setErrorMessage(null);
    setLastScannedItem(null);
    setIsPaused(false);
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all scanned items?")) {
      setScannedItems([]);
    }
  };

  const totalUniqueItems = scannedItems.length;
  const totalQuantityScanned = scannedItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 max-w-4xl mx-auto antialiased">
      {/* Header Summary Cards */}
      <header className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Live Terminal View
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Scanned Inventory Items
            </h1>
          </div>

          <button
            onClick={() => {
              setScanning(true);
              setIsPaused(false);
              setErrorMessage(null);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Scan Barcode / QR</span>
          </button>
        </div>

        {/* Counter Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unique Products</p>
            <p className="text-2xl font-black text-white mt-0.5">{totalUniqueItems}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Quantity Scanned</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{totalQuantityScanned}</p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Session Actions</p>
              <p className="text-xs text-slate-400 mt-1">Clear active view</p>
            </div>
            {scannedItems.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold px-3 py-1.5 rounded-lg transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Camera Scanner Viewport Modal */}
      {scanning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="relative aspect-square bg-black">
              <Scanner onScan={handleScan} isPaused={isPaused} />

              {loading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full border border-slate-800 backdrop-blur-md animate-pulse">
                  Verifying Code...
                </div>
              )}

              {/* Scan Feedback Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
                  {errorMessage ? (
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                        ✕
                      </div>
                      <h3 className="text-base font-bold text-white">Item Not Found</h3>
                      <p className="text-xs text-red-300/80 max-w-xs">{errorMessage}</p>
                    </div>
                  ) : (
                    lastScannedItem && (
                      <div className="space-y-2 w-full max-w-xs">
                        <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                          ✓
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                          Item Added
                        </span>
                        <h3 className="text-lg font-bold text-white leading-tight">{lastScannedItem.styleName}</h3>
                        <p className="text-xs font-mono text-emerald-400 font-bold">{lastScannedItem.styleCode}</p>
                      </div>
                    )
                  )}

                  <div className="flex space-x-2 w-full max-w-xs pt-2">
                    <button
                      onClick={handleScanNext}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
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

      {/* Main Scanned Items List View */}
      <section className="my-6 flex-1">
        {scannedItems.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center my-auto space-y-3">
            <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-white">No items scanned yet</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tap the "Scan Barcode / QR" button at the top to start scanning products into this live list.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3">
            <div className="hidden sm:grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 pb-2 border-b border-slate-800">
              <span className="col-span-5">Product Info</span>
              <span className="col-span-3">Attributes</span>
              <span className="col-span-2 text-center">Quantity</span>
              <span className="col-span-2 text-right">Time</span>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {scannedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 transition flex flex-col sm:grid sm:grid-cols-12 items-start sm:items-center gap-2 sm:gap-0"
                >
                  {/* Title & Barcode */}
                  <div className="sm:col-span-5 space-y-0.5">
                    <p className="font-bold text-white text-sm leading-tight">{item.styleName}</p>
                    <p className="font-mono text-emerald-400 text-xs font-semibold">{item.styleCode}</p>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1">{item.description}</p>
                    )}
                  </div>

                  {/* Attributes */}
                  <div className="sm:col-span-3 flex flex-wrap gap-1 text-[10px]">
                    {item.color !== "-" && (
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                        {item.color}
                      </span>
                    )}
                    {item.size !== "-" && (
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-bold">
                        Size: {item.size}
                      </span>
                    )}
                    {item.department !== "-" && (
                      <span className="bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                        {item.department}
                      </span>
                    )}
                  </div>

                  {/* Quantity Badge */}
                  <div className="sm:col-span-2 flex sm:justify-center items-center w-full sm:w-auto mt-2 sm:mt-0 justify-between">
                    <span className="sm:hidden text-xs text-slate-500 font-bold">Quantity:</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-xs px-3 py-1 rounded-full">
                      x{item.quantity}
                    </span>
                  </div>

                  {/* Timestamp & Remove */}
                  <div className="sm:col-span-2 flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto">
                    <span className="text-[10px] font-mono text-slate-500">{item.timestamp}</span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-600 hover:text-red-400 p-1 text-xs font-bold transition"
                      title="Remove from list"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center py-2 text-[10px] text-slate-600 tracking-wider uppercase">
        Live Inventory View Engine Active
      </footer>
    </main>
  );
}