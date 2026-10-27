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
  Loader2,
  Calendar,
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
  total_pulled_out: number;
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
  price?: number;
  unit_price?: number;
  srp?: number;
  amount?: number;
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
  | "description"
  | "sku"
  | "status"
  | "initial_stock"
  | "total_out"
  | "total_pulled_out"
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
  { id: "description", label: "Description", align: "left", sortable: true },
  { id: "sku", label: "SKU", align: "left", sortable: true },
  { id: "status", label: "Status", align: "center", sortable: true },
  { id: "initial_stock", label: "Delivered / In", align: "right", sortable: true, headerBg: "bg-slate-800/30" },
  { id: "total_out", label: "Total Sold", align: "right", sortable: true, headerBg: "bg-emerald-950/20" },
  { id: "total_pulled_out", label: "Pulled Out", align: "right", sortable: true, headerBg: "bg-rose-950/20" },
  { id: "current_stock", label: "Available Stock", align: "right", sortable: true, headerBg: "bg-indigo-950/20" },
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

const cleanNumericPrice = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).replace(/[^\d.]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export default function InventoryMonitoringPage() {
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [productsMaster, setProductsMaster] = useState<ProductMasterRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStore, setSelectedStore] = useState<string>("All Stores");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStockStatus, setFilterStockStatus] = useState<"ALL" | "LOW" | "OUT">("ALL");

  const [sortKey, setSortKey] = useState<ColumnKey | null>("current_stock");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [isRestockOpen, setIsRestockOpen] = useState<boolean>(false);
  const [restockStyleCode, setRestockStyleCode] = useState<string>("");
  const [restockSku, setRestockSku] = useState<string>("");
  const [restockStore, setRestockStore] = useState<string>(STORES[1]);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockSubmitting, setRestockSubmitting] = useState<boolean>(false);

  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);

  const [isBulkOpen, setIsBulkOpen] = useState<boolean>(false);
  const [bulkDefaultStore, setBulkDefaultStore] = useState<string>(STORES[1]);
  const [bulkPreview, setBulkPreview] = useState<BulkImportItem[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualSearchQuery, setManualSearchQuery] = useState<string>("");
  const [selectedManualItem, setSelectedManualItem] = useState<StoreInventoryItem | null>(null);
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualPrice, setManualPrice] = useState<string>("");
  const [manualStore, setManualStore] = useState<string>(STORES[1]);
  const [manualDate, setManualDate] = useState<string>(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string>("");
  const [manualErrorMsg, setManualErrorMsg] = useState<string>("");
  
  const [lastSubmittedTime, setLastSubmittedTime] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStore, searchQuery, filterStockStatus, pageSize, sortKey, sortDirection]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);

    try {
      let allInvData: any[] = [];
      let page = 0;
      let fetchMore = true;

      while (fetchMore) {
        const { data: chunk, error: chunkErr } = await supabase
          .from("store_inventory")
          .select("*")
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (chunkErr) throw chunkErr;

        if (chunk && chunk.length > 0) {
          allInvData = [...allInvData, ...chunk];
          if (chunk.length < 1000) fetchMore = false;
          page++;
        } else {
          fetchMore = false;
        }
      }

      const prodRes = await supabase.from("products").select("*");
      if (prodRes.error) throw prodRes.error;

      const prodData = (prodRes.data as any[]) || [];
      setProductsMaster(prodData);

      const prodMap = new Map<string, any>();
      prodData.forEach((p) => {
        const pCode = p.style_code ? String(p.style_code).trim().toLowerCase() : "";
        const pSku = p.sku ? String(p.sku).trim().toLowerCase() : "";
        const pBarcode = p.barcode ? String(p.barcode).trim().toLowerCase() : "";
        const pVal = {
          price: cleanNumericPrice(p.price || p.unit_price || p.srp || p.amount),
          description: p.description || p.style_name || "",
          style_name: p.style_name || "",
          color: p.color || "Default",
          size: p.size || "Free Size",
          department: p.department || "General",
        };

        if (pCode) prodMap.set(pCode, pVal);
        if (pSku) prodMap.set(pSku, pVal);
        if (pBarcode) prodMap.set(pBarcode, pVal);
      });

      if (allInvData) {
        const enriched: StoreInventoryItem[] = allInvData.map((row: any) => {
          const storeName = row.store ? row.store.trim() : "Main Store";
          const styleCodeStr = row.style_code ? String(row.style_code).trim() : "";
          const skuStr = row.sku ? String(row.sku).trim() : "";
          
          const lookupKey1 = styleCodeStr.toLowerCase();
          const lookupKey2 = skuStr.toLowerCase();
          const matchedProd = prodMap.get(lookupKey1) || prodMap.get(lookupKey2) || {};

          // NULL-SAFE MAPPING: Robust coercion to prevent frontend display zeroing
          const rawTotalSold = row.total_sold !== null && row.total_sold !== undefined ? Number(row.total_sold) : 0;
          const rawPullOut = row.pull_out !== null && row.pull_out !== undefined ? Number(row.pull_out) : 0;

          return {
            id: String(row.id),
            store: storeName,
            style_code: styleCodeStr || "-",
            sku: row.sku ? String(row.sku).trim() : null,
            initial_stock: Number(row.initial_stock) || 0,
            current_stock: Number(row.current_stock) || 0,
            safety_stock: row.safety_stock ?? 5,
            last_replenished_at: row.last_replenished_at,
            total_out: rawTotalSold,
            total_pulled_out: rawPullOut,
            price: cleanNumericPrice(row.price) || matchedProd.price || 0,
            style_name: row.style_name || matchedProd.style_name || styleCodeStr,
            description: row.description || matchedProd.description || styleCodeStr,
            color: row.color || matchedProd.color || "Default",
            size: row.size || matchedProd.size || "Free Size",
            department: row.department || matchedProd.department || "General",
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

  const handleSelectManualProduct = async (item: StoreInventoryItem) => {
    setSelectedManualItem(item);

    const styleCodeStr = String(item.style_code).trim();
    let priceVal = cleanNumericPrice(item.price);
    let descVal = item.description || "";

    if (priceVal <= 0 || !descVal || descVal === "-") {
      const foundMaster: any = productsMaster.find(
        (p: any) => {
          const mc = String(p.style_code || "").trim();
          return mc === styleCodeStr || mc.includes(styleCodeStr) || styleCodeStr.includes(mc);
        }
      );
      if (foundMaster) {
        if (priceVal <= 0) {
          priceVal = cleanNumericPrice(foundMaster.price || foundMaster.unit_price || foundMaster.srp || foundMaster.amount);
        }
        if (!descVal || descVal === "-") {
          descVal = foundMaster.description || foundMaster.style_name || "";
        }
      }
    }

    if (descVal && descVal !== "-") {
      setSelectedManualItem({ ...item, description: descVal });
    }

    setManualPrice(priceVal > 0 ? String(priceVal) : "");
  };

  const selectedMasterPrice = useMemo(() => {
    if (!selectedManualItem) return 0;
    return cleanNumericPrice(manualPrice) || cleanNumericPrice(selectedManualItem.price) || 0;
  }, [selectedManualItem, manualPrice]);

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockStyleCode.trim()) return;

    setRestockSubmitting(true);
    try {
      const codeStr = String(restockStyleCode).trim();
      const skuStr = restockSku ? String(restockSku).trim() : null;

      const { data: existing, error: checkErr } = await supabase
        .from("store_inventory")
        .select("*")
        .eq("store", restockStore)
        .eq("style_code", codeStr)
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
            sku: skuStr || existing.sku,
            last_replenished_at: now,
          })
          .eq("id", existing.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from("store_inventory")
          .insert({
            store: restockStore,
            style_code: codeStr,
            sku: skuStr,
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
          const styleVal = row[styleIdx] !== undefined && row[styleIdx] !== null ? String(row[styleIdx]).trim() : "";
          const skuVal = skuIdx !== -1 && row[skuIdx] !== undefined && row[skuIdx] !== null ? String(row[skuIdx]).trim() : "";
          const qtyVal = Number(row[qtyIdx]);

          if (styleVal && !isNaN(qtyVal)) {
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

  const handleBulkSubmit = async () => {
    if (bulkPreview.length === 0) return;

    setBulkSubmitting(true);
    try {
      const now = new Date().toISOString();
      const targetStore = bulkDefaultStore;

      const { data: existingStoreRows, error: fetchErr } = await supabase
        .from("store_inventory")
        .select("*")
        .eq("store", targetStore);

      if (fetchErr) throw fetchErr;

      const existingMap = new Map<string, any>();
      if (existingStoreRows) {
        existingStoreRows.forEach((row: any) => {
          if (row.style_code) existingMap.set(String(row.style_code).trim(), row);
        });
      }

      let successCount = 0;
      let errorMessages: string[] = [];

      for (const item of bulkPreview) {
        const styleCodeStr = String(item.style_code).trim();
        const skuStr = item.sku ? String(item.sku).trim() : null;

        let existing = existingMap.get(styleCodeStr);
        if (!existing && existingStoreRows) {
          existing = existingStoreRows.find((row: any) => {
            const rc = String(row.style_code || "").trim();
            return rc === styleCodeStr || rc.includes(styleCodeStr) || styleCodeStr.includes(rc);
          });
        }

        if (existing) {
          const newInitial = Number(item.quantity);
          const currentOut = Math.max(0, (Number(existing.initial_stock) || 0) - (Number(existing.current_stock) || 0));
          const newCurrent = Math.max(0, newInitial - currentOut);

          const { error: updateErr } = await supabase
            .from("store_inventory")
            .update({
              initial_stock: newInitial,
              current_stock: newCurrent,
              sku: skuStr || existing.sku,
              last_replenished_at: now,
            })
            .eq("id", existing.id);

          if (updateErr) {
            errorMessages.push(updateErr.message);
          } else {
            successCount++;
          }
        } else {
          const { error: insertErr } = await supabase
            .from("store_inventory")
            .insert({
              store: targetStore,
              style_code: styleCodeStr,
              sku: skuStr,
              initial_stock: Number(item.quantity),
              current_stock: Number(item.quantity),
              safety_stock: 5,
              last_replenished_at: now,
            });

          if (insertErr) {
            if (insertErr.code === "23505") {
              const { data: refetchRow } = await supabase
                .from("store_inventory")
                .select("*")
                .eq("store", targetStore)
                .eq("style_code", styleCodeStr)
                .maybeSingle();

              if (refetchRow) {
                const newInitial = Number(item.quantity);
                const currentOut = Math.max(0, (Number(refetchRow.initial_stock) || 0) - (Number(refetchRow.current_stock) || 0));
                const newCurrent = Math.max(0, newInitial - currentOut);
                const { error: retryErr } = await supabase
                  .from("store_inventory")
                  .update({
                    initial_stock: newInitial,
                    current_stock: newCurrent,
                    sku: skuStr || refetchRow.sku,
                    last_replenished_at: now,
                  })
                  .eq("id", refetchRow.id);

                if (!retryErr) {
                  successCount++;
                  continue;
                }
              }
            }
            errorMessages.push(insertErr.message);
          } else {
            successCount++;
          }
        }
      }

      setIsBulkOpen(false);
      setBulkPreview([]);
      fetchInventory();
      
      if (errorMessages.length > 0) {
        alert(`Bulk delivery finished with errors. Success: ${successCount} out of ${bulkPreview.length}.`);
      } else {
        alert(`Bulk delivery committed! Successfully processed ${successCount} items to ${targetStore}.`);
      }
    } catch (err: any) {
      console.error("Bulk upload failed:", err);
      alert(`Bulk upload error: ${err?.message || "An error occurred"}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleManualSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManualItem || manualQty <= 0) return;

    const nowTs = Date.now();
    if (manualSubmitting || nowTs - lastSubmittedTime < 3000) {
      return;
    }

    setManualSubmitting(true);
    setManualErrorMsg("");
    setManualSuccessMsg("");

    try {
      if (selectedManualItem.current_stock < manualQty) {
        setManualErrorMsg(`Insufficient stock! Available balance is ${selectedManualItem.current_stock} pcs.`);
        setManualSubmitting(false);
        return;
      }

      const styleCodeStr = String(selectedManualItem.style_code).trim();
      const skuStr = selectedManualItem.sku ? String(selectedManualItem.sku).trim() : "";

      let masterProd: any = productsMaster.find(
        (p: any) => {
          const mc = String(p.style_code || "").trim();
          return mc === styleCodeStr || mc.includes(styleCodeStr) || styleCodeStr.includes(mc);
        }
      );

      const p = masterProd || {};

      const finalStyleName = p.style_name || selectedManualItem.style_name || styleCodeStr;
      const finalDescription = p.description || selectedManualItem.description || finalStyleName;
      const finalColor = p.color || (selectedManualItem.color !== "Default" ? selectedManualItem.color : "-");
      const finalSize = p.size || (selectedManualItem.size !== "Free Size" ? selectedManualItem.size : "-");
      const finalDept = p.department || (selectedManualItem.department !== "General" ? selectedManualItem.department : "General");

      const newCurrentStock = selectedManualItem.current_stock - manualQty;
      const newTotalSold = (selectedManualItem.total_out || 0) + manualQty;
      const unitPrice = cleanNumericPrice(manualPrice) || selectedMasterPrice;
      const totalRev = unitPrice * manualQty;
      const saleTimestamp = manualDate ? new Date(manualDate).toISOString() : new Date().toISOString();

      const { error: invErr } = await supabase
        .from("store_inventory")
        .update({ 
          current_stock: newCurrentStock,
          total_sold: newTotalSold
        })
        .eq("id", selectedManualItem.id);

      if (invErr) throw invErr;

      const { error: logErr } = await supabase
        .from("scanned_logs")
        .insert({
          store: manualStore,
          transaction_mode: "sales",
          style_code: styleCodeStr,
          sku: skuStr || p.sku || "-",
          style_name: finalStyleName,
          description: finalDescription,
          color: finalColor,
          size: finalSize,
          department: finalDept,
          price: unitPrice,
          quantity: manualQty,
          revenue: totalRev,
          scanned_at: saleTimestamp,
        });

      if (logErr) throw logErr;

      setLastSubmittedTime(Date.now());
      setManualSuccessMsg(`Successfully encoded sale for ${manualQty} pcs of [${styleCodeStr}]!`);
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

  const processedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (selectedStore !== "All Stores" && item.store.toLowerCase().trim() !== selectedStore.toLowerCase().trim()) {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.style_code?.toLowerCase().includes(q) ||
        (item.style_name && item.style_name.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
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
        valA = a[dataKey] ?? null;
        valB = b[dataKey] ?? null;
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
  }, [items, selectedStore, searchQuery, filterStockStatus, sortKey, sortDirection]);

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
    const totalPulledOut = items.reduce((acc, curr) => acc + curr.total_pulled_out, 0);
    const totalAvailable = items.reduce((acc, curr) => acc + curr.current_stock, 0);
    const lowStockCount = items.filter(
      (i) => i.current_stock > 0 && i.current_stock <= i.safety_stock
    ).length;
    const outOfStockCount = items.filter((i) => i.current_stock <= 0).length;

    return { totalIn, totalOut, totalPulledOut, totalAvailable, lowStockCount, outOfStockCount };
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
      case "description":
        return <span className="text-slate-200 font-sans text-left block">{item.description && item.description !== "-" ? item.description : "-"}</span>;
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
          <span className="font-mono font-bold text-emerald-400 text-right block">
            {item.total_out > 0 ? `${item.total_out}` : "0"}
          </span>
        );
      case "total_pulled_out":
        return (
          <span className="font-mono font-bold text-rose-400 text-right block">
            {item.total_pulled_out > 0 ? `${item.total_pulled_out}` : "0"}
          </span>
        );
      case "current_stock":
        return (
          <span
            className={`font-bold font-mono text-sm text-right block ${
              isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-indigo-400"
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6 flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Store Inventory Monitoring</h1>
            <p className="text-xs text-slate-400">
              Real-time multi-store inventory tracking across sales, deliveries, audits, and pull-outs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAlertModalOpen(true)}
            className="relative flex items-center gap-1.5 bg-rose-600/25 hover:bg-rose-600/35 text-rose-300 border border-rose-500/40 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer"
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

          <label className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-sky-900/20">
            <Upload className="w-4 h-4" />
            <span>Bulk Upload</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Delivered</p>
          <p className="text-2xl font-black text-white mt-1 font-mono">{stats.totalIn}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Sold</p>
          <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">{stats.totalOut}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Pulled Out</p>
          <p className="text-2xl font-black text-rose-400 mt-1 font-mono">{stats.totalPulledOut}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Available Stock</p>
          <p className="text-2xl font-black text-indigo-400 mt-1 font-mono">{stats.totalAvailable}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Low Stock Items</p>
          <p className="text-2xl font-black text-amber-400 mt-1 font-mono">{stats.lowStockCount}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Out of Stock</p>
          <p className="text-2xl font-black text-rose-500 mt-1 font-mono">{stats.outOfStockCount}</p>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px]">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full bg-slate-950 text-white border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {STORES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search style code, description, name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-xs pl-10 pr-4 py-2.5 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStockStatus("ALL")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${filterStockStatus === "ALL" ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStockStatus("LOW")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${filterStockStatus === "LOW" ? 'bg-amber-600 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'}`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterStockStatus("OUT")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${filterStockStatus === "OUT" ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'}`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-extrabold border-b border-slate-800 sticky top-0 z-20">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    onClick={() => col.sortable && handleHeaderSort(col.id)}
                    className={`px-4 py-3.5 cursor-pointer hover:text-white transition select-none ${col.headerBg || ''} ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"}`}>
                      <span>{col.label}</span>
                      {col.sortable && (
                        <ArrowUpDown className={`w-3 h-3 ${sortKey === col.id ? "text-indigo-400" : "text-slate-600"}`} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="p-16 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading store inventory data...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-16 text-center text-slate-500 italic font-sans">
                    No inventory records found for the selected store or search filter.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`px-4 py-3.5 ${
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
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

        <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 sticky bottom-0 z-30">
          <div className="text-xs text-slate-400 font-mono">
            Showing <span className="font-bold text-white">{totalItems === 0 ? 0 : startIndex + 1}</span> to{" "}
            <span className="font-bold text-white">{Math.min(startIndex + pageSize, totalItems)}</span> of{" "}
            <span className="font-bold text-white">{totalItems}</span> entries
          </div>

          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-xs px-2.5 py-1.5 rounded-lg text-white font-mono focus:outline-none cursor-pointer"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-300 px-3 font-mono">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <ShoppingBag className="w-5 h-5" />
                <h3 className="text-base font-bold text-white uppercase">Encode Manual Sale</h3>
              </div>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {manualSuccessMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs font-bold">
                {manualSuccessMsg}
              </div>
            )}

            {manualErrorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs font-bold">
                {manualErrorMsg}
              </div>
            )}

            <form onSubmit={handleManualSaleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Select Store Location</label>
                <select
                  value={manualStore}
                  onChange={(e) => {
                    setManualStore(e.target.value);
                    setSelectedManualItem(null);
                    setManualPrice("");
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-bold cursor-pointer"
                >
                  {STORES.filter(s => s !== "All Stores").map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Search Product by Style Code or SKU</label>
                <input
                  type="text"
                  placeholder="Type to filter inventory..."
                  value={manualSearchQuery}
                  onChange={(e) => setManualSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-white font-mono mb-2"
                />
                <div className="max-h-36 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-900">
                  {items
                    .filter((i) => i.store.toLowerCase().trim() === manualStore.toLowerCase().trim() && (
                      i.style_code.toLowerCase().includes(manualSearchQuery.toLowerCase()) ||
                      (i.style_name && i.style_name.toLowerCase().includes(manualSearchQuery.toLowerCase())) ||
                      (i.sku && i.sku.toLowerCase().includes(manualSearchQuery.toLowerCase())) ||
                      (i.description && i.description.toLowerCase().includes(manualSearchQuery.toLowerCase()))
                    ))
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectManualProduct(item)}
                        className={`p-2.5 text-xs font-mono cursor-pointer transition flex items-center justify-between ${selectedManualItem?.id === item.id ? 'bg-indigo-600/30 border-l-4 border-indigo-500 text-white' : 'hover:bg-slate-900 text-slate-300'}`}
                      >
                        <div>
                          <span className="font-bold text-emerald-400">{item.description && item.description !== "-" ? item.description : item.style_name || item.style_code}</span>
                          <span className="text-slate-400 block text-[10px]">Code: {item.style_code} • SKU: {item.sku || '-'}</span>
                        </div>
                        <span className="font-bold text-indigo-300">Stock: {item.current_stock}</span>
                      </div>
                    ))}
                </div>
              </div>

              {selectedManualItem && (
                <div className="bg-slate-950 border border-indigo-500/30 p-3.5 rounded-xl space-y-2 text-xs font-mono">
                  <p className="text-indigo-300 font-bold">Selected: {selectedManualItem.style_code}</p>
                  <p className="text-white text-xs font-sans font-semibold">Description: {selectedManualItem.description || selectedManualItem.style_name || 'N/A'}</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                    <div>Available Stock: <span className="text-emerald-400 font-bold">{selectedManualItem.current_stock} pcs</span></div>
                    <div>Catalog Price: <span className="text-emerald-400 font-bold">{selectedMasterPrice > 0 ? `₱${selectedMasterPrice.toFixed(2)}` : 'Not Set'}</span></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Quantity Sold</label>
                  <input
                    type="number"
                    min={1}
                    value={manualQty}
                    onChange={(e) => setManualQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Custom Price (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter price..."
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Sale Date & Time</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="datetime-local"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs pl-10 pr-3 py-2.5 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting || !selectedManualItem}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {manualSubmitting ? "Processing..." : "Commit Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRestockOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white uppercase">Single Delivery Intake</h3>
              <button onClick={() => setIsRestockOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Store Location</label>
                <select
                  value={restockStore}
                  onChange={(e) => setRestockStore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-bold cursor-pointer"
                >
                  {STORES.filter(s => s !== "All Stores").map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Style Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30765663011"
                  value={restockStyleCode}
                  onChange={(e) => setRestockStyleCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">SKU (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 566301"
                  value={restockSku}
                  onChange={(e) => setRestockSku(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Quantity to Add</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {restockSubmitting ? "Saving..." : "Commit Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase">Bulk Delivery Preview</h3>
                <p className="text-xs text-slate-400">Reviewing {bulkPreview.length} items parsed from spreadsheet</p>
              </div>
              <button onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Target Store Location for Bulk Upload</label>
              <select
                value={bulkDefaultStore}
                onChange={(e) => setBulkDefaultStore(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2.5 rounded-xl text-white font-bold cursor-pointer"
              >
                {STORES.filter(s => s !== "All Stores").map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl max-h-60">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Style Code</th>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bulkPreview.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-emerald-400 font-bold">{item.style_code}</td>
                      <td className="px-3 py-2 text-blue-400">{item.sku || "-"}</td>
                      <td className="px-3 py-2 text-right font-bold text-white">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSubmitting || bulkPreview.length === 0}
                onClick={handleBulkSubmit}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {bulkSubmitting ? "Committing..." : `Commit ${bulkPreview.length} Items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-rose-400">
                <Bell className="w-5 h-5" />
                <h3 className="text-base font-bold text-white uppercase">Low & Out of Stock Alerts ({alertItems.length})</h3>
              </div>
              <button onClick={() => setIsAlertModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Store</th>
                    <th className="px-3 py-2.5">Style / Item</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {alertItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-500 font-sans italic">All store inventories are above safety stock levels.</td>
                    </tr>
                  ) : (
                    alertItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2.5 text-slate-300">{item.store}</td>
                        <td className="px-3 py-2.5 text-emerald-400 font-bold">{item.style_name || item.style_code}</td>
                        <td className="px-3 py-2.5 text-center">
                          {item.current_stock <= 0 ? (
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold">Out of Stock</span>
                          ) : (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold">Low Stock</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-400">{item.current_stock}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAlertModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}