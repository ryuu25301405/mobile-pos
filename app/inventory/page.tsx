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
  { id: "style_code", label: "Style Code", align: "left", sortable: true },
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

      if (data) {
        const enriched: StoreInventoryItem[] = data.map((row: any) => {
          const initial = Number(row.initial_stock) || 0;
          const current = Number(row.current_stock) || 0;
          const calculatedOut = Math.max(0, initial - current);

          return {
            id: row.id,
            store: row.store,
            style_code: row.style_code || "-",
            sku: row.sku || null,
            initial_stock: initial,
            current_stock: current,
            safety_stock: row.safety_stock ?? 5,
            last_replenished_at: row.last_replenished_at,
            total_out: calculatedOut,
            price: Number(row.price) || 299.00,
            style_name: row.style_name || row.style_code || "Standard Item",
            color: row.color || "Default",
            size: row.size || "Free Size",
            department: row.department || "General",
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

  // Single Item Restock
  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const styleCode = restockStyleCode.trim();
    if (!styleCode || restockQty <= 0) return;

    setRestockSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from("store_inventory")
        .select("id, current_stock, initial_stock")
        .eq("store", restockStore)
        .eq("style_code", styleCode)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("store_inventory")
          .update({
            initial_stock: existing.initial_stock + restockQty,
            current_stock: existing.current_stock + restockQty,
            sku: restockSku.trim() || undefined,
            last_replenished_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("store_inventory").insert([
          {
            store: restockStore,
            style_code: styleCode,
            sku: restockSku.trim() || null,
            initial_stock: restockQty,
            current_stock: restockQty,
            safety_stock: 5,
          },
        ]);
      }

      await supabase.from("inventory_movements").insert([
        {
          store: restockStore,
          sku: styleCode,
          type: "DELIVERY",
          quantity: restockQty,
        },
      ]);

      setIsRestockOpen(false);
      setRestockStyleCode("");
      setRestockSku("");
      fetchInventory();
    } catch (err) {
      alert("Failed to save incoming delivery.");
    } finally {
      setRestockSubmitting(false);
    }
  };

  // Bulk File Upload Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      const parsed: BulkImportItem[] = data
        .map((row) => {
          const store =
            row["Store"] || row["store"] || row["Store Location"] || bulkDefaultStore;
          const style =
            row["Style Code"] ||
            row["style_code"] ||
            row["Style"] ||
            row["style"] ||
            "";
          const sku =
            row["SKU"] || row["sku"] || row["Barcode"] || row["barcode"] || "";
          const qty = Number(
            row["Quantity"] || row["quantity"] || row["Qty"] || row["qty"] || 0
          );

          return {
            store: String(store).trim(),
            style_code: String(style).trim(),
            sku: String(sku).trim(),
            quantity: Math.max(0, qty),
          };
        })
        .filter((item) => item.quantity > 0 && (item.style_code || item.sku));

      setBulkPreview(parsed);
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmBulkDelivery = async () => {
    if (bulkPreview.length === 0) return;
    setBulkSubmitting(true);

    try {
      const { error } = await supabase.rpc("bulk_receive_delivery", {
        p_items: bulkPreview,
      });

      if (error) throw error;

      alert(`Successfully processed ${bulkPreview.length} delivery items!`);
      setIsBulkOpen(false);
      setBulkPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchInventory();
    } catch (err: any) {
      alert(`Bulk intake failed: ${err.message || "Unknown error"}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Manual Sales Modal Handlers
  const openManualSalesModal = () => {
    setManualSearchQuery("");
    setSelectedManualItem(null);
    setManualQty(1);
    setManualPrice("");
    setManualStore(selectedStore !== "All Stores" ? selectedStore : STORES[1]);
    setManualSuccessMsg("");
    setManualErrorMsg("");
    setIsManualModalOpen(true);
  };

  const filteredManualItems = useMemo(() => {
    if (!manualSearchQuery.trim()) return items.slice(0, 8);
    const q = manualSearchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.style_code.toLowerCase().includes(q) ||
        (item.style_name && item.style_name.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [items, manualSearchQuery]);

  const handleSelectManualItem = (item: StoreInventoryItem) => {
    setSelectedManualItem(item);
    setManualStore(item.store);
    setManualPrice(item.price ? item.price.toString() : "299.00");
    setManualSearchQuery("");
  };

  const handleManualSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManualItem) {
      setManualErrorMsg("Please select a product from your inventory catalog.");
      return;
    }

    const finalPrice = parseFloat(manualPrice);
    const finalQty = parseInt(String(manualQty), 10);

    if (isNaN(finalPrice) || finalPrice < 0) {
      setManualErrorMsg("Please enter a valid price.");
      return;
    }
    if (isNaN(finalQty) || finalQty < 1) {
      setManualErrorMsg("Quantity must be at least 1.");
      return;
    }

    setManualSubmitting(true);
    setManualErrorMsg("");

    try {
      const payload = {
        store: manualStore || selectedManualItem.store,
        style_code: selectedManualItem.style_code,
        sku: selectedManualItem.sku || "-",
        style_name: selectedManualItem.style_name || selectedManualItem.style_code,
        description: selectedManualItem.department || "Manual Sale",
        color: selectedManualItem.color || "Default",
        size: selectedManualItem.size || "Free Size",
        category: "General",
        department: selectedManualItem.department || "General",
        price: finalPrice,
        quantity: finalQty,
        scanned_at: new Date().toISOString(),
        entry_method: "manual",
      };

      const { error: logError } = await supabase.from("scanned_logs").insert([payload]);
      if (logError) throw logError;

      const { data: invRow } = await supabase
        .from("store_inventory")
        .select("id, current_stock")
        .eq("store", manualStore || selectedManualItem.store)
        .eq("style_code", selectedManualItem.style_code)
        .maybeSingle();

      if (invRow) {
        const updatedStock = Math.max(0, invRow.current_stock - finalQty);
        await supabase
          .from("store_inventory")
          .update({ current_stock: updatedStock })
          .eq("id", invRow.id);
      }

      setManualSuccessMsg("Manual sale logged successfully!");
      setTimeout(() => {
        setIsManualModalOpen(false);
        fetchInventory();
      }, 1000);
    } catch (err: any) {
      setManualErrorMsg(`Failed to save manual sale: ${err.message || "Unknown error"}`);
    } finally {
      setManualSubmitting(false);
    }
  };

  // Filter and Sort Data
  const processedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.style_code?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
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
        return <span className="font-semibold text-white">{item.style_code}</span>;
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

          <button
            onClick={openManualSalesModal}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Manually encode a sale (fallback)"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Manual Sale</span>
          </button>

          <button
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-indigo-600/10"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Bulk Delivery</span>
          </button>

          <button
            onClick={() => setIsRestockOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-emerald-600/10"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Single Item</span>
          </button>
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
                              <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 opacity-60" />
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

      {/* MODAL 3: Manual Sales Encoding Modal (With Auto-Price & Store Dropdown) */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-left text-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Fallback Encoding
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Manual Sales Entry</h2>
              </div>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-500 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {manualSuccessMsg && (
              <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{manualSuccessMsg}</span>
              </div>
            )}

            {manualErrorMsg && (
              <div className="bg-rose-950/60 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{manualErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleManualSaleSubmit} className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  1. Search Product Catalog
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type style code, name, or SKU..."
                    value={manualSearchQuery}
                    onChange={(e) => setManualSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs pl-8 pr-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {manualSearchQuery.trim() && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-900 text-xs shadow-lg">
                    {filteredManualItems.length === 0 ? (
                      <div className="p-3 text-slate-500 text-center italic">No items found matching "{manualSearchQuery}"</div>
                    ) : (
                      filteredManualItems.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectManualItem(item)}
                          className="p-2.5 hover:bg-slate-900 cursor-pointer transition flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-white">{item.style_name} <span className="text-emerald-400 font-mono text-[10px]">({item.style_code})</span></p>
                            <p className="text-[10px] text-slate-400">{item.store} • Color: {item.color} • Stock: {item.current_stock}</p>
                          </div>
                          <span className="font-mono font-bold text-emerald-400">₱{item.price || 299}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedManualItem && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-400">Selected Product</p>
                    <p className="font-bold text-white mt-0.5">{selectedManualItem.style_name} <span className="font-mono text-slate-300">[{selectedManualItem.style_code}]</span></p>
                    <p className="text-[10px] text-slate-400">Available: {selectedManualItem.current_stock} pcs • {selectedManualItem.store}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedManualItem(null)}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" /> Unit Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="Auto-pulls on select"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-indigo-400" /> Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={manualQty}
                    onChange={(e) => setManualQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* STORE BRANCH DROPDOWN */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Store className="w-3 h-3 text-amber-400" /> Store Branch
                </label>
                <select
                  value={manualStore}
                  onChange={(e) => setManualStore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  required
                >
                  {STORES.filter((s) => s !== "All Stores").map((s) => (
                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting || !selectedManualItem}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{manualSubmitting ? "Encoding..." : "Log Manual Sale"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}