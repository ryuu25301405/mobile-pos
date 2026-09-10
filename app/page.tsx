'use client';

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  styleCode: string;
  sku?: string;
  styleName: string;
  description?: string;
  category?: string;
  department?: string;
  color?: string;
  size?: string;
}

export default function MobileScanPage() {
  const [selectedStore, setSelectedStore] = useState<string>("Metro Gaisano Ayala Cebu");
  const [scannedItem, setScannedItem] = useState<Product | null>({
    styleCode: "HWALICE0132ABLK",
    sku: "SKU-994812", // Populated SKU value
    styleName: "ALICE01",
    description: "ALICE BANDAEUA BRA",
    category: "UNDERWEAR",
    department: "Womens",
    color: "BLACK",
    size: "32A",
  });
  const [isScannerPaused, setIsScannerPaused] = useState<boolean>(true);

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col justify-between p-4 font-sans text-white">
      {/* Top Store Header */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2 py-1">
        <span>Store:</span>
        <span className="text-emerald-400 font-semibold">{selectedStore}</span>
      </div>

      {/* Main Overlay Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-md space-y-4 max-w-md mx-auto w-full">
        {/* Scanner State Header */}
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">
            {isScannerPaused ? "Scanner paused" : "Scanning..."}
          </p>
        </div>

        {/* Confirmation Badge & Identifiers (Style Code + SKU) */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
            ✓ SAVED TO {selectedStore.toUpperCase()}
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {/* Style Code Tag */}
            <span className="text-emerald-400 font-mono font-bold text-xs bg-slate-950 border border-slate-800 px-2 py-1 rounded-md shrink-0">
              {scannedItem?.styleCode}
            </span>

            {/* SKU Tag */}
            {scannedItem?.sku && (
              <span className="text-blue-400 font-mono font-bold text-xs bg-slate-950 border border-slate-800 px-2 py-1 rounded-md shrink-0">
                SKU: {scannedItem.sku}
              </span>
            )}
          </div>
        </div>

        {/* Product Names */}
        <div className="space-y-0.5 pt-1">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {scannedItem?.styleName}
          </h2>
          <p className="text-xs text-slate-400 uppercase font-medium">
            {scannedItem?.description}
          </p>
        </div>

        {/* 2x2 Details Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
            <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
              CATEGORY
            </p>
            <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
              {scannedItem?.category || "-"}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
            <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
              DEPARTMENT
            </p>
            <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
              {scannedItem?.department || "-"}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
            <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
              COLOR
            </p>
            <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
              {scannedItem?.color || "-"}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
            <p className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
              SIZE
            </p>
            <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
              {scannedItem?.size || "-"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => setIsScannerPaused(false)}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            Scan Next
          </button>
          <button
            onClick={() => setScannedItem(null)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Bottom Camera Toggle */}
      <div className="text-center py-3">
        <button className="text-xs font-medium text-slate-400 hover:text-white transition">
          Close Camera View
        </button>
      </div>
    </div>
  );
}