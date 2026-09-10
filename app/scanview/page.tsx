'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  styleName: string;
  description: string;
  color: string;
  category: string;
  department: string;
  size: string;
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
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

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
        styleName: item.style_name || "Unassigned Item",
        description: item.description || "",
        color: item.color || "-",
        category: item.category || "-",
        department: item.department || "-",
        size: item.size || "-",
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

  // Reset to Page 1 on control change
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

  // 1. Filter by Search Query & Date Range
  const filteredRawLogs = useMemo(() => {
    return rawLogs.filter((item) => {
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        item.styleCode.toLowerCase().includes(q) ||
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

  // 2. Apply Dynamic Grouping Logic
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
        groupKey = `${item.store}|${item.styleCode}|${item.color}|${item.size}`;
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

  // 3. Apply Dynamic Sorting Logic
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

  // 4. Pagination Calculations
  const totalPages = Math.ceil(processedItems.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, processedItems.length);
  const paginatedItems = useMemo(() => {
    return processedItems.slice(startIndex, endIndex);
  }, [processedItems, startIndex, endIndex]);

  // Export Handler
  const handleExport = (format: "xlsx" | "xls" | "csv") => {
    if (processedItems.length === 0) return;

    const exportData = processedItems.map((item) => ({
      "Store Location": item.store,
      "Style Code": item.styleCode,
      "Style Name": item.styleName,
      "Description": item.description,
      "Category": item.category,
      "Department": item.department,
      "Color": item.color,
      "Size": item.size,
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

  const totalSummedQuantity = processedItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 max-w-6xl mx-auto antialiased space-y-6">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            Database View
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Scanned Logs Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Filter, group, and sort database records across store locations
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={fetchScannedLogs}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 transition border border-slate-700/60"
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

      {/* Controls Bar */}
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

        {/* Total Summary */}
        <div className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between sm:justify-center space-x-2 text-center">
          <span className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Total Summed:</span>
          <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
            {totalSummedQuantity} Units ({processedItems.length} Rows)
          </span>
        </div>
      </div>

      {/* Grouping & Sorting Controls Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Group By Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center space-x-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
            Group By:
          </span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="w-full bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="store_style">Store Location + QR Code (Consolidated)</option>
            <option value="category">Category</option>
            <option value="department">Department</option>
            <option value="none">None (Individual Raw Logs)</option>
          </select>
        </div>

        {/* Sort By Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center space-x-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
            Sort By:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="qty_desc">Highest Quantity First</option>
            <option value="qty_asc">Lowest Quantity First</option>
            <option value="name_asc">Alphabetical (Product Name A-Z)</option>
          </select>
        </div>
      </div>

      {/* Date Filter Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Filter by Date Range</span>
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handlePresetDate("today")}
              className="text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={() => handlePresetDate("7days")}
              className="text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg transition"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handlePresetDate("month")}
              className="text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg transition"
            >
              This Month
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => handlePresetDate("clear")}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg transition"
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/60">
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-500 whitespace-nowrap">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-bold focus:outline-none w-full cursor-pointer scheme-dark"
            />
          </div>

          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-500 whitespace-nowrap">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-bold focus:outline-none w-full cursor-pointer scheme-dark"
            />
          </div>
        </div>
      </div>

      {/* Main Scanned Items List View */}
      <section>
        {loading ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading database logs...</p>
          </div>
        ) : processedItems.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-white">No logs found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No scanned records match your current criteria.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="hidden sm:grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 pb-2 border-b border-slate-800">
              <span className="col-span-3">Store Location</span>
              <span className="col-span-4">Product Details</span>
              <span className="col-span-2">Attributes</span>
              <span className="col-span-1 text-center">Qty</span>
              <span className="col-span-2 text-right">Timestamp</span>
            </div>

            <div className="space-y-2.5">
              {paginatedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition flex flex-col sm:grid sm:grid-cols-12 items-start sm:items-center gap-3 sm:gap-0"
                >
                  {/* Store Column */}
                  <div className="sm:col-span-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-block">
                      {item.store}
                    </span>
                  </div>

                  {/* Product Info Column */}
                  <div className="sm:col-span-4 space-y-0.5">
                    <p className="font-bold text-white text-sm leading-tight">{item.styleName}</p>
                    <p className="font-mono text-emerald-400 text-xs font-semibold">{item.styleCode}</p>
                  </div>

                  {/* Attributes Column */}
                  <div className="sm:col-span-2 flex flex-wrap gap-1 text-[10px]">
                    {item.category !== "-" && (
                      <span className="bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                        {item.category}
                      </span>
                    )}
                    {item.size !== "-" && (
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-bold">
                        Size: {item.size}
                      </span>
                    )}
                  </div>

                  {/* Quantity Column */}
                  <div className="sm:col-span-1 flex sm:justify-center items-center w-full sm:w-auto justify-between">
                    <span className="sm:hidden text-xs text-slate-500 font-bold">Qty:</span>
                    <div className="text-center">
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-sm px-3 py-1 rounded-full inline-block">
                        x{item.quantity}
                      </span>
                      {groupBy !== "none" && item.scanCount > 1 && (
                        <p className="text-[9px] text-slate-500 mt-0.5 font-medium">
                          ({item.scanCount} scans)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Timestamp & Delete Action */}
                  <div className="sm:col-span-2 flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto border-t sm:border-0 border-slate-800/80 pt-2 sm:pt-0">
                    <span className="text-[10px] font-mono text-slate-500">{item.timestamp}</span>
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="text-slate-600 hover:text-red-400 p-1 text-xs font-bold transition"
                      title="Delete entry"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls Footer */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Entries Info & Per-Page Selector */}
              <div className="flex items-center space-x-4 text-xs text-slate-400">
                <span>
                  Showing <strong className="text-white">{processedItems.length === 0 ? 0 : startIndex + 1}</strong> to{" "}
                  <strong className="text-white">{endIndex}</strong> of <strong className="text-white">{processedItems.length}</strong> entries
                </span>

                <div className="flex items-center space-x-1.5">
                  <label htmlFor="perPage" className="text-[10px] font-bold uppercase text-slate-500">Per page:</label>
                  <select
                    id="perPage"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Page Navigation Buttons */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition"
                  title="First Page"
                >
                  «
                </button>

                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition"
                >
                  Prev
                </button>

                <span className="text-xs font-bold text-slate-300 px-2">
                  Page <span className="text-emerald-400">{currentPage}</span> of <span className="text-white">{totalPages}</span>
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition"
                >
                  Next
                </button>

                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition"
                  title="Last Page"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}