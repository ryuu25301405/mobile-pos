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

export default function ScanViewPage() {
  const [scanning, setScanning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const [product, setProduct] = useState<ProductDetails | null>(null);

  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);
    setErrorMessage(null);

    const cleanCode = scannedBarcode.trim().replace(/[\r\n]+/g, "");
    setLastScannedCode(cleanCode);

    // Fetch product details from Supabase
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("style_code", cleanCode)
      .single();

    setLoading(false);

    if (error || !data) {
      triggerScanFeedback("error");
      setErrorMessage(`Code "${cleanCode}" was not found in database.`);
      setProduct({
        styleCode: cleanCode,
        styleName: "Unknown Item",
        description: "Item not present in inventory catalog",
        color: "-",
        category: "-",
        department: "-",
        size: "-",
        quantity: 1,
      });
    } else {
      triggerScanFeedback("success");

      const fetchedProduct: ProductDetails = {
        styleCode: data.style_code || cleanCode,
        styleName: data.style_name || "Unassigned",
        description: data.description || "",
        color: data.color || "N/A",
        category: data.category || "General",
        department: data.department || "General",
        size: data.size || "OS",
        quantity: 1,
      };

      setProduct(fetchedProduct);

      const now = new Date();
      const currentIsoTime = now.toISOString();

      // Log database transaction
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
    setProduct(null);
    setErrorMessage(null);
    setLastScannedCode(null);
    setIsPaused(false);
  };

  return (
    <main className="fixed inset-0 bg-black text-slate-100 flex flex-col justify-between p-4 antialiased z-50 overflow-hidden">
      {/* Viewport Area - Fills screen */}
      <div className="relative w-full h-full rounded-3xl overflow-hidden bg-slate-950 border border-slate-900 shadow-2xl flex flex-col items-center justify-center">
        {scanning ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <Scanner onScan={handleScan} isPaused={isPaused} />

            {/* Processing State Indicator */}
            {loading && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 text-emerald-400 text-xs font-bold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center space-x-2 z-20 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span>Querying Database...</span>
              </div>
            )}

            {/* FULL-SCREEN SCAN FEEDBACK OVERLAY */}
            {isPaused && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in zoom-in duration-200">
                {errorMessage ? (
                  <div className="space-y-4 max-w-xs">
                    <div className="w-20 h-20 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto text-4xl text-red-400 shadow-lg shadow-red-500/10">
                      ✕
                    </div>
                    <div>
                      <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-widest">
                        Not Found
                      </span>
                      <h2 className="text-xl font-bold text-white mt-3">Product Missing</h2>
                      <p className="text-xs text-emerald-400 font-mono mt-1 font-bold">{lastScannedCode}</p>
                    </div>
                    <p className="text-xs text-slate-400">{errorMessage}</p>
                  </div>
                ) : (
                  product && (
                    <div className="space-y-4 max-w-xs w-full">
                      <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-4xl text-emerald-400 shadow-lg shadow-emerald-500/10 animate-bounce">
                        ✓
                      </div>
                      <div>
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                          Scan Saved
                        </span>
                        <h2 className="text-2xl font-black text-white mt-2 leading-tight">{product.styleName}</h2>
                        <p className="text-xs font-mono text-emerald-400 font-extrabold mt-1">{product.styleCode}</p>
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2 w-full shadow-inner">
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500">Description:</span>
                          <span className="text-slate-200 font-medium truncate max-w-[150px]">{product.description || "N/A"}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500">Color / Size:</span>
                          <span className="text-slate-200 font-semibold">{product.color} / {product.size}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Department:</span>
                          <span className="text-slate-200 font-semibold">{product.department}</span>
                        </div>
                      </div>
                    </div>
                  )
                )}

                <button
                  onClick={handleScanNext}
                  className="w-full max-w-xs mt-8 py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition text-base tracking-wide flex items-center justify-center space-x-2"
                >
                  <span>📷 Scan Next Item</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setScanning(true);
              setIsPaused(false);
            }}
            className="w-full h-full py-12 px-6 bg-slate-900 border border-slate-800 text-white font-bold rounded-3xl active:scale-[0.99] transition flex flex-col items-center justify-center space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-lg font-extrabold tracking-wide">Tap to Activate Scanner</span>
            <span className="text-xs text-slate-500 font-normal">Direct Link Terminal</span>
          </button>
        )}
      </div>
    </main>
  );
}