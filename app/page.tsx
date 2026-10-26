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

type TransactionMode = "sales" | "audit" | "delivery";

interface ProductDetails {
  styleCode: string;
  sku?: string;
  styleName: string;
  description: string;
  color: string;
  category: string;
  department: string;
  size: string;
  price: number;
  quantity: number;
  barcode?: string;
}

interface SessionScannedProduct extends ProductDetails {
  id: string;
  store: string;
  timestamp: string;
  mode: TransactionMode;
}

interface StockAlertInfo {
  type: "out" | "low" | "normal";
  remainingStock: number;
  safetyStock: number;
}

export default function Home() {
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [tempStore, setTempStore] = useState<string>("");
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Transaction Mode State
  const [transactionMode, setTransactionMode] = useState<TransactionMode>("sales");

  const [scanning, setScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual Add Product Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualForm, setManualForm] = useState({
    styleName: "",
    styleCode: "",
    sku: "",
    category: "UNDERWEAR",
    department: "MEN",
    color: "BLACK",
    size: "Free Size",
    price: "150.00",
    description: "Newly registered item",
  });
  const [savingManual, setSavingManual] = useState(false);

  // Local state for current active session scans
  const [sessionScans, setSessionScans] = useState<SessionScannedProduct[]>([]);
  const [lastScannedItem, setLastScannedItem] = useState<ProductDetails | null>(null);
  const [stockAlert, setStockAlert] = useState<StockAlertInfo | null>(null);

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
    setStockAlert(null);
  };

  // Confirm store selection from popup modal
  const handleConfirmStore = () => {
    if (!tempStore) return;
    setSelectedStore(tempStore);
    setIsStoreModalOpen(false);
    setScanning(true);
    setIsPaused(false);
    setErrorMessage(null);
    setStockAlert(null);
  };

  // Calculate total count for a specific style code scanned in the current session
  const getSessionCountForStyle = (code: string) => {
    return sessionScans
      .filter((s) => s.styleCode === code && s.store === selectedStore)
      .reduce((acc, curr) => acc + curr.quantity, 0);
  };

  // Handle scan with dynamic behavior based on Transaction Mode
  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);
    setErrorMessage(null);
    setStockAlert(null);

    const cleanCode = scannedBarcode.trim().replace(/[\r\n]+/g, "");

    // 1. Try matching exact barcode first
    let { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", cleanCode)
      .maybeSingle();

    // 2. If not found by barcode, try style_code
    if (!data) {
      const res = await supabase
        .from("products")
        .select("*")
        .ilike("style_code", cleanCode)
        .maybeSingle();
      data = res.data;
      error = res.error;
    }

    // 3. If still not found, try matching sku
    if (!data) {
      const res = await supabase
        .from("products")
        .select("*")
        .ilike("sku", cleanCode)
        .maybeSingle();
      data = res.data;
      error = res.error;
    }

    if (error || !data) {
      setLoading(false);
      triggerScanFeedback("error");
      setManualCode(cleanCode);
      setManualForm((prev) => ({
        ...prev,
        styleCode: cleanCode,
        sku: cleanCode,
        styleName: `Item ${cleanCode}`,
      }));
      setErrorMessage(`Code "${cleanCode}" not found in database.`);
      return;
    }

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
      price: Number(data.price) || 0,
      quantity: 1,
      barcode: data.barcode || cleanCode,
    };

    setLastScannedItem(fetchedProduct);

    const now = new Date();
    const formattedTimestamp = now.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const newSessionItem: SessionScannedProduct = {
      ...fetchedProduct,
      id: `${cleanCode}-${Date.now()}`,
      store: selectedStore,
      timestamp: formattedTimestamp,
      mode: transactionMode,
    };

    setSessionScans((prev) => [newSessionItem, ...prev]);

    const cleanStyle = fetchedProduct.styleCode?.trim() || "";
    const cleanSku = fetchedProduct.sku !== "-" ? fetchedProduct.sku?.trim() : "";

    // Handle database operations based on Transaction Mode
    if (transactionMode === "sales") {
      try {
        let invQuery = supabase
          .from("store_inventory")
          .select("id, current_stock, safety_stock")
          .eq("store", selectedStore);

        if (cleanStyle) {
          invQuery = invQuery.eq("style_code", cleanStyle);
        } else if (cleanSku) {
          invQuery = invQuery.eq("sku", cleanSku);
        }

        const { data: invData } = await invQuery.maybeSingle();

        if (invData) {
          const newCurrentStock = Math.max(0, Number(invData.current_stock) - 1);
          await supabase
            .from("store_inventory")
            .update({ current_stock: newCurrentStock })
            .eq("id", invData.id);

          const remaining = newCurrentStock;
          const safetyThreshold = Number(invData.safety_stock ?? 5);

          if (remaining <= 0) {
            setStockAlert({ type: "out", remainingStock: remaining, safetyStock: safetyThreshold });
          } else if (remaining <= safetyThreshold) {
            setStockAlert({ type: "low", remainingStock: remaining, safetyStock: safetyThreshold });
          } else {
            setStockAlert({ type: "normal", remainingStock: remaining, safetyStock: safetyThreshold });
          }
        }
      } catch (err) {
        console.warn("Could not update inventory for sale:", err);
      }

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
          price: fetchedProduct.price,
          quantity: 1,
          scanned_at: now.toISOString(),
        },
      ]);
    } else if (transactionMode === "delivery") {
      try {
        let invQuery = supabase
          .from("store_inventory")
          .select("*")
          .eq("store", selectedStore);

        if (cleanStyle) {
          invQuery = invQuery.eq("style_code", cleanStyle);
        } else if (cleanSku) {
          invQuery = invQuery.eq("sku", cleanSku);
        }

        const { data: existingInv } = await invQuery.maybeSingle();

        if (existingInv) {
          const newInitial = (Number(existingInv.initial_stock) || 0) + 1;
          const newCurrent = (Number(existingInv.current_stock) || 0) + 1;
          await supabase
            .from("store_inventory")
            .update({
              initial_stock: newInitial,
              current_stock: newCurrent,
              last_replenished_at: now.toISOString(),
            })
            .eq("id", existingInv.id);

          setStockAlert({ type: "normal", remainingStock: newCurrent, safetyStock: Number(existingInv.safety_stock ?? 5) });
        } else {
          await supabase.from("store_inventory").insert([
            {
              store: selectedStore,
              style_code: cleanStyle,
              sku: cleanSku || null,
              initial_stock: 1,
              current_stock: 1,
              safety_stock: 5,
              last_replenished_at: now.toISOString(),
            },
          ]);
          setStockAlert({ type: "normal", remainingStock: 1, safetyStock: 5 });
        }
      } catch (err) {
        console.warn("Could not process delivery restock:", err);
      }
    } else if (transactionMode === "audit") {
      try {
        let invQuery = supabase
          .from("store_inventory")
          .select("current_stock, safety_stock")
          .eq("store", selectedStore);

        if (cleanStyle) {
          invQuery = invQuery.eq("style_code", cleanStyle);
        } else if (cleanSku) {
          invQuery = invQuery.eq("sku", cleanSku);
        }

        const { data: invData } = await invQuery.maybeSingle();
        if (invData) {
          const remaining = Number(invData.current_stock);
          const safetyThreshold = Number(invData.safety_stock ?? 5);
          setStockAlert({ type: remaining <= safetyThreshold ? "low" : "normal", remainingStock: remaining, safetyStock: safetyThreshold });
        } else {
          setStockAlert({ type: "out", remainingStock: 0, safetyStock: 5 });
        }
      } catch (err) {
        console.warn("Could not check stock for audit:", err);
      }
    }

    setLoading(false);
  };

  const handleSaveManualProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingManual(true);

    const newProductPayload = {
      barcode: manualCode,
      style_code: manualForm.styleCode || manualCode,
      sku: manualForm.sku || manualCode,
      style_name: manualForm.styleName,
      description: manualForm.description,
      color: manualForm.color,
      category: manualForm.category,
      department: manualForm.department,
      size: manualForm.size,
      price: parseFloat(manualForm.price) || 0.0,
    };

    const { error } = await supabase.from("products").insert([newProductPayload]);

    setSavingManual(false);

    if (error) {
      alert("Failed to save product: " + error.message);
      return;
    }

    setIsManualModalOpen(false);
    setErrorMessage(null);
    await handleScan(manualCode);
  };

  const handleScanNext = () => {
    setErrorMessage(null);
    setLastScannedItem(null);
    setStockAlert(null);
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

        {/* Store Location & Transaction Mode Picker Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Store Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Store Location <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-bold rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" disabled className="text-slate-500">
                  -- Select Store --
                </option>
                {STORES.map((store) => (
                  <option key={store} value={store} className="text-white font-normal">
                    {store}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Mode Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Transaction Mode <span className="text-emerald-400">*</span>
              </label>
              <select
                value={transactionMode}
                onChange={(e) => setTransactionMode(e.target.value as TransactionMode)}
                className="w-full bg-slate-950 border border-slate-800 text-amber-400 font-bold rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="sales" className="text-white font-normal">🛍️ Sales (Checkout)</option>
                <option value="audit" className="text-white font-normal">📋 Audit (Stock Check)</option>
                <option value="delivery" className="text-white font-normal">📦 Delivery (Restock In)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Current Session Scanned Items View */}
      <section className="my-6 flex-1">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Current Session Scans ({transactionMode.toUpperCase()})
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
              Select your store and mode, then tap "Scan Now" to begin scanning.
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
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white text-sm leading-tight">{item.styleName}</p>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                      item.mode === 'sales' ? 'bg-emerald-500/20 text-emerald-400' :
                      item.mode === 'delivery' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {item.mode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 text-xs font-bold">{item.styleCode}</span>
                    {item.sku && item.sku !== "-" && (
                      <span className="font-mono text-blue-400 text-xs font-semibold">SKU: {item.sku}</span>
                    )}
                    <span className="font-mono text-amber-400 text-xs font-bold">
                      ₱{item.price.toFixed(2)}
                    </span>
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
              <span className="text-slate-400 font-medium">Store: <strong className="text-emerald-400">{selectedStore}</strong></span>
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded uppercase text-[10px]">
                Mode: {transactionMode}
              </span>
            </div>

            <div className="relative aspect-square bg-black">
              <Scanner onScan={handleScan} isPaused={isPaused} />

              {loading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full border border-slate-800 backdrop-blur-md animate-pulse">
                  Verifying & Processing ({transactionMode.toUpperCase()})...
                </div>
              )}

              {/* Detailed Scan Results Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-5 text-center space-y-3 overflow-y-auto">
                  {errorMessage ? (
                    <div className="space-y-3 my-auto">
                      <div className="w-14 h-14 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                        ✕
                      </div>
                      <h3 className="text-base font-bold text-white">Item Not Found</h3>
                      <p className="text-xs text-red-300/80 max-w-xs">{errorMessage}</p>

                      <button
                        onClick={() => setIsManualModalOpen(true)}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 mt-2"
                      >
                        + Add Manually & Register
                      </button>
                    </div>
                  ) : (
                    lastScannedItem && (
                      <div className="w-full space-y-3 my-auto text-left">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase">
                            ✓ {transactionMode.toUpperCase()} Processed
                          </span>
                          <span className="text-xs font-mono text-emerald-400 font-bold">
                            {lastScannedItem.styleCode}
                          </span>
                        </div>

                        {/* Audit Mode Side-by-Side Stock Comparison Card */}
                        {transactionMode === "audit" && stockAlert && (() => {
                          const systemStock = stockAlert.remainingStock;
                          const countedStock = getSessionCountForStyle(lastScannedItem.styleCode);
                          const variance = countedStock - systemStock;

                          return (
                            <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-3.5 space-y-2 shadow-xl">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                                Audit Stock Comparison
                              </span>
                              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">System</span>
                                  <span className="text-white font-bold text-base">{systemStock}</span>
                                </div>
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Counted</span>
                                  <span className="text-emerald-400 font-bold text-base">{countedStock}</span>
                                </div>
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Variance</span>
                                  <span className={`font-bold text-base ${
                                    variance === 0 ? 'text-emerald-400' : variance > 0 ? 'text-amber-400' : 'text-rose-400'
                                  }`}>
                                    {variance > 0 ? `+${variance}` : variance}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Standard Stock Alerts for Sales & Delivery Modes */}
                        {transactionMode !== "audit" && stockAlert && stockAlert.type === "out" && (
                          <div className="p-3 bg-rose-950/80 border border-rose-500 rounded-2xl flex items-center gap-3 text-xs shadow-lg shadow-rose-950/50">
                            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl font-black text-sm">
                              ⚠
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase text-rose-400 tracking-wider">
                                Depleted / Out of Stock
                              </p>
                              <p className="text-slate-200 text-[11px]">
                                Available stock is now <strong className="text-rose-400 font-bold">{stockAlert.remainingStock} pcs</strong>!
                              </p>
                            </div>
                          </div>
                        )}

                        {transactionMode !== "audit" && stockAlert && stockAlert.type === "low" && (
                          <div className="p-3 bg-amber-950/80 border border-amber-500 rounded-2xl flex items-center gap-3 text-xs shadow-lg shadow-amber-950/50">
                            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl font-black text-sm">
                              ⚠
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase text-amber-300 tracking-wider">
                                Low Stock Alert
                              </p>
                              <p className="text-slate-200 text-[11px]">
                                Only <strong className="text-amber-300 font-bold">{stockAlert.remainingStock} units</strong> left on shelf (Safety Level: {stockAlert.safetyStock} pcs).
                              </p>
                            </div>
                          </div>
                        )}

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

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              SKU
                            </span>
                            <span className="text-blue-400 font-mono font-bold text-sm truncate block">
                              {lastScannedItem.sku}
                            </span>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                              Price
                            </span>
                            <span className="text-amber-400 font-mono font-bold text-sm truncate block">
                              ₱{lastScannedItem.price.toFixed(2)}
                            </span>
                          </div>

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

      {/* Manual Product Registration Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div>
              <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                New Product Registration
              </span>
              <h2 className="text-lg font-black text-white mt-1">Add Unlisted Barcode</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Code: {manualCode}</p>
            </div>

            <form onSubmit={handleSaveManualProduct} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Product / Style Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.styleName}
                  onChange={(e) => setManualForm({ ...manualForm, styleName: e.target.value })}
                  placeholder="e.g. Classic Men Boxer Brief"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Style Code
                  </label>
                  <input
                    type="text"
                    value={manualForm.styleCode}
                    onChange={(e) => setManualForm({ ...manualForm, styleCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={manualForm.sku}
                    onChange={(e) => setManualForm({ ...manualForm, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={manualForm.department}
                    onChange={(e) => setManualForm({ ...manualForm, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={manualForm.category}
                    onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={manualForm.color}
                    onChange={(e) => setManualForm({ ...manualForm, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Size
                  </label>
                  <input
                    type="text"
                    value={manualForm.size}
                    onChange={(e) => setManualForm({ ...manualForm, size: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualForm.price}
                    onChange={(e) => setManualForm({ ...manualForm, price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-3">
                <button
                  type="submit"
                  disabled={savingManual}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {savingManual ? "Saving to Database..." : "Save & Process Scan"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="py-3 px-4 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="text-center py-2 text-[10px] text-slate-600 tracking-wider uppercase">
        Active Session Log ({transactionMode})
      </footer>
    </main>
  );
}