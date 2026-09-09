'use client';

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { supabase } from "@/lib/supabase";

const Scanner = dynamicImport(() => import("@/components/Scanner"), {
  ssr: false,
});

export const dynamic = 'force-dynamic';

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState({ name: "", price: 0, stock: 0 });

  const handleScan = async (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setScanning(false);
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", scannedBarcode)
      .single();

    setLoading(false);

    if (error || !data) {
      alert(`Barcode "${scannedBarcode}" not found in database.`);
      setProduct({ name: "", price: 0, stock: 0 });
    } else {
      setProduct({ name: data.name, price: data.price, stock: data.stock });
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 max-w-md md:max-w-xl mx-auto antialiased">
      {/* Header */}
      <header className="text-center space-y-1 py-2">
        <div className="inline-flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-full text-xs font-semibold text-blue-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>POS Terminal Online</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Mobile POS
        </h1>
      </header>

      {/* Main Interactive Area */}
      <section className="space-y-4 my-auto">
        {/* Scanner Container */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/50 p-2 shadow-2xl backdrop-blur-sm">
          {scanning ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-full">
              <Scanner onScan={handleScan} />
              <button
                onClick={() => setScanning(false)}
                className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md shadow-lg transition active:scale-95 text-xs font-bold px-3"
              >
                ✕ Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setScanning(true)}
              className="w-full py-5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-3 text-base sm:text-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                />
              </svg>
              <span>Scan Barcode / QR</span>
            </button>
          )}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center space-x-2 py-3 text-blue-400 font-medium animate-pulse">
            <svg
              className="animate-spin h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Fetching item details...</span>
          </div>
        )}

        {/* Scanned Data Display Card */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Barcode ID
            </label>
            <input
              type="text"
              value={barcode}
              readOnly
              placeholder="No scan detected"
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-base sm:text-lg focus:outline-none placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={product.name}
              readOnly
              placeholder="Waiting for scan..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-base sm:text-lg focus:outline-none placeholder:text-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-slate-500 font-bold">$</span>
                <input
                  type="text"
                  value={product.price ? product.price.toFixed(2) : "0.00"}
                  readOnly
                  className="w-full pl-7 pr-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-base sm:text-lg focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                In Stock
              </label>
              <input
                type="text"
                value={product.stock || 0}
                readOnly
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-base sm:text-lg focus:outline-none text-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-slate-500">
        Optimized for iOS & Android Safari / Chrome
      </footer>
    </main>
  );
}