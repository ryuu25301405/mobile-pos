"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  Boxes,
  Store,
  Search,
  PlusCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ScanBarcode,
  BarChart3,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  SlidersHorizontal,
  RotateCcw,
  DollarSign,
  Hash,
} from "lucide-react";

interface StoreInventoryItem {
  id: string;
  store: string;
  style_code: string;
  sku: string | null;
  initial_stock: number;
  current_stock: number;
  safety_stock: number;
  last_replenished_at: string;
  total_out: number;
  price?: number;
  style_name?: string;
  color?: string;
  size?: string;
  department?: string;
  description?: string;
}

interface BulkImportItem {
  store: string;
  style_code: string;
  sku: string;
  quantity: number;
}

type ColumnKey =
  | "store"
  | "style_code"
  | "sku"
  | "status"
  | "initial_stock"
  | "total_out"
  | "current_stock"
  | "safety_stock"
  | "last_replenished_at";

interface ColumnDef {
  id: ColumnKey;
  label: string;
  align: "left" | "center" | "right";
  sortable: boolean;
  headerBg?: string;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "store", label: "Store Location", align: "left", sortable: true },
  { id: "style_code", label: "Style Code & Details", align: "left", sortable: true },
  { id: "sku", label: "SKU", align: "left", sortable: true },
  { id: "status", label: "Status", align: "center", sortable: true },
  { id: "initial_stock", label: "Delivered / In", align: "right", sortable: true, headerBg: "bg-slate-800/30" },
  { id: "total_out", label: "Total Out (Sold)", align: "right", sortable: true, headerBg: "bg-rose-950/20" },
  { id: "current_stock", label: "Available Stock", align: "right", sortable: true, headerBg: "bg-emerald-950/20" },
  { id: "safety_stock", label: "Safety Level", align: "right", sortable: true },
  { id: "last_replenished_at", label: "Last Received", align: "right", sortable: true },
];

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

export default function InventoryMonitoringPage() {
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStore, setSelectedStore] = useState<string>("All Stores");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStockStatus, setFilterStockStatus] = useState<"ALL" | "LOW" | "OUT">("ALL");

  // Sorting State
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Dynamic Column Order State
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Single Restock Modal
  const [isRestockOpen, setIsRestockOpen] = useState<boolean>(false);
  const [restockStyleCode, setRestockStyleCode] = useState<string>("");
  const [restockSku, setRestockSku] = useState<string>("");
  const [restockStore, setRestockStore] = useState<string>(STORES[1]);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockSubmitting, setRestockSubmitting] = useState<boolean>(false);

  // Bulk Import Modal State
  const [isBulkOpen, setIsBulkOpen] = useState<boolean>(false);
  const [bulkDefaultStore, setBulkDefaultStore] = useState<string>(STORES[1]);
  const [bulkPreview, setBulkPreview] = useState<BulkImportItem[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);

  // Manual Sales Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualSearchQuery, setManualSearchQuery] = useState<string>("");
  const [selectedManualItem, setSelectedManualItem] = useState<StoreInventoryItem | null>(null);
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualPrice, setManualPrice] = useState<string>("");
  const [manualStore, setManualStore] = useState<string>(STORES[1]);
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string>("");
  const [manualErrorMsg, setManualErrorMsg] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const customizerRef = useRef<HTMLDivElement>(null);

  // Load saved column layout from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("store_inventory_columns");
      if (saved) {
        const savedIds: ColumnKey[] = JSON.parse(saved);
        const reconstructed = savedIds
          .map((id) => DEFAULT_COLUMNS.find((col) => col.id === id))
          .filter(Boolean) as ColumnDef[];
        if (reconstructed.length === DEFAULT_COLUMNS.length) {
          setColumns(reconstructed);
        }
      }
    } catch (e) {
      console.warn("Failed to load saved column config", e);
    }
  }, []);

  // Save column order to localStorage
  const persistColumns = (newCols: ColumnDef[]) => {
    setColumns(newCols);
    try {
      localStorage.setItem("store_inventory_columns", JSON.stringify(newCols.map((c) => c.id)));
    } catch (e) {
      console.warn("Failed to save column config", e);
    }
  };

  const handleResetColumns = () => {
    persistColumns(DEFAULT_COLUMNS);
    localStorage.removeItem("store_inventory_columns");
  };

  // Close customizer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customizerRef.current && !customizerRef.current.contains(event.target as Node)) {
        setIsColumnCustomizerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStore, searchQuery, filterStockStatus, pageSize, sortKey, sortDirection]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("store_inventory")
        .select("*")
        .order("current_stock", { ascending: true });

      if (selectedStore !== "All Stores") {
        query = query.eq("store", selectedStore);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch matching log metadata to pull rich product descriptions/names if available
      const { data: logsData } = await supabase
        .from("scanned_logs")
        .select("style_code, style_name, description, color, size, department");

      const logMap: Record<string, any> = {};
      if (logsData) {
        logsData.forEach((l: any) => {
          if (l.style_code) {
            logMap[l.style_code] = l;
          }
        });
      }

      if (data) {
        const enriched: StoreInventoryItem[] = data.map((row: any) => {
          const initial = Number(row.initial_stock) || 0;
          const current = Number(row.current_stock) || 0;
          const calculatedOut = Math.max(0, initial - current);
          const matchedLog = logMap[row.style_code] || {};

          return {
            id: row.id,
            store: row.store,
            style_code: row.style_code || "-",
            sku: row.sku || matchedLog.sku || null,
            initial_stock: initial,
            current_stock: current,
            safety_stock: row.safety_stock ?? 5,
            last_replenished_at: row.last_replenished_at,
            total_out: calculatedOut,
            price: Number(row.price) || 299.00,
            style_name: row.style_name || matchedLog.style_name || matchedLog.description || row.style_code,
            color: row.color || matchedLog.color || "Default",
            size: row.size || matchedLog.size || "Free Size",
            department: row.department || matchedLog.department || "General",
          };
        });

        setItems(enriched);
      }
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Realtime subscription with cleanup
  useEffect(() => {
    const channel = supabase
      .channel("store_inventory_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_inventory" },
        () => fetchInventory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInventory]);

  // Column Header Sorting Logic
  const handleHeaderSort = (key: ColumnKey) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortKey(null);
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Drag and Drop Column Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColIndex !== index) {
      setDragOverColIndex(index);
    }
  };

  const handleDrop = (index: number) => {
    if (draggedColIndex === null || draggedColIndex === index) {
      setDraggedColIndex(null);
      setDragOverColIndex(null);
      return;
    }

    const updated = [...columns];
    const [movedCol] = updated.splice(draggedColIndex, 1);
    updated.splice(index, 0, movedCol);

    persistColumns(updated);
    setDraggedColIndex(null);
    setDragOverColIndex(null);
  };

  const moveColumn = (currentIndex: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const updated = [...columns];
    const [col] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, col);
    persistColumns(updated);
  };

  // Filter and Sort Data
  const processedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.style_code?.toLowerCase().includes(q) ||
        (item.style_name && item.style_name.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        item.store.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterStockStatus === "LOW") {
        return item.current_stock > 0 && item.current_stock <= item.safety_stock;
      }
      if (filterStockStatus === "OUT") {
        return item.current_stock <= 0;
      }

      return true;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      let valA: string | number | null;
      let valB: string | number | null;

      if (sortKey === "status") {
        valA = a.current_stock <= 0 ? 0 : a.current_stock <= a.safety_stock ? 1 : 2;
        valB = b.current_stock <= 0 ? 0 : b.current_stock <= b.safety_stock ? 1 : 2;
      } else if (sortKey === "last_replenished_at") {
        valA = a.last_replenished_at ? new Date(a.last_replenished_at).getTime() : 0;
        valB = b.last_replenished_at ? new Date(b.last_replenished_at).getTime() : 0;
      } else {
        const dataKey = sortKey as Exclude<ColumnKey, "status">;
        valA = a[dataKey];
        valB = b[dataKey];
      }

      if (typeof valA === "string") {
        return sortDirection === "asc"
          ? valA.localeCompare(typeof valB === "string" ? valB : "")
          : (typeof valB === "string" ? valB : "").localeCompare(valA);
      }

      return sortDirection === "asc"
        ? (valA ?? 0) - (typeof valB === "number" ? valB : 0)
        : (typeof valB === "number" ? valB : 0) - (valA ?? 0);
    });
  }, [items, searchQuery, filterStockStatus, sortKey, sortDirection]);

  const totalItems = processedItems.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = useMemo(() => {
    return processedItems.slice(startIndex, startIndex + pageSize);
  }, [processedItems, startIndex, pageSize]);

  const stats = useMemo(() => {
    const totalIn = items.reduce((acc, curr) => acc + curr.initial_stock, 0);
    const totalOut = items.reduce((acc, curr) => acc + curr.total_out, 0);
    const totalAvailable = items.reduce((acc, curr) => acc + curr.current_stock, 0);
    const lowStockCount = items.filter(
      (i) => i.current_stock > 0 && i.current_stock <= i.safety_stock
    ).length;
    const outOfStockCount = items.filter((i) => i.current_stock <= 0).length;

    return { totalIn, totalOut, totalAvailable, lowStockCount, outOfStockCount };
  }, [items]);

  const renderCellContent = (colId: ColumnKey, item: StoreInventoryItem) => {
    const isOut = item.current_stock <= 0;
    const isLow = item.current_stock > 0 && item.current_stock <= item.safety_stock;

    switch (colId) {
      case "store":
        return <span className="font-medium text-slate-300">{item.store}</span>;
      case "style_code":
        return (
          <div className="space-y-1 font-mono">
            {/* Display the rich product description/name as the prominent title */}
            <span className="font-black text-emerald-400 block text-sm tracking-wide">
              {item.style_name && item.style_name !== item.style_code ? item.style_name : (item.sku || item.style_code)}
            </span>
            {/* Nest the Style Code and variant details beneath */}
            <div className="text-[11px] text-slate-300 font-sans font-medium flex flex-wrap items-center gap-2">
              <span className="bg-slate-900 px-1.5 py-0.5 rounded text-white border border-slate-800 font-mono font-bold">Code: {item.style_code}</span>
              {item.color && item.color !== "Default" && <span className="text-slate-400">• {item.color}</span>}
              {item.size && item.size !== "Free Size" && <span className="text-slate-200 font-bold">• {item.size}</span>}
            </div>
          </div>
        );
      case "sku":
        return <span className="text-blue-400 font-mono">{item.sku || "-"}</span>;
      case "status":
        return isOut ? (
          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            Out of Stock
          </span>
        ) : isLow ? (
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            Low Stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            In Stock
          </span>
        );
      case "initial_stock":
        return <span className="font-mono text-slate-200">{item.initial_stock}</span>;
      case "total_out":
        return (
          <span className="font-mono font-bold text-rose-400">
            {item.total_out > 0 ? `-${item.total_out}` : "0"}
          </span>
        );
      case "current_stock":
        return (
          <span
            className={`font-bold font-mono text-sm ${
              isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {item.current_stock}
          </span>
        );
      case "safety_stock":
        return <span className="text-slate-400 font-mono">{item.safety_stock}</span>;
      case "last_replenished_at":
        return (
          <span className="text-slate-400 font-mono text-[11px]">
            {item.last_replenished_at
              ? new Date(item.last_replenished_at).toLocaleDateString("en-PH")
              : "N/A"}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Store Inventory Monitoring</h1>
            <p className="text-xs text-slate-400">
              Drag-to-reorder headers, sortable columns, and real-time intake
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/scanview"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-2 rounded-lg text-xs font-semibold transition"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-indigo-400" />
            <span>Scanner</span>
          </Link>

          <Link
            href="/reports/daily-sales"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-2 rounded-lg text-xs font-semibold transition"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sales Report</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-400">Total Scanned Out</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {stats.totalOut.toLocaleString()} <span className="text-xs text-rose-400 font-semibold">sold</span>
            </h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Available Balance</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {stats.totalAvailable.toLocaleString()} <span className="text-xs text-emerald-400 font-semibold">units</span>
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setFilterStockStatus(filterStockStatus === "LOW" ? "ALL" : "LOW")}
          className={`bg-slate-900/60 border rounded-xl p-4 flex items-center justify-between cursor-pointer transition ${
            filterStockStatus === "LOW" ? "border-amber-500 bg-amber-500/10" : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-amber-400">Low Stock Alerts</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.lowStockCount} items</h3>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setFilterStockStatus(filterStockStatus === "OUT" ? "ALL" : "OUT")}
          className={`bg-slate-900/60 border rounded-xl p-4 flex items-center justify-between cursor-pointer transition ${
            filterStockStatus === "OUT" ? "border-rose-500 bg-rose-500/10" : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Depleted Items</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.outOfStockCount} items</h3>
          </div>
          <div className="p-3 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Column Settings */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Style Code, SKU, Store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              {STORES.map((s) => (
                <option key={s} value={s} className="bg-slate-900">{s}</option>
              ))}
            </select>
          </div>

          <div className="relative" ref={customizerRef}>
            <button
              onClick={() => setIsColumnCustomizerOpen(!isColumnCustomizerOpen)}
              className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
              title="Customize Columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Columns</span>
            </button>

            {isColumnCustomizerOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white">Reorder Columns</span>
                  <button
                    onClick={handleResetColumns}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-400 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {columns.map((col, idx) => (
                    <div
                      key={col.id}
                      className="flex items-center justify-between p-1.5 bg-slate-950 border border-slate-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3 h-3 text-slate-600" />
                        <span className="text-slate-200">{col.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveColumn(idx, idx - 1)}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          ▲
                        </button>
                        <button
                          disabled={idx === columns.length - 1}
                          onClick={() => moveColumn(idx, idx + 1)}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={fetchInventory}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
            title="Refresh Stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 border-y-2 border-slate-700 text-slate-200 uppercase tracking-wider text-[11px] font-bold select-none">
              <tr>
                {columns.map((col, index) => {
                  const isSorted = sortKey === col.id;
                  const isDraggingThis = draggedColIndex === index;
                  const isOverThis = dragOverColIndex === index && draggedColIndex !== index;

                  return (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={() => {
                        setDraggedColIndex(null);
                        setDragOverColIndex(null);
                      }}
                      className={`px-4 py-3.5 border-r border-slate-700/80 transition-colors relative cursor-grab active:cursor-grabbing ${
                        col.headerBg || ""
                      } ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${
                        isDraggingThis ? "opacity-30 bg-indigo-950/40" : ""
                      } ${isOverThis ? "border-l-2 border-l-indigo-400 bg-indigo-900/20" : ""}`}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 group ${
                          col.align === "right"
                            ? "justify-end w-full"
                            : col.align === "center"
                            ? "justify-center w-full"
                            : "justify-start"
                        }`}
                      >
                        <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (col.sortable) handleHeaderSort(col.id);
                          }}
                          className="cursor-pointer hover:text-white transition-colors"
                        >
                          {col.label}
                        </span>

                        {col.sortable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHeaderSort(col.id);
                            }}
                            className="p-0.5 rounded text-slate-500 hover:text-white transition-colors cursor-pointer"
                          >
                            {isSorted ? (
                              sortDirection === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 opacity-60" />
                            )}
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                    Loading inventory data...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                    No items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors divide-x divide-slate-800/50"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`px-4 py-3 whitespace-nowrap ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {renderCellContent(col.id, item)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t-2 border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-200">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{" "}
              <strong className="text-slate-200">{Math.min(startIndex + pageSize, totalItems)}</strong> of{" "}
              <strong className="text-slate-200">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-1.5">
              <span>| Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg text-slate-200 px-2 py-1 focus:outline-none cursor-pointer font-medium"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer text-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-slate-800 text-slate-200 rounded-lg border border-slate-700 font-medium">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer text-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}