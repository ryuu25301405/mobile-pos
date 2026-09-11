'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
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

interface RawLogItem {
  id: string;
  store: string;
  styleCode: string;
  sku: string;
  styleName: string;
  description: string;
  color: string;
  category: string;
  department: string;
  size: string;
  price: number;
  quantity: number;
  rawTimestamp: string;
  timestamp: string;
}

interface GroupedProduct extends RawLogItem {
  scanCount: number;
}

type GroupByOption = "store_style" | "category" | "department" | "none";
type SortOption = "newest" | "oldest" | "qty_desc" | "qty_asc" | "name_asc";

export default function ScanViewPage() {
  const [rawLogs, setRawLogs] = useState<RawLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState("All Stores");

  // Date Filter States
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Grouping & Sorting States
  const [groupBy, setGroupBy] = useState<GroupByOption>("store_style");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

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
      const logs: RawLogItem[] = data.map((item: any) => ({
        id: item.id ? String(item.id) : `${item.style_code}-${Math.random()}`,
        store: item.store || "Unassigned Store",
        styleCode: item.style_code || "N/A",
        sku: item.sku || "-",
        styleName: item.style_name || "Unassigned Item",
        description: item.description || "",
        color: item.color || "-",
        category: item.category || "-",
        department: item.department || "-",
        size: item.size || "-",
        price: Number(item.price) || 0,
        quantity: item.quantity || 1,
        rawTimestamp: item.scanned_at || "",
        timestamp: formatTimestamp(item.scanned_at),
      }));

      setRawLogs(logs);
    }
    setLoading(false);
  }, [selectedStoreFilter]);

  useEffect(() => {
    fetchScannedLogs();
  }, [fetchScannedLogs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStoreFilter, startDate, endDate, groupBy, sortBy, itemsPerPage]);

  const handleRemoveItem = async (itemToRemove: GroupedProduct) => {
    setRawLogs((prev) => prev.filter((item) => item.id !== itemToRemove.id));

    if (groupBy === "none") {
      await supabase.from("scanned_logs").delete().eq("id", itemToRemove.id);
    } else {
      await supabase
        .from("scanned_logs")
        .delete()
        .eq("store", itemToRemove.store)
        .eq("style_code", itemToRemove.styleCode);
    }
  };

  const handlePresetDate = (type: "today" | "7days" | "month" | "clear") => {
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (type === "today") {
      const todayStr = formatDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(formatDate(past));
      setEndDate(formatDate(now));
    } else if (type === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(now));
    } else if (type === "clear") {
      setStartDate("");
      setEndDate("");
    }
  };

  const filteredRawLogs = useMemo(() => {
    return rawLogs.filter((item) => {
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        item.styleCode.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.styleName.toLowerCase().includes(q) ||
        item.store.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (startDate || endDate) {
        if (!item.rawTimestamp) return false;

        const itemDate = new Date(item.rawTimestamp);
        itemDate.setHours(0, 0, 0, 0);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) return false;
        }
      }

      return true;
    });
  }, [rawLogs, searchQuery, startDate, endDate]);

  const metrics = useMemo(() => {
    const totalUnits = filteredRawLogs.reduce((acc, log) => acc + log.quantity, 0);
    const uniqueStyles = new Set(filteredRawLogs.map((log) => log.styleCode)).size;

    const categoryCounts: Record<string, number> = {};
    filteredRawLogs.forEach((log) => {
      const cat = log.category !== "-" ? log.category : "Unassigned";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + log.quantity;
    });
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0] || ["N/A", 0];

    const storeCounts: Record<string, number> = {};
    filteredRawLogs.forEach((log) => {
      storeCounts[log.store] = (storeCounts[log.store] || 0) + log.quantity;
    });
    const topStore = Object.entries(storeCounts).sort((a, b) => b[1] - a[1])[0] || ["N/A", 0];

    return {
      totalUnits,
      uniqueStyles,
      topCategoryName: topCategory[0],
      topCategoryQty: topCategory[1],
      topStoreName: topStore[0],
      topStoreQty: topStore[1],
    };
  }, [filteredRawLogs]);

  const groupedItems = useMemo(() => {
    if (groupBy === "none") {
      return filteredRawLogs.map((log) => ({
        ...log,
        scanCount: 1,
      }));
    }

    const groupedMap = new Map<string, GroupedProduct>();

    filteredRawLogs.forEach((item) => {
      let groupKey = "";

      if (groupBy === "store_style") {
        groupKey = `${item.store}|${item.styleCode}|${item.sku}|${item.color}|${item.size}`;
      } else if (groupBy === "category") {
        groupKey = `${item.store}|${item.category}|${item.styleCode}`;
      } else if (groupBy === "department") {
        groupKey = `${item.store}|${item.department}|${item.styleCode}`;
      }

      if (groupedMap.has(groupKey)) {
        const existing = groupedMap.get(groupKey)!;
        existing.quantity += item.quantity;
        existing.scanCount += 1;
        if (new Date(item.rawTimestamp) > new Date(existing.rawTimestamp)) {
          existing.rawTimestamp = item.rawTimestamp;
          existing.timestamp = item.timestamp;
        }
      } else {
        groupedMap.set(groupKey, {
          ...item,
          scanCount: 1,
        });
      }
    });

    return Array.from(groupedMap.values());
  }, [filteredRawLogs, groupBy]);

  const processedItems = useMemo(() => {
    const list = [...groupedItems];

    return list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.rawTimestamp).getTime() - new Date(a.rawTimestamp).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime();
      }
      if (sortBy === "qty_desc") {
        return b.quantity - a.quantity;
      }
      if (sortBy === "qty_asc") {
        return a.quantity - b.quantity;
      }
      if (sortBy === "name_asc") {
        return a.styleName.localeCompare(b.styleName);
      }
      return 0;
    });
  }, [groupedItems, sortBy]);

  const totalPages = Math.ceil(processedItems.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, processedItems.length);
  const paginatedItems = useMemo(() => {
    return processedItems.slice(startIndex, endIndex);
  }, [processedItems, startIndex, endIndex]);

  const handleExport = (format: "xlsx" | "xls" | "csv") => {
    if (processedItems.length === 0) return;

    const exportData = processedItems.map((item) => ({
      "Store Location": item.store,
      "Style Code": item.styleCode,
      "SKU": item.sku,
      "Style Name": item.styleName,
      "Description": item.description,
      "Category": item.category,
      "Department": item.department,
      "Color": item.color,
      "Size": item.size,
      "Price": item.price,
      "Quantity": item.quantity,
      "Total Scan Logs": item.scanCount,
      "Timestamp": item.timestamp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Scanned Logs");

    const storeLabel = selectedStoreFilter === "All Stores" ? "All_Stores" : selectedStoreFilter.replace(/\s+/g, "_");
    const dateRangeLabel = startDate && endDate ? `_${startDate}_to_${endDate}` : "";
    const fileName = `Scanned_Logs_${storeLabel}${dateRangeLabel}.${format}`;

    if (format === "csv") {
      XLSX.writeFile(workbook, fileName, { bookType: "csv" });
    } else if (format === "xls") {
      XLSX.writeFile(workbook, fileName, { bookType: "biff8" });
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: "xlsx" });
    }

    setIsExportOpen(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-[1600px] mx-auto antialiased space-y-5">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Desktop Workspace
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Total Records: {rawLogs.length}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            Scanned Inventory & Database Management
          </h1>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Direct Navigation Button to Daily Sales Report */}
          <Link
            href="/reports/daily-sales"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 transition border border-indigo-500/30 shadow-lg shadow-indigo-600/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Daily Sales Report</span>
          </Link>

          <button
            onClick={fetchScannedLogs}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 transition border border-slate-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>

          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={processedItems.length === 0}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 transition shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export Report</span>
            </button>

            {isExportOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">File Format</p>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition flex items-center justify-between"
                >
                  <span>Excel Workbook</span>
                  <span className="text-[10px] text-emerald-400 font-mono">.XLSX</span>
                </button>
                <button
                  onClick={() => handleExport("xls")}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition flex items-center justify-between"
                >
                  <span>Legacy Excel</span>
                  <span className="text-[10px] text-emerald-400 font-mono">.XLS</span>
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition flex items-center justify-between"
                >
                  <span>CSV File</span>
                  <span className="text-[10px] text-emerald-400 font-mono">.CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Summary KPI Ribbon */}
      <section className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Volume</p>
            <p className="text-2xl font-black text-white mt-0.5">{metrics.totalUnits} <span className="text-xs text-emerald-400 font-bold">units</span></p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unique QR Codes</p>
            <p className="text-2xl font-black text-white mt-0.5">{metrics.uniqueStyles} <span className="text-xs text-blue-400 font-bold">styles</span></p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Category</p>
            <p className="text-lg font-black text-white truncate max-w-[160px] mt-0.5">{metrics.topCategoryName}</p>
            <p className="text-[10px] text-purple-400 font-bold">{metrics.topCategoryQty} pcs logged</p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 11h.01M7 15h.01M11 7h.01M11 11h.01M11 15h.01M15 7h.01M15 11h.01M15 15h.01" /></svg>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Store Volume</p>
            <p className="text-lg font-black text-white truncate max-w-[160px] mt-0.5">{metrics.topStoreName}</p>
            <p className="text-[10px] text-amber-400 font-bold">{metrics.topStoreQty} pcs logged</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
        </div>
      </section>

      {/* Desktop Horizontal Control Bar */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3 grid grid-cols-12 gap-3 items-center sticky top-2 z-40 shadow-xl backdrop-blur-md">
        {/* Search */}
        <div className="col-span-4 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search code, SKU, product, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Store Filter */}
        <div className="col-span-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center">
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="w-full bg-transparent text-xs font-bold text-emerald-400 focus:outline-none cursor-pointer"
          >
            {STORES.map((store) => (
              <option key={store} value={store} className="bg-slate-900 text-white font-normal">
                {store}
              </option>
            ))}
          </select>
        </div>

        {/* Grouping */}
        <div className="col-span-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="w-full bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="store_style">Group: Store + QR Code</option>
            <option value="category">Group: Category</option>
            <option value="department">Group: Department</option>
            <option value="none">Group: None (Raw Entries)</option>
          </select>
        </div>

        {/* Sorting */}
        <div className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="qty_desc">Sort: Highest Qty</option>
            <option value="qty_asc">Sort: Lowest Qty</option>
            <option value="name_asc">Sort: Product A-Z</option>
          </select>
        </div>
      </section>

      {/* Desktop Date Bar */}
      <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Date Range:</span>
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-bold focus:outline-none cursor-pointer scheme-dark"
            />
          </div>
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-bold focus:outline-none cursor-pointer scheme-dark"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={() => handlePresetDate("today")} className="text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-lg transition">Today</button>
          <button onClick={() => handlePresetDate("7days")} className="text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-lg transition">Last 7 Days</button>
          <button onClick={() => handlePresetDate("month")} className="text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-lg transition">This Month</button>
          {(startDate || endDate) && (
            <button onClick={() => handlePresetDate("clear")} className="text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg transition">Reset</button>
          )}
        </div>
      </section>

      {/* Main Data Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading database items...</p>
          </div>
        ) : processedItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-bold text-white">No entries match your search filters.</p>
            <p className="text-xs text-slate-500">Try adjusting your date range, store filter, or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Store Location</th>
                  <th className="py-3 px-4">Style Code</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category / Dept</th>
                  <th className="py-3 px-4">Color / Size</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Last Scanned</th>
                  <th className="py-3 px-4 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paginatedItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/40 transition ${index % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/90"}`}
                  >
                    <td className="py-3 px-4 font-semibold text-emerald-400">
                      {item.store}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {item.styleCode}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                      {item.sku}
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-xs truncate">
                      {item.styleName}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.category !== "-" ? item.category : item.department}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.color !== "-" ? item.color : ""}{item.size !== "-" ? ` / ${item.size}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ₱{item.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-block">
                        {item.quantity} pcs
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400 text-[11px]">
                      {item.timestamp}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleRemoveItem(item)}
                        className="text-slate-500 hover:text-red-400 transition p-1 rounded-md hover:bg-slate-800 cursor-pointer"
                        title="Delete Item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {processedItems.length > 0 && (
          <div className="bg-slate-950 border-t border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-xs text-slate-400 font-medium">
                Showing <span className="text-white font-bold">{startIndex + 1}</span> to{" "}
                <span className="text-white font-bold">{endIndex}</span> of{" "}
                <span className="text-white font-bold">{processedItems.length}</span> entries
              </span>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400 font-mono px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}