'use client';

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { supabase } from "@/lib/supabase";

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
}

interface ScannedProduct extends ProductDetails {
  id: string;
  timestamp: string;
}

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ProductDetails>({
    styleCode: "",
    styleName: "",
    description: "",
    color: "",
    category: "",
    department: "",
    size: "",
  });
  const [scannedItems, setScannedItems] = useState<ScannedProduct[]>([]);
  const [showList, setShowList] = useState(false);

  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);

    // Query Supabase for the scanned barcode/style code
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or(`style_code.eq.${scannedBarcode},barcode.eq.${scannedBarcode}`)
      .single();

    setLoading(false);

    if (error || !data) {
      alert(`Style Code / Barcode "${scannedBarcode}" not found in database.`);
      setProduct({
        styleCode: scannedBarcode,
        styleName: "",
        description: "",
        color: "",
        category: "",
        department: "",
        size: "",
      });
    } else {
      const fetchedProduct: ProductDetails = {
        styleCode: data.style_code || data.barcode || scannedBarcode,
        styleName: data.style_name || data.name || "",
        description: data.description || "",
        color: data.color || "",
        category: data.category || "",
        department: data.department || "",
        size: data.size || "",
      };

      setProduct(fetchedProduct);

      // Add to scanned history list automatically
      const newItem: ScannedProduct = {
        ...fetchedProduct,
        id: `${scannedBarcode}-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setScannedItems((prev) => [newItem, ...prev]);
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
    });
    setIsPaused(false);
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear the scanned list?")) {
      setScannedItems([]);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 max-w-md md:max-w-xl mx-auto antialiased">
      {/* Header */}
      <header className="flex items-center justify-between py-2 border-b border-slate-800 pb-3">
        <div>
          <div className="inline-flex items-center space-x-2 bg-slate-800 border border-slate-700/60 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-blue-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Terminal Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mt-1">
            Mobile POS
          </h1>
        </div>

        {/* Scanned List Toggle Button */}
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
              {scannedItems.length}
            </span>
          )}
        </button>
      </header>

      {/* Main Interactive Section */}
      <section className="space-y-4 my-auto py-2">
        {/* Scanner Viewport */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/50 p-2 shadow-2xl backdrop-blur-sm">
          {scanning ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-full">
              <Scanner onScan={handleScan} isPaused={isPaused} />
              
              {isPaused && (
                <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 p-4">
                  <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
                    ✓ Code Scanned & Saved
                  </div>
                  <p className="text-xs text-slate-300 font-medium text-center">
                    Tap below to scan another item without opening camera
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

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center space-x-2 py-1 text-blue-400 font-medium animate-pulse text-xs">
            <span>Fetching item attributes...</span>
          </div>
        )}

        {/* Product Details Card with New Fields */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Information</span>
            {product.styleCode && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                Saved to List
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

          {/* Row 3: Color & Size */}
          <div className="grid grid-cols-2 gap-2">
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

        {/* Scanned Items History Drawer */}
        {showList && (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Scanned History</span>
                <span className="text-xs font-mono text-slate-400">({scannedItems.length})</span>
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
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-500 hover:text-red-400 p-1"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>

                    {item.description && (
                      <p className="text-[11px] text-slate-300 line-clamp-1">{item.description}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
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