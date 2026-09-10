'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const dynamic = 'force-dynamic';

const STORES = [
  "All Stores",
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

interface ScannedProduct {
  id: string;
  store: string;
  styleCode: string;
  styleName: string;
  description: string;
  color: string;
  category: string;
  department: string;
  size: string;
  quantity: number;
  timestamp: string;
}

export default function ScanViewPage() {
  const [scannedItems, setScannedItems] = useState<ScannedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState("All Stores");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return "N/A";
    const rawDate = new Date(isoString);
    return rawDate.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "short",
      timeStyle: "medium",
    });
  };

  const fetchScannedLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("scanned_logs")
      .select("*")
      .order("scanned_at", { ascending: false });

    if (selectedStoreFilter !== "All Stores") {
      query = query.eq("store", selectedStoreFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      const formattedData: ScannedProduct[] = data.map((item: any) => ({
        id: item.id ? String(item.id) : `${item.style_code}-${Math.random()}`,
        store: item.store || "Unassigned Store",
        styleCode: item.style_code || "N/A",
        styleName: item.style_name || "Unassigned Item",
        description: item.description || "",
        color: item.color || "-",
        category: item.category || "-",
        department: item.department || "-",
        size: item.size || "-",
        quantity: item.quantity || 1,
        timestamp: formatTimestamp(item.scanned_at),
      }));

      setScannedItems(formattedData);
    }
    setLoading(false);
  }, [selectedStoreFilter]);

  useEffect(() => {
    fetchScannedLogs();
  }, [fetchScannedLogs]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRemoveItem = async (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
    await supabase.from("scanned_logs").delete().eq("id", id);
  };

  // Filter items by search input
  const filteredItems = scannedItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.styleCode.toLowerCase().includes(q) ||
      item.styleName.toLowerCase().includes(q) ||
      item.store.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.department.toLowerCase().includes(q)
    );
  });

  // Export Data Handler
  const handleExport = (format: "xlsx" | "xls" | "csv") => {
    if (filteredItems.length === 0) return;

    // Map dataset for spreadsheet columns
    const exportData = filteredItems.map((item) => ({
      "Store Location": item.store,
      "Style Code": item.styleCode,
      "Style Name": item.styleName,
      "Description": item.description,
      "Category": item.category,
      "Department": item.department,
      "Color": item.color,
      "Size": item.size,
      "Quantity": item.quantity,
      "Scanned At": item.timestamp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Scanned Logs");

    const storeLabel = selectedStoreFilter === "All Stores" ? "All_Stores" : selectedStoreFilter.replace(/\s+/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `Scanned_Logs_${storeLabel}_${dateStr}.${format}`;

    if (format === "csv") {
      XLSX.writeFile(workbook, fileName, { bookType: "csv" });
    } else if (format === "xls") {
      XLSX.writeFile(workbook, fileName, { bookType: "biff8" });
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: "xlsx" });
    }

    setIsExportOpen(false);
  };

  const totalLogs = filteredItems.length;
  const totalQuantity = filteredItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 max-w-6xl mx-auto antialiased space-y-6">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            Database View
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Scanned Logs History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Live database records from all store scanning activity
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            onClick={fetchScannedLogs}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 transition border border-slate-700/60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>

          {/* Export Menu Dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={filteredItems.length === 0}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 transition shadow-lg shadow-emerald-500/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export</span>
            </button>

            {isExportOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">Select Format</p>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 hover:bg-slate-800/80 rounded-xl transition flex items-center justify-between"
                >
                  <span>Excel (.xlsx)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">XLSX</span>
                </button>
                <button
                  onClick={() => handleExport("xls")}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 hover:bg-slate-800/80 rounded-xl transition flex items-center justify-between"
                >
                  <span>Excel Legacy (.xls)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">XLS</span>
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 hover:bg-slate-800/80 rounded-xl transition flex items-center justify-between"
                >
                  <span>CSV File (.csv)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Controls & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search Input */}
        <div className="sm:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by code, product name, or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Store Location Filter */}
        <div className="sm:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-2 flex items-center">
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="w-full bg-transparent text-xs font-bold text-emerald-400 px-3 py-1 focus:outline-none cursor-pointer"
          >
            {STORES.map((store) => (
              <option key={store} value={store} className="bg-slate-900 text-white font-normal">
                {store === "All Stores" ? "Filter by Store: All Stores" : store}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Stat */}
        <div className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between sm:justify-center space-x-2 text-center">
          <span className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Total Items:</span>
          <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
            {totalQuantity} Units ({totalLogs} Logs)
          </span>
        </div>
      </div>

      {/* Main Scanned Items List View */}
      <section>
        {loading ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading database logs...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-white">No logs found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No scanned records match your filter criteria.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3">
            <div className="hidden sm:grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 pb-2 border-b border-slate-800">
              <span className="col-span-3">Store Location</span>
              <span className="col-span-4">Product Details</span>
              <span className="col-span-2">Attributes</span>
              <span className="col-span-1 text-center">Qty</span>
              <span className="col-span-2 text-right">Timestamp</span>
            </div>

            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition flex flex-col sm:grid sm:grid-cols-12 items-start sm:items-center gap-3 sm:gap-0"
                >
                  <div className="sm:col-span-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-block">
                      {item.store}
                    </span>
                  </div>

                  <div className="sm:col-span-4 space-y-0.5">
                    <p className="font-bold text-white text-sm leading-tight">{item.styleName}</p>
                    <p className="font-mono text-emerald-400 text-xs font-semibold">{item.styleCode}</p>
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap gap-1 text-[10px]">
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
                  </div>

                  <div className="sm:col-span-1 flex sm:justify-center items-center w-full sm:w-auto justify-between">
                    <span className="sm:hidden text-xs text-slate-500 font-bold">Quantity:</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-xs px-2.5 py-0.5 rounded-full">
                      x{item.quantity}
                    </span>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto border-t sm:border-0 border-slate-800/80 pt-2 sm:pt-0">
                    <span className="text-[10px] font-mono text-slate-500">{item.timestamp}</span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-600 hover:text-red-400 p-1 text-xs font-bold transition"
                      title="Delete log"
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
    </main>
  );
}