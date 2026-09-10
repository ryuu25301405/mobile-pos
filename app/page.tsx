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

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [product, setProduct] = useState<ProductDetails>({
    styleCode: "",
    styleName: "",
    description: "",
    color: "",
    category: "",
    department: "",
    size: "",
    quantity: 1,
  });
  const [scannedItems, setScannedItems] = useState<ScannedProduct[]>([]);
  const [showList, setShowList] = useState(false);

  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);
    setErrorMessage(null);

    // Clean raw scan string
    const cleanCode = scannedBarcode.trim().replace(/[\r\n]+/g, "");

    // Query Supabase for product matching style_code
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("style_code", cleanCode)
      .single();

    setLoading(false);

    if (error || !data) {
      // ❌ TRIGGER ERROR AUDIO & HAPTIC FEEDBACK
      triggerScanFeedback("error");

      setErrorMessage(`Style Code "${cleanCode}" was not found in the database.`);

      setProduct({
        styleCode: cleanCode,
        styleName: "",
        description: "",
        color: "",
        category: "",
        department: "",
        size: "",
        quantity: 1,
      });
    } else {
      // ✅ TRIGGER SUCCESS AUDIO & HAPTIC FEEDBACK
      triggerScanFeedback("success");

      const fetchedProduct: ProductDetails = {
        styleCode: data.style_code || cleanCode,
        styleName: data.style_name || "",
        description: data.description || "",
        color: data.color || "",
        category: data.category || "",
        department: data.department || "",
        size: data.size || "",
        quantity: 1,
      };

      setProduct(fetchedProduct);

      // Current timestamps
      const now = new Date();
      const currentIsoTime = now.toISOString();
      const phFormattedTimestamp = now.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "short",
        timeStyle: "medium",
      });

      // 1. Update UI state: Aggregate duplicate barcodes locally
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
          const newItem: ScannedProduct = {
            ...fetchedProduct,
            id: `${cleanCode}-${Date.now()}`,
            timestamp: phFormattedTimestamp,
          };
          return [newItem, ...prev];
        }
      });

      // 2. Save individual scan log record to Supabase
      const { error: logError } = await supabase.from("scanned_logs").insert([
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

      if (logError) {
        console.error("Failed to persist scan to database:", logError.message);
      }
    }
  };

  const handleScanNext = () => {
    setProduct({
      styleCode: "",
      styleName: "",
      description: "",
      color: "",
      category: "",
      department: "",
      size: "",
      quantity: 1,
    });
    setErrorMessage(null);
    setIsPaused(false);
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear the scanned history?")) {
      setScannedItems([]);
    }
  };

  const totalItemsCount = scannedItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 max-w-md md:max-w-xl mx-auto antialiased">
      {/* Top Bar Header */}
      <header className="flex items-center justify-between py-2 border-b border-slate-800 pb-3">
        <div>
          <div className="inline-flex items-center space-x-2 bg-slate-800 border border-slate-700/60 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-blue-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Terminal Active (PST)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mt-1">
            Mobile POS
          </h1>
        </div>

        {/* History List Toggle Button */}
        <button
          onClick={() => setShowList(!showList)}
          className="relative bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-2 transition active:scale-95 shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>List</span>
          {scannedItems.length > 0 && (
            <span className="bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full text-[10px]">
              {totalItemsCount}
            </span>
          )}
        </button>
      </header>

      {/* Main Interactive Section */}
      <section className="space-y-4 my-auto py-2">
        {/* Visual "Not Found" Error Banner */}
        {errorMessage && (
          <div className="bg-red-500/15 border border-red-500/40 text-red-300 p-3.5 rounded-2xl flex items-center justify-between shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center space-x-3">
              <span className="text-lg">⚠️</span>
              <p className="text-xs font-semibold leading-tight">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white text-sm font-bold p-1 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scanner Viewport */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/50 p-2 shadow-2xl backdrop-blur-sm">
          {scanning ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-full">
              <Scanner onScan={handleScan} isPaused={isPaused} />
              
              {isPaused && (
                <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 p-4">
                  {errorMessage ? (
                    <div className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1.5">
                      <span>⚠️</span>
                      <span>Product Not Found</span>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1.5">
                      <span>✓</span>
                      <span>Saved to Supabase</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-300 font-medium text-center">
                    Tap below to scan another item without closing camera
                  </p>
                  <button
                    onClick={handleScanNext}
                    className="w-full py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition text-sm"
                  >
                    📷 Scan Next Item
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setScanning(false);
                  setIsPaused(false);
                  setErrorMessage(null);
                }}
                className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md shadow-lg transition active:scale-95 text-xs font-bold px-3 z-10"
              >
                ✕ Close
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setScanning(true);
                setIsPaused(false);
                setErrorMessage(null);
              }}
              className="w-full py-4 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-3 text-base"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              <span>Open Scanner</span>
            </button>
          )}
        </div>

        {/* Querying Indicator */}
        {loading && (
          <div className="flex items-center justify-center space-x-2 py-1 text-blue-400 font-medium animate-pulse text-xs">
            <span>Processing scan...</span>
          </div>
        )}

        {/* Product Details Form */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Information</span>
            {product.styleCode && !errorMessage && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                Saved
              </span>
            )}
            {errorMessage && (
              <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-2 py-0.5 rounded-full">
                Not Found
              </span>
            )}
          </div>

          {/* Row 1: Style Code & Style Name */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Style Code (Barcode)
              </label>
              <input
                type="text"
                value={product.styleCode}
                readOnly
                placeholder="---"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-xs focus:outline-none placeholder:text-slate-600 truncate"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Style Name
              </label>
              <input
                type="text"
                value={product.styleName}
                readOnly
                placeholder="---"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:outline-none placeholder:text-slate-600 truncate"
              />
            </div>
          </div>

          {/* Row 2: Description */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <input
              type="text"
              value={product.description}
              readOnly
              placeholder="---"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:outline-none placeholder:text-slate-600 truncate"
            />
          </div>

          {/* Row 3: Color, Size & Quantity */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Color
              </label>
              <input
                type="text"
                value={product.color}
                readOnly
                placeholder="---"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:outline-none placeholder:text-slate-600 truncate"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Size
              </label>
              <input
                type="text"
                value={product.size}
                readOnly
                placeholder="---"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none placeholder:text-slate-600 truncate"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={product.quantity}
                disabled
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-bold text-xs focus:outline-none cursor-not-allowed opacity-80"
              />
            </div>
          </div>

          {/* Row 4: Department & Category */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Department
              </label>
              <input
                type="text"
                value={product.department}
                readOnly
                placeholder="---"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:outline-none placeholder:text-slate-600 truncate"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Category
              </label>
              <input
                type="text"
                value={product.category}
                readOnly
                placeholder="---"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:outline-none placeholder:text-slate-600 truncate"
              />
            </div>
          </div>

          {product.styleCode && (
            <button
              type="button"
              onClick={handleScanNext}
              className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition active:scale-[0.98] text-xs flex items-center justify-center space-x-2"
            >
              <span>📷 Scan Next Item</span>
            </button>
          )}
        </div>

        {/* Aggregated History Drawer */}
        {showList && (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Scanned History</span>
                <span className="text-xs font-mono text-slate-400">
                  ({scannedItems.length} unique | {totalItemsCount} total)
                </span>
              </h2>
              {scannedItems.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Clear All
                </button>
              )}
            </div>

            {scannedItems.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500 italic">
                No items scanned yet. Open camera and scan a barcode!
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-700/60 text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-white text-xs">{item.styleName || "Unnamed Item"}</p>
                        <p className="font-mono text-[10px] text-emerald-400">{item.styleCode}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.timestamp}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-500 hover:text-red-400 p-1"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-[11px] text-slate-300 line-clamp-1">{item.description}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-md font-extrabold text-xs">
                        Qty: {item.quantity}
                      </span>
                      {item.color && (
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                          Color: {item.color}
                        </span>
                      )}
                      {item.size && (
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                          Size: {item.size}
                        </span>
                      )}
                      {item.department && (
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                          Dept: {item.department}
                        </span>
                      )}
                      {item.category && (
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                          Cat: {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center py-2 text-[11px] text-slate-500">
        Retail POS Scanner Module
      </footer>
    </main>
  );
}