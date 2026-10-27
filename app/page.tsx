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

  // Network & Offline Queue State
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  // Transaction Mode & Continuous Batch Scan State
  const [transactionMode, setTransactionMode] = useState<TransactionMode>("sales");
  const [continuousMode, setContinuousMode] = useState<boolean>(false);

  const [scanning, setScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reconcile state
  const [reconciling, setReconciling] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);

  // Session Summary Modal State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

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

  // Monitor Network Connectivity & Sync Queue
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const savedQueue = localStorage.getItem("pos_offline_queue");
    if (savedQueue) {
      try {
        const queue = JSON.parse(savedQueue);
        setOfflineQueueCount(queue.length);
      } catch (e) {
        console.error("Error reading offline queue", e);
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncOfflineQueue = async () => {
    const savedQueue = localStorage.getItem("pos_offline_queue");
    if (!savedQueue) return;

    try {
      const queue = JSON.parse(savedQueue);
      if (queue.length === 0) return;

      setLoading(true);
      for (const task of queue) {
        if (task.type === "log") {
          await supabase.from("scanned_logs").insert([task.payload]);
        } else if (task.type === "inventory_update" || task.type === "inventory_reconcile") {
          await supabase
            .from("store_inventory")
            .update(task.payload.updateData)
            .eq("id", task.payload.id);
        }
      }

      localStorage.removeItem("pos_offline_queue");
      setOfflineQueueCount(0);
      console.log("Successfully synced offline queue to Supabase!");
    } catch (err) {
      console.error("Failed to sync offline queue:", err);
    } finally {
      setLoading(false);
    }
  };

  const queueOfflineTask = (task: { type: string; payload: any }) => {
    try {
      const savedQueue = localStorage.getItem("pos_offline_queue");
      const queue = savedQueue ? JSON.parse(savedQueue) : [];
      queue.push(task);
      localStorage.setItem("pos_offline_queue", JSON.stringify(queue));
      setOfflineQueueCount(queue.length);
    } catch (err) {
      console.error("Failed to save offline task", err);
    }
  };

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

  const getConsolidatedSummary = () => {
    const map = new Map<string, { styleName: string; styleCode: string; sku?: string; price: number; totalQty: number; mode: string }>();
    for (const item of sessionScans) {
      const key = `${item.styleCode}-${item.mode}`;
      if (map.has(key)) {
        map.get(key)!.totalQty += item.quantity;
      } else {
        map.set(key, {
          styleName: item.styleName,
          styleCode: item.styleCode,
          sku: item.sku,
          price: item.price,
          totalQty: item.quantity,
          mode: item.mode,
        });
      }
    }
    return Array.from(map.values());
  };

  const handleExportCSV = () => {
    const summary = getConsolidatedSummary();
    if (summary.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Store,Transaction Mode,Style Code,SKU,Style Name,Price (PHP),Total Scanned Quantity\n";

    summary.forEach((item) => {
      const row = [
        `"${selectedStore}"`,
        `"${item.mode.toUpperCase()}"`,
        `"${item.styleCode}"`,
        `"${item.sku || '-'}"`,
        `"${item.styleName.replace(/"/g, '""')}"`,
        item.price.toFixed(2),
        item.totalQty,
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `session_summary_${selectedStore.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReconcileStock = async (targetQty: number) => {
    if (!lastScannedItem) return;
    setReconciling(true);
    setReconcileSuccess(null);

    try {
      const cleanStyle = lastScannedItem.styleCode?.trim() || "";
      const cleanSku = lastScannedItem.sku !== "-" ? lastScannedItem.sku?.trim() : "";

      const updatePayload = {
        current_stock: targetQty,
        last_replenished_at: new Date().toISOString(),
      };

      if (!isOnline) {
        queueOfflineTask({
          type: "inventory_reconcile",
          payload: { store: selectedStore, styleCode: cleanStyle, updateData: updatePayload }
        });
        setStockAlert((prev) => prev ? { ...prev, remainingStock: targetQty } : null);
        setReconcileSuccess(`Stock updated locally (Offline) to ${targetQty} pcs!`);
        setReconciling(false);
        return;
      }

      let invQuery = supabase
        .from("store_inventory")
        .select("id")
        .eq("store", selectedStore);

      if (cleanStyle) {
        invQuery = invQuery.eq("style_code", cleanStyle);
      } else if (cleanSku) {
        invQuery = invQuery.eq("sku", cleanSku);
      }

      const { data: invData } = await invQuery.maybeSingle();

      if (invData) {
        const { error } = await supabase
          .from("store_inventory")
          .update(updatePayload)
          .eq("id", invData.id);

        if (error) throw error;
      } else {
        await supabase.from("store_inventory").insert([
          {
            store: selectedStore,
            style_code: cleanStyle,
            sku: cleanSku || null,
            initial_stock: targetQty,
            current_stock: targetQty,
            safety_stock: 5,
            last_replenished_at: new Date().toISOString(),
          },
        ]);
      }

      setStockAlert((prev) => prev ? { ...prev, remainingStock: targetQty } : null);
      setReconcileSuccess(`Stock updated to ${targetQty} pcs!`);
    } catch (err: any) {
      alert("Failed to update stock: " + (err?.message || "Error occurred"));
    } finally {
      setReconciling(false);
    }
  };

  const handleScan = async (scannedBarcode: string) => {
    setIsPaused(true);
    setLoading(true);
    setErrorMessage(null);
    setStockAlert(null);
    setReconcileSuccess(null);

    const cleanCode = scannedBarcode.trim().replace(/[\r\n]+/g, "");

    let data: any = null;
    let error: any = null;

    if (isOnline) {
      const res1 = await supabase
        .from("products")
        .select("*")
        .eq("barcode", cleanCode)
        .maybeSingle();
      data = res1.data;
      error = res1.error;

      if (!data) {
        const res2 = await supabase
          .from("products")
          .select("*")
          .ilike("style_code", cleanCode)
          .maybeSingle();
        data = res2.data;
      }

      if (!data) {
        const res3 = await supabase
          .from("products")
          .select("*")
          .ilike("sku", cleanCode)
          .maybeSingle();
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
      setErrorMessage(`Code "${cleanCode}" not found or offline.`);
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

    if (isOnline) {
      try {
        let invQuery = supabase
          .from("store_inventory")
          .select("*")
          .eq("store", selectedStore);

        if (cleanStyle) invQuery = invQuery.eq("style_code", cleanStyle);
        else if (cleanSku) invQuery = invQuery.eq("sku", cleanSku);

        const { data: invData } = await invQuery.maybeSingle();

        if (invData) {
          const currentStock = Number(invData.current_stock) || 0;
          const currentPullOut = Number(invData.pull_out) || 0;
          const currentTotalSold = Number(invData.total_sold) || 0;

          // Safely preserve all current metrics so they never reset to 0
          const updatePayload: Record<string, any> = {
            current_stock: currentStock,
            pull_out: currentPullOut,
            total_sold: currentTotalSold,
          };

          if (transactionMode === "sales") {
            updatePayload.current_stock = Math.max(0, currentStock - 1);
            updatePayload.total_sold = currentTotalSold + 1;
          } else if (transactionMode === "pull_out") {
            updatePayload.current_stock = Math.max(0, currentStock - 1);
            updatePayload.pull_out = currentPullOut + 1;
            updatePayload.last_replenished_at = now.toISOString();
          } else if (transactionMode === "delivery") {
            updatePayload.current_stock = currentStock + 1;
            updatePayload.last_replenished_at = now.toISOString();
          }

          await supabase
            .from("store_inventory")
            .update(updatePayload)
            .eq("id", invData.id);

          const remaining = updatePayload.current_stock;
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

      const logPayload = {
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
      };

      await supabase.from("scanned_logs").insert([logPayload]);
    } else {
      queueOfflineTask({
        type: "log",
        payload: {
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
        }
      });
      setStockAlert({ type: "normal", remainingStock: 0, safetyStock: 5 });
    }

    setLoading(false);

    if (continuousMode) {
      setTimeout(() => {
        handleScanNext();
      }, 1500);
    }
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
    setReconcileSuccess(null);
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
      <header className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Mobile Terminal
              </span>
              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isOnline 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {isOnline ? "🟢 Online" : `🔴 Offline (${offlineQueueCount} queued)`}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Barcode / QR Scanner
            </h1>
          </div>

          <button
            onClick={handleOpenScanner}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition active:scale-95 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Scan Now</span>
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <option value="pull_out" className="text-white font-normal">🚚 Pull Out (Stock Removal)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              ⚡ Continuous Batch Mode
            </span>
            <p className="text-[11px] text-slate-400">
              {continuousMode ? "Active: Auto-resumes camera after success" : "Manual: Requires tapping 'Scan Next'"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setContinuousMode(!continuousMode)}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-md ${
              continuousMode 
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            {continuousMode ? "ENABLED ON" : "TURN ON"}
          </button>
        </div>
      </header>

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

          <div className="flex items-center space-x-3">
            {totalSessionItems > 0 && (
              <>
                <button
                  onClick={() => setIsSummaryModalOpen(true)}
                  className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1 rounded-lg transition shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  📊 View Summary
                </button>
                <button
                  onClick={clearCurrentSession}
                  className="text-[10px] text-slate-500 hover:text-red-400 font-bold transition cursor-pointer"
                >
                  Clear List
                </button>
              </>
            )}
          </div>
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
                      item.mode === 'delivery' ? 'bg-blue-500/20 text-blue-400' :
                      item.mode === 'pull_out' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      'bg-amber-500/20 text-amber-400'
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
                    className="text-slate-600 hover:text-red-400 text-xs font-bold p-1 transition cursor-pointer"
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

      {isSummaryModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  Confirmation Overview
                </span>
                <h2 className="text-lg font-black text-white mt-1">Session Summary</h2>
              </div>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-base p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <span>Store: <strong className="text-emerald-400">{selectedStore || "Not Set"}</strong></span>
                <span className="text-amber-400 font-bold uppercase">Mode: {transactionMode}</span>
              </div>

              {getConsolidatedSummary().map((summaryItem) => (
                <div key={`${summaryItem.styleCode}-${summaryItem.mode}`} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm">{summaryItem.styleName}</p>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        summaryItem.mode === 'sales' ? 'bg-emerald-500/20 text-emerald-400' :
                        summaryItem.mode === 'delivery' ? 'bg-blue-500/20 text-blue-400' :
                        summaryItem.mode === 'pull_out' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {summaryItem.mode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-emerald-400 font-bold">{summaryItem.styleCode}</span>
                      <span className="font-mono text-amber-400 font-bold">₱{summaryItem.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono font-black text-xs px-3 py-1 rounded-xl">
                      {summaryItem.totalQty} pcs
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleExportCSV}
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Confirm & Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Confirm & Open Scanner
              </button>
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="py-3 px-4 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs px-4">
              <span className="text-slate-400 font-medium">Store: <strong className="text-emerald-400">{selectedStore}</strong></span>
              <div className="flex items-center gap-2">
                {continuousMode && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold text-[9px]">
                    Continuous
                  </span>
                )}
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded uppercase text-[10px]">
                  Mode: {transactionMode}
                </span>
              </div>
            </div>

            <div className="relative aspect-square bg-black">
              <Scanner onScan={handleScan} isPaused={isPaused} />

              {loading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full border border-slate-800 backdrop-blur-md animate-pulse">
                  Verifying & Processing ({transactionMode.toUpperCase()})...
                </div>
              )}

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
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 mt-2 cursor-pointer"
                      >
                        + Add Manually & Register
                      </button>
                    </div>
                  ) : (
                    lastScannedItem && (
                      <div className="w-full space-y-3 my-auto text-left">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase">
                            ✓ {transactionMode.toUpperCase()} Processed {continuousMode && "(Auto-resuming...)"}
                          </span>
                          <span className="text-xs font-mono text-emerald-400 font-bold">
                            {lastScannedItem.styleCode}
                          </span>
                        </div>

                        {transactionMode === "audit" && stockAlert && (() => {
                          const systemStock = stockAlert.remainingStock;
                          const countedStock = getSessionCountForStyle(lastScannedItem.styleCode);
                          const variance = countedStock - systemStock;

                          return (
                            <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-3.5 space-y-2.5 shadow-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                                  Audit Stock Comparison
                                </span>
                                {reconcileSuccess && (
                                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                    ✓ {reconcileSuccess}
                                  </span>
                                )}
                              </div>

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

                              {variance !== 0 && !reconcileSuccess && (
                                <button
                                  type="button"
                                  disabled={reconciling}
                                  onClick={() => handleReconcileStock(countedStock)}
                                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                  {reconciling ? "Reconciling..." : `⚡ Reconcile Database to ${countedStock} pcs`}
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {transactionMode === "pull_out" && stockAlert && (
                          <div className="p-3 bg-slate-900 border border-rose-500/40 rounded-2xl flex items-center justify-between text-xs shadow-lg">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl font-bold text-sm">
                                🚚
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-rose-400 tracking-wider">
                                  Pull Out Stock Status
                                </p>
                                <p className="text-slate-300 text-[11px]">
                                  Deducted 1 unit from inventory
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Remaining Stock</span>
                              <span className="text-rose-400 font-mono font-black text-base">
                                {stockAlert.remainingStock} pcs
                              </span>
                            </div>
                          </div>
                        )}

                        {transactionMode !== "audit" && transactionMode !== "pull_out" && stockAlert && stockAlert.type === "out" && (
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

                        {transactionMode !== "audit" && transactionMode !== "pull_out" && stockAlert && stockAlert.type === "low" && (
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
                              Current Stock
                            </span>
                            <span className="text-emerald-400 font-mono font-extrabold text-sm truncate block">
                              {stockAlert ? `${stockAlert.remainingStock} pcs` : "N/A"}
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
                              Size / Color
                            </span>
                            <span className="text-slate-200 font-semibold truncate block">
                              {lastScannedItem.size} • {lastScannedItem.color}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  <div className="flex space-x-2 w-full pt-2 border-t border-slate-800">
                    <button
                      onClick={handleScanNext}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      Scan Next
                    </button>
                    <button
                      onClick={() => setScanning(false)}
                      className="py-3 px-4 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:text-white cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setScanning(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs border-t border-slate-700/60 cursor-pointer"
            >
              Close Camera View
            </button>
          </div>
        </div>
      )}

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
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {savingManual ? "Saving to Database..." : "Save & Process Scan"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="py-3 px-4 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:text-white cursor-pointer"
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