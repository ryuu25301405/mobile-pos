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
  ShoppingBag,
  Upload,
  X,
  Check,
  Bell,
} from "lucide-react";

interface StoreInventoryItem {
  id?: string;
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

interface ProductMasterRecord {
  id: string;
  style_code: string;
  sku: string;
  style_name: string;
  department: string;
  category: string;
  color: string;
  size: string;
  price: number;
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
  const [productsMaster, setProductsMaster] = useState<ProductMasterRecord[]>([]);
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

  // Batch Adjustment Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchStore, setBatchStore] = useState<string>(STORES[1]);
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>("");
  const [batchAdjustments, setBatchAdjustments] = useState<Array<{ style_code: string; sku: string; style_name: string; qty_delta: number; new_safety: number; current_stock: number }>>([]);
  const [batchSubmitting, setBatchSubmitting] = useState<boolean>(false);

  // Alert Popup Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);

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
      const [invRes, prodRes, logsRes] = await Promise.all([
        supabase.from("store_inventory").select("*").order("current_stock", { ascending: true }),
        supabase.from("products").select("*"),
        supabase.from("scanned_logs").select("style_code, style_name, description, color, size, department")
      ]);

      if (prodRes.error) throw prodRes.error;
      if (prodRes.data) {
        setProductsMaster(prodRes.data as ProductMasterRecord[]);
      }

      const logMap: Record<string, any> = {};
      if (logsRes.data) {
        logsRes.data.forEach((l: any) => {
          if (l.style_code) {
            logMap[l.style_code] = l;
          }
        });
      }

      if (invRes.data) {
        const enriched: StoreInventoryItem[] = invRes.data.map((row: any) => {
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
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Realtime subscription
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

  // Load batch adjustment items for the selected branch (combining inventory and full master products)
  const loadBatchItemsForStore = (targetStore: string) => {
    const existingMap = new Map<string, StoreInventoryItem>();
    items
      .filter((i) => i.store === targetStore)
      .forEach((i) => existingMap.set(i.style_code, i));

    const combinedList = productsMaster.map((prod) => {
      const existing = existingMap.get(prod.style_code);
      return {
        style_code: prod.style_code,
        sku: prod.sku || existing?.sku || "",
        style_name: prod.style_name || prod.style_code,
        qty_delta: 0,
        new_safety: existing ? existing.safety_stock : 5,
        current_stock: existing ? existing.current_stock : 0,
      };
    });

    // Also include any inventory items that might not be in the master table for some reason
    items
      .filter((i) => i.store === targetStore)
      .forEach((i) => {
        if (!combinedList.some((c) => c.style_code === i.style_code)) {
          combinedList.push({
            style_code: i.style_code,
            sku: i.sku || "",
            style_name: i.style_name || i.style_code,
            qty_delta: 0,
            new_safety: i.safety_stock,
            current_stock: i.current_stock,
          });
        }
      });

    setBatchAdjustments(combinedList);
  };

  // Single Restock Submission
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockStyleCode.trim()) return;

    setRestockSubmitting(true);
    try {
      const { data: existing, error: checkErr } = await supabase
        .from("store_inventory")
        .select("*")
        .eq("store", restockStore)
        .eq("style_code", restockStyleCode.trim())
        .maybeSingle();

      if (checkErr) throw checkErr;

      const now = new Date().toISOString();

      if (existing) {
        const newInitial = (Number(existing.initial_stock) || 0) + Number(restockQty);
        const newCurrent = (Number(existing.current_stock) || 0) + Number(restockQty);

        const { error: updateErr } = await supabase
          .from("store_inventory")
          .update({
            initial_stock: newInitial,
            current_stock: newCurrent,
            sku: restockSku.trim() || existing.sku,
            last_replenished_at: now,
          })
          .eq("id", existing.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from("store_inventory")
          .insert({
            store: restockStore,
            style_code: restockStyleCode.trim(),
            sku: restockSku.trim() || null,
            initial_stock: Number(restockQty),
            current_stock: Number(restockQty),
            safety_stock: 5,
            last_replenished_at: now,
          });

        if (insertErr) throw insertErr;
      }

      setIsRestockOpen(false);
      setRestockStyleCode("");
      setRestockSku("");
      setRestockQty(10);
      fetchInventory();
    } catch (err) {
      console.error("Restock failed:", err);
      alert("Failed to process restock intake.");
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
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (data.length < 2) {
          alert("Uploaded file is empty or missing rows.");
          return;
        }

        const headers = data[0].map((h: any) => String(h).trim().toLowerCase());
        const storeIdx = headers.findIndex((h) => h.includes("store") || h.includes("location"));
        const styleIdx = headers.findIndex((h) => h.includes("style") || h.includes("code"));
        const skuIdx = headers.findIndex((h) => h.includes("sku"));
        const qtyIdx = headers.findIndex((h) => h.includes("qty") || h.includes("quantity") || h.includes("stock") || h.includes("count"));

        if (styleIdx === -1 || qtyIdx === -1) {
          alert("Could not find required columns ('Style Code' and 'Quantity'). Please check template format.");
          return;
        }

        const parsedItems: BulkImportItem[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const storeVal = storeIdx !== -1 && row[storeIdx] ? String(row[storeIdx]).trim() : bulkDefaultStore;
          const styleVal = row[styleIdx] ? String(row[styleIdx]).trim() : "";
          const skuVal = skuIdx !== -1 && row[skuIdx] ? String(row[skuIdx]).trim() : "";
          const qtyVal = Number(row[qtyIdx]) || 0;

          if (styleVal && qtyVal > 0) {
            parsedItems.push({
              store: storeVal || bulkDefaultStore,
              style_code: styleVal,
              sku: skuVal,
              quantity: qtyVal,
            });
          }
        }

        setBulkPreview(parsedItems);
        setIsBulkOpen(true);
      } catch (err) {
        console.error("Failed to parse file:", err);
        alert("Failed to read spreadsheet file.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Confirm Bulk Import
  const handleBulkSubmit = async () => {
    if (bulkPreview.length === 0) return;

    setBulkSubmitting(true);
    try {
      const now = new Date().toISOString();

      for (const item of bulkPreview) {
        const targetStore = item.store || bulkDefaultStore;
        const { data: existing, error: checkErr } = await supabase
          .from("store_inventory")
          .select("*")
          .eq("store", targetStore)
          .eq("style_code", item.style_code)
          .maybeSingle();

        if (checkErr) throw checkErr;

        if (existing) {
          const newInitial = (Number(existing.initial_stock) || 0) + item.quantity;
          const newCurrent = (Number(existing.current_stock) || 0) + item.quantity;

          await supabase
            .from("store_inventory")
            .update({
              initial_stock: newInitial,
              current_stock: newCurrent,
              sku: item.sku || existing.sku,
              last_replenished_at: now,
            })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("store_inventory")
            .insert({
              store: targetStore,
              style_code: item.style_code,
              sku: item.sku || null,
              initial_stock: item.quantity,
              current_stock: item.quantity,
              safety_stock: 5,
              last_replenished_at: now,
            });
        }
      }

      setIsBulkOpen(false);
      setBulkPreview([]);
      fetchInventory();
      alert("Bulk delivery successfully processed!");
    } catch (err) {
      console.error("Bulk upload failed:", err);
      alert("An error occurred while committing bulk delivery.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Manual Sales Submission
  const handleManualSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManualItem || manualQty <= 0) return;

    setManualSubmitting(true);
    setManualErrorMsg("");
    setManualSuccessMsg("");

    try {
      if (selectedManualItem.current_stock < manualQty) {
        setManualErrorMsg(`Insufficient stock! Available balance is ${selectedManualItem.current_stock} pcs.`);
        setManualSubmitting(false);
        return;
      }

      const newCurrentStock = selectedManualItem.current_stock - manualQty;
      const unitPrice = manualPrice ? Number(manualPrice) : (selectedManualItem.price || 299.00);
      const totalRev = unitPrice * manualQty;
      const now = new Date().toISOString();

      // Deduct from inventory
      const { error: invErr } = await supabase
        .from("store_inventory")
        .update({ current_stock: newCurrentStock })
        .eq("id", selectedManualItem.id);

      if (invErr) throw invErr;

      // Log sale transaction
      const { error: logErr } = await supabase
        .from("scanned_logs")
        .insert({
          store: manualStore,
          style_code: selectedManualItem.style_code,
          sku: selectedManualItem.sku || "-",
          style_name: selectedManualItem.style_name || selectedManualItem.style_code,
          color: selectedManualItem.color || "Default",
          size: selectedManualItem.size || "Free Size",
          department: selectedManualItem.department || "General",
          price: unitPrice,
          quantity: manualQty,
          revenue: totalRev,
          scanned_at: now,
        });

      if (logErr) throw logErr;

      setManualSuccessMsg(`Successfully encoded sale for ${manualQty} pcs of [${selectedManualItem.style_code}]!`);
      setSelectedManualItem(null);
      setManualQty(1);
      setManualPrice("");
      fetchInventory();

      setTimeout(() => {
        setIsManualModalOpen(false);
        setManualSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      console.error("Manual sale failed:", err);
      setManualErrorMsg(err.message || "Failed to encode manual sale.");
    } finally {
      setManualSubmitting(false);
    }
  };

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

  // Alert items for the popup notification modal
  const alertItems = useMemo(() => {
    return items.filter((i) => i.current_stock <= i.safety_stock);
  }, [items]);

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
        return <span className="font-medium text-slate-300 text-left block">{item.store}</span>;
      case "style_code":
        return (
          <div className="space-y-1 font-mono text-left">
            <span className="font-bold text-emerald-400 block text-sm tracking-wide">
              {item.style_name && item.style_name !== item.style_code ? item.style_name : (item.sku || item.style_code)}
            </span>
            <div className="text-[11px] text-slate-300 font-sans font-medium flex flex-wrap items-center justify-start gap-1.5">
              <span className="bg-slate-900 px-1.5 py-0.5 rounded text-white border border-slate-800 font-mono font-bold">Code: {item.style_code}</span>
              {item.color && item.color !== "Default" && <span className="text-slate-400">• {item.color}</span>}
              {item.size && item.size !== "Free Size" && <span className="text-slate-200 font-bold">• Size: {item.size}</span>}
            </div>
          </div>
        );
      case "sku":
        return <span className="text-blue-400 font-mono text-left block">{item.sku || "-"}</span>;
      case "status":
        return (
          <div className="text-center w-full flex justify-center">
            {isOut ? (
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
            )}
          </div>
        );
      case "initial_stock":
        return <span className="font-mono text-slate-200 text-right block">{item.initial_stock}</span>;
      case "total_out":
        return (
          <span className="font-mono font-bold text-rose-400 text-right block">
            {item.total_out > 0 ? `-${item.total_out}` : "0"}
          </span>
        );
      case "current_stock":
        return (
          <span
            className={`font-bold font-mono text-sm text-right block ${
              isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {item.current_stock}
          </span>
        );
      case "safety_stock":
        return <span className="text-slate-400 font-mono text-right block">{item.safety_stock}</span>;
      case "last_replenished_at":
        return (
          <span className="text-slate-400 font-mono text-[11px] text-right block">
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAlertModalOpen(true)}
            className="relative flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer"
          >
            <Bell className="w-4 h-4 text-rose-400" />
            <span>Stock Alerts</span>
            {alertItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-md animate-pulse">
                {alertItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-emerald-900/20"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Manual Sale</span>
          </button>

          <button
            onClick={() => setIsRestockOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-indigo-900/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Single Delivery</span>
          </button>

          <button
            onClick={() => {
              setBatchSearchQuery("");
              loadBatchItemsForStore(batchStore);
              setIsBatchModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-amber-900/20"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Batch Adjustment</span>
          </button>

          <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Bulk Delivery (Excel)</span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
          </label>

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

      {/* SINGLE RESTOCK MODAL */}
      {isRestockOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Single Item Delivery / Restock</h3>
              <button
                onClick={() => setIsRestockOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Store Location</label>
                <select
                  value={restockStore}
                  onChange={(e) => setRestockStore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {STORES.filter((s) => s !== "All Stores").map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Style Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BB01 P3"
                  value={restockStyleCode}
                  onChange={(e) => setRestockStyleCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">SKU (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 3076566299"
                  value={restockSku}
                  onChange={(e) => setRestockSku(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Quantity to Deliver</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {restockSubmitting ? "Processing..." : "Confirm Intake"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK ALERTS POPUP NOTIFICATION MODAL */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Stock Alerts & Replenishment Notices</h3>
                  <p className="text-xs text-slate-400">{alertItems.length} items require immediate attention (Low or Depleted)</p>
                </div>
              </div>
              <button onClick={() => setIsAlertModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl max-h-[55vh] [scrollbar-width:thin]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                  <tr>
                    <th className="px-4 py-3">Store Location</th>
                    <th className="px-4 py-3">Style / Details</th>
                    <th className="px-4 py-3 text-center">Condition</th>
                    <th className="px-4 py-3 text-right">Stock / Safety</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {alertItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-emerald-400 font-semibold">
                        All stores are fully stocked! No alerts at this time.
                      </td>
                    </tr>
                  ) : (
                    alertItems.map((item) => {
                      const isOut = item.current_stock <= 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-slate-300">{item.store}</td>
                          <td className="px-4 py-3 font-mono">
                            <span className="font-bold text-white block">{item.style_name || item.style_code}</span>
                            <span className="text-[10px] text-slate-400">Code: {item.style_code} • SKU: {item.sku || "-"}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                Out of Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                Low Stock
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            <span className={isOut ? "text-rose-400" : "text-amber-400"}>{item.current_stock} pcs</span>
                            <span className="text-slate-500 text-[10px] block">Safety threshold: {item.safety_stock}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAlertModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close Alerts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH STOCK ADJUSTMENT MODAL */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Batch Stock & Safety Level Adjustment</h3>
                <p className="text-xs text-slate-400">Quickly adjust incoming/outgoing quantities or safety thresholds for multiple items</p>
              </div>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-semibold text-slate-400 shrink-0">Target Branch:</span>
                <select
                  value={batchStore}
                  onChange={(e) => {
                    const newStore = e.target.value;
                    setBatchStore(newStore);
                    loadBatchItemsForStore(newStore);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg text-xs text-white px-3 py-1.5 focus:outline-none font-bold cursor-pointer"
                >
                  {STORES.filter((s) => s !== "All Stores").map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter items by style code or name..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl max-h-[50vh] [scrollbar-width:thin]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                  <tr>
                    <th className="px-4 py-3">Style / Variant</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3 text-right">Current Stock</th>
                    <th className="px-4 py-3 text-right">Adjustment (+/- Qty)</th>
                    <th className="px-4 py-3 text-right">New Safety Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {batchAdjustments
                    .filter(
                      (row) =>
                        row.style_code.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
                        row.style_name.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
                        row.sku.toLowerCase().includes(batchSearchQuery.toLowerCase())
                    )
                    .map((row) => (
                      <tr key={row.style_code} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-mono">
                          <span className="font-bold text-white block">{row.style_name}</span>
                          <span className="text-[10px] text-slate-400">Code: {row.style_code}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-blue-400">{row.sku || "-"}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                          {row.current_stock} pcs
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          <input
                            type="number"
                            value={row.qty_delta}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setBatchAdjustments((prev) =>
                                prev.map((item) => (item.style_code === row.style_code ? { ...item, qty_delta: val } : item))
                              );
                            }}
                            placeholder="0"
                            className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-right text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          <input
                            type="number"
                            min={0}
                            value={row.new_safety}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setBatchAdjustments((prev) =>
                                prev.map((item) => (item.style_code === row.style_code ? { ...item, new_safety: val } : item))
                              );
                            }}
                            className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-right text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={batchSubmitting || batchAdjustments.length === 0}
                onClick={async () => {
                  setBatchSubmitting(true);
                  try {
                    const now = new Date().toISOString();
                    for (const adj of batchAdjustments) {
                      if (adj.qty_delta === 0 && adj.new_safety === undefined) continue;

                      const { data: existing } = await supabase
                        .from("store_inventory")
                        .select("*")
                        .eq("store", batchStore)
                        .eq("style_code", adj.style_code)
                        .maybeSingle();

                      if (existing) {
                        const newInitial = (Number(existing.initial_stock) || 0) + (adj.qty_delta > 0 ? adj.qty_delta : 0);
                        const newCurrent = Math.max(0, (Number(existing.current_stock) || 0) + adj.qty_delta);

                        await supabase
                          .from("store_inventory")
                          .update({
                            initial_stock: newInitial,
                            current_stock: newCurrent,
                            safety_stock: adj.new_safety,
                            last_replenished_at: adj.qty_delta > 0 ? now : existing.last_replenished_at,
                          })
                          .eq("id", existing.id);
                      } else {
                        // If it didn't exist in store inventory yet, insert it fresh
                        if (adj.qty_delta > 0 || adj.new_safety > 0) {
                          await supabase
                            .from("store_inventory")
                            .insert({
                              store: batchStore,
                              style_code: adj.style_code,
                              sku: adj.sku || null,
                              initial_stock: Math.max(0, adj.qty_delta),
                              current_stock: Math.max(0, adj.qty_delta),
                              safety_stock: adj.new_safety || 5,
                              last_replenished_at: now,
                            });
                        }
                      }
                    }

                    setIsBatchModalOpen(false);
                    fetchInventory();
                    alert("Batch adjustments successfully saved!");
                  } catch (err) {
                    console.error("Batch update error:", err);
                    alert("Failed to commit batch adjustments.");
                  } finally {
                    setBatchSubmitting(false);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {batchSubmitting ? "Saving Changes..." : "Save All Adjustments"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK IMPORT PREVIEW MODAL */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Bulk Delivery Preview</h3>
                <p className="text-xs text-slate-400">{bulkPreview.length} items parsed from spreadsheet</p>
              </div>
              <button
                onClick={() => setIsBulkOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Default Store if missing:</span>
              <select
                value={bulkDefaultStore}
                onChange={(e) => setBulkDefaultStore(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg text-xs text-white px-2 py-1 focus:outline-none cursor-pointer"
              >
                {STORES.filter((s) => s !== "All Stores").map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl max-h-64 [scrollbar-width:thin]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2">Store</th>
                    <th className="px-3 py-2">Style Code</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bulkPreview.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-slate-300">{item.store || bulkDefaultStore}</td>
                      <td className="px-3 py-2 font-mono text-emerald-400 font-bold">{item.style_code}</td>
                      <td className="px-3 py-2 font-mono text-blue-400">{item.sku || "-"}</td>
                      <td className="px-3 py-2 font-mono text-right text-white font-bold">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSubmitting || bulkPreview.length === 0}
                onClick={handleBulkSubmit}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {bulkSubmitting ? "Processing..." : `Commit ${bulkPreview.length} Deliveries`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL SALES ENCODING MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Manual Sales Encoding</h3>
                <p className="text-xs text-slate-400">Record a sale and deduct store inventory instantly</p>
              </div>
              <button
                onClick={() => {
                  setIsManualModalOpen(false);
                  setSelectedManualItem(null);
                  setManualSuccessMsg("");
                  setManualErrorMsg("");
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manualSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{manualSuccessMsg}</span>
              </div>
            )}

            {manualErrorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{manualErrorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Select Store Branch</label>
                <select
                  value={manualStore}
                  onChange={(e) => setManualStore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                >
                  {STORES.filter((s) => s !== "All Stores").map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Search Product / Style Code</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type style code or name..."
                    value={manualSearchQuery}
                    onChange={(e) => setManualSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Search Results Dropdown / Picker */}
              <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-800 rounded-xl p-1 bg-slate-950/60 [scrollbar-width:thin]">
                {items
                  .filter(
                    (i) =>
                      i.store === manualStore &&
                      (i.style_code.toLowerCase().includes(manualSearchQuery.toLowerCase()) ||
                        (i.style_name && i.style_name.toLowerCase().includes(manualSearchQuery.toLowerCase())) ||
                        (i.sku && i.sku.toLowerCase().includes(manualSearchQuery.toLowerCase())))
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedManualItem(item);
                        setManualPrice(String(item.price || 299));
                      }}
                      className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs border ${
                        selectedManualItem?.id === item.id
                          ? "bg-emerald-600/20 border-emerald-500 text-white font-bold"
                          : "bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-emerald-400 block">{item.style_name || item.style_code}</span>
                        <span className="text-[10px] text-slate-400">Code: {item.style_code} • SKU: {item.sku || "-"}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`block font-bold ${item.current_stock > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {item.current_stock} pcs left
                        </span>
                        <span className="text-[10px] text-slate-400">₱{item.price || 299}</span>
                      </div>
                    </div>
                  ))}
              </div>

              {selectedManualItem && (
                <form onSubmit={handleManualSaleSubmit} className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase block">Selected Item</span>
                      <span className="font-bold text-white font-mono">{selectedManualItem.style_name} ({selectedManualItem.style_code})</span>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold">{selectedManualItem.current_stock} available</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-1">Quantity Sold</label>
                      <input
                        type="number"
                        min={1}
                        max={selectedManualItem.current_stock}
                        required
                        value={manualQty}
                        onChange={(e) => setManualQty(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-1">Unit Price (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={manualPrice}
                        onChange={(e) => setManualPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedManualItem(null)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="submit"
                      disabled={manualSubmitting || selectedManualItem.current_stock <= 0}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {manualSubmitting ? "Encoding..." : "Confirm & Deduct Stock"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}