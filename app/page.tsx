'use client';

import { useState, useEffect } from "react";
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

type TransactionMode = "sales" | "audit" | "delivery" | "pull_out";

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

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const [transactionMode, setTransactionMode] = useState<TransactionMode>("sales");
  const [continuousMode, setContinuousMode] = useState<boolean>(false);

  const [scanning, setScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [reconciling, setReconciling] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);

  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
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

  const [sessionScans, setSessionScans] = useState<SessionScannedProduct[]>([]);
  const [lastScannedItem, setLastScannedItem] = useState<ProductDetails | null>(null);
  const [stockAlert, setStockAlert] = useState<StockAlertInfo | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
    setReconcileSuccess(null);
  };

  const handleConfirmStore = () => {
    if (!tempStore) return;
    setSelectedStore(tempStore);
    setIsStoreModalOpen(false);
    setScanning(true);
    setIsPaused(false);
    setErrorMessage(null);
    setStockAlert(null);
    setReconcileSuccess(null);
  };

  const getSessionCountForStyle = (code: string) => {
    return sessionScans
      .filter((s) => s.styleCode === code && s.store === selectedStore)
      .reduce((acc, curr) => acc + curr.quantity, 0);
  };

  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);
    setErrorMessage(null);
    setStockAlert(null);
    setReconcileSuccess(null);

    const cleanCode = scannedBarcode.trim().replace(/[\r\n]+/g, "");

    let data: any = null;
    if (isOnline) {
      const res1 = await supabase.from("products").select("*").eq("barcode", cleanCode).maybeSingle();
      data = res1.data;
      if (!data) {
        const res2 = await supabase.from("products").select("*").ilike("style_code", cleanCode).maybeSingle();
        data = res2.data;
      }
      if (!data) {
        const res3 = await supabase.from("products").select("*").ilike("sku", cleanCode).maybeSingle();
        data = res3.data;
      }
    }

    if (!data) {
      setLoading(false);
      triggerScanFeedback("error");
      setManualCode(cleanCode);
      setManualForm((prev) => ({
        ...prev,
        styleCode: cleanCode,
        sku: cleanCode,
        styleName: `Item ${cleanCode}`,
      }));
      setErrorMessage(`Code "${cleanCode}" not found.`);
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

    setSessionScans((prev) => [
      {
        ...fetchedProduct,
        id: `${cleanCode}-${Date.now()}`,
        store: selectedStore,
        timestamp: formattedTimestamp,
        mode: transactionMode,
      },
      ...prev,
    ]);

    const cleanStyle = fetchedProduct.styleCode?.trim() || "";
    const cleanSku = fetchedProduct.sku !== "-" ? fetchedProduct.sku?.trim() : "";

    if (isOnline) {
      try {
        let invQuery = supabase.from("store_inventory").select("*").eq("store", selectedStore);
        if (cleanStyle) invQuery = invQuery.eq("style_code", cleanStyle);
        else if (cleanSku) invQuery = invQuery.eq("sku", cleanSku);

        const { data: invData } = await invQuery.maybeSingle();

        if (invData) {
          // Call atomic database function to update safely without touching other columns
          await supabase.rpc("increment_inventory", {
            row_id: invData.id,
            mode: transactionMode,
          });

          // Fetch updated stock for display
          const { data: refreshed } = await supabase
            .from("store_inventory")
            .select("current_stock, safety_stock")
            .eq("id", invData.id)
            .single();

          const remaining = refreshed ? refreshed.current_stock : 0;
          const safetyThreshold = Number(invData.safety_stock ?? 5);
          setStockAlert({
            type: remaining <= 0 ? "out" : remaining <= safetyThreshold ? "low" : "normal",
            remainingStock: remaining,
            safetyStock: safetyThreshold,
          });
        } else {
          await supabase.from("store_inventory").insert([
            {
              store: selectedStore,
              style_code: cleanStyle,
              sku: cleanSku || null,
              initial_stock: transactionMode === "delivery" ? 1 : 0,
              current_stock: transactionMode === "delivery" ? 1 : 0,
              pull_out: transactionMode === "pull_out" ? 1 : 0,
              total_sold: transactionMode === "sales" ? 1 : 0,
              safety_stock: 5,
              last_replenished_at: now.toISOString(),
            },
          ]);
          setStockAlert({ 
            type: transactionMode === "delivery" ? "normal" : "out", 
            remainingStock: transactionMode === "delivery" ? 1 : 0, 
            safetyStock: 5 
          });
        }
      } catch (err) {
        console.warn("Stock update error:", err);
      }

      await supabase.from("scanned_logs").insert([{
        store: selectedStore,
        transaction_mode: transactionMode,
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
      }]);
    }

    setLoading(false);
    if (continuousMode) {
      setTimeout(() => {
        handleScanNext();
      }, 1500);
    }
  };

  const handleScanNext = () => {
    setErrorMessage(null);
    setLastScannedItem(null);
    setStockAlert(null);
    setReconcileSuccess(null);
    setIsPaused(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 max-w-2xl mx-auto antialiased">
      <header className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Mobile Terminal
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">Barcode / QR Scanner</h1>
          </div>
          <button
            onClick={handleOpenScanner}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg"
          >
            Scan Now
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Store Location</label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-bold rounded-xl p-3 text-sm cursor-pointer"
              >
                <option value="" disabled>-- Select Store --</option>
                {STORES.map((store) => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Transaction Mode</label>
              <select
                value={transactionMode}
                onChange={(e) => setTransactionMode(e.target.value as TransactionMode)}
                className="w-full bg-slate-950 border border-slate-800 text-amber-400 font-bold rounded-xl p-3 text-sm cursor-pointer"
              >
                <option value="sales">🛍️ Sales (Checkout)</option>
                <option value="audit">📋 Audit (Stock Check)</option>
                <option value="delivery">📦 Delivery (Restock In)</option>
                <option value="pull_out">🚚 Pull Out (Stock Removal)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {scanning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs px-4">
              <span className="text-slate-400">Store: <strong className="text-emerald-400">{selectedStore}</strong></span>
              <span className="text-amber-400 uppercase font-bold text-[10px]">Mode: {transactionMode}</span>
            </div>

            <div className="relative aspect-square bg-black">
              <Scanner onScan={handleScan} isPaused={isPaused} />
              {loading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full animate-pulse">
                  Processing...
                </div>
              )}
              {isPaused && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center space-y-4">
                  <h3 className="text-base font-bold text-white">✓ {transactionMode.toUpperCase()} Processed Successfully!</h3>
                  <button
                    onClick={handleScanNext}
                    className="w-full py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Scan Next
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setScanning(false)}
              className="w-full py-3 bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
            >
              Close Camera View
            </button>
          </div>
        </div>
      )}
    </main>
  );
}