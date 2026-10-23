"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { logUserActivity } from "@/lib/logger";
import * as XLSX from "xlsx-js-style";
import {
  Filter,
  RotateCcw,
  Boxes,
  Layers,
  Check,
  X,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  ChevronRight,
  Package,
  Search,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Bookmark,
  Trash2,
  ScanBarcode,
  LayoutDashboard,
  Eye,
  Store as StoreIcon,
  Maximize2,
  Minimize2,
  Printer,
  Building2,
  ArrowRight,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Activity,
  Database,
  ChevronLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PanelLeftClose,
  PanelLeftOpen,
  FolderSearch,
  CalendarDays,
  Rows3,
  Rows2,
  Sigma,
  FileSpreadsheet,
  FileText,
  Tag,
  History
} from "lucide-react";

export const dynamic = "force-dynamic";

interface SalesRecord {
  id: string;
  store: string;
  style_code: string;
  sku: string;
  style_name: string;
  description: string;
  color: string;
  size: string;
  category: string;
  department: string;
  price: number;
  quantity: number;
  revenue: number;
  scanned_at: string;
  scanned_date: string;
}

interface InventoryRecord {
  id: string;
  store: string;
  style_code: string;
  sku: string | null;
  style_name?: string;
  color?: string;
  size?: string;
  department?: string;
  category?: string;
  current_stock: number;
  safety_stock: number;
  initial_stock: number;
  price?: number;
  last_replenished_at: string;
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

interface AuditLogRecord {
  id: string;
  user_email: string;
  action_type: string;
  details: string;
  store: string;
  created_at: string;
}

type DimensionKey = "store" | "department" | "category" | "color" | "size" | "style_code" | "style_name";
type MeasureKey = "revenue" | "units" | "aur" | "transactions";

interface DimensionConfig {
  key: DimensionKey;
  label: string;
}

interface MeasureConfig {
  key: MeasureKey;
  label: string;
  format: (val: number) => string;
}

const MEASURES: MeasureConfig[] = [
  { key: "revenue", label: "Total Revenue (₱)", format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: "units", label: "Units Sold", format: (v) => `${v.toLocaleString()} pcs` },
  { key: "aur", label: "Average Unit Retail (₱)", format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: "transactions", label: "Transaction Logs", format: (v) => `${v.toLocaleString()} logs` },
];

const CYCLIC_DIMENSIONS: DimensionConfig[] = [
  { key: "store", label: "Store Location" },
  { key: "department", label: "Department" },
  { key: "category", label: "Category" },
  { key: "color", label: "Color" },
  { key: "size", label: "Size" },
  { key: "style_code", label: "Style Code" },
  { key: "style_name", label: "Style Name" },
];

interface StateSelection {
  stores: string[];
  departments: string[];
  categories: string[];
  colors: string[];
  sizes: string[];
  styles: string[];
  styleNames: string[];
}

interface BookmarkPreset {
  id: string;
  name: string;
  selection: StateSelection;
  startDate: string;
  endDate: string;
}

const EMPTY_SELECTIONS: StateSelection = {
  stores: [],
  departments: [],
  categories: [],
  colors: [],
  sizes: [],
  styles: [],
  styleNames: [],
};

const CHART_COLORS = [
  "#10B981", "#6366F1", "#3B82F6", "#F59E0B", "#EC4899", "#8B5CF6", "#14B8A6", "#F43F5E",
];

interface ProductSummaryItem {
  key: string;
  styleCode: string;
  sku: string;
  styleName: string;
  color: string;
  size: string;
  category: string;
  department: string;
  price: number;
  units: number;
  revenue: number;
  abcClass: "A" | "B" | "C";
  storeBreakdown: Record<string, number>;
  currentStock: number;
  safetyStock: number;
  velocity: number;
  daysOfSupply: number;
  stockStatus: "CRITICAL" | "WARNING" | "HEALTHY";
  slobStatus: "DEAD" | "SLOW" | "ACTIVE";
  tiedUpCapital: number;
}

export default function QlikViewAnalyticsPage() {
  const [data, setData] = useState<SalesRecord[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryRecord[]>([]);
  const [productsMaster, setProductsMaster] = useState<ProductMasterRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [stateA, setStateA] = useState<StateSelection>(EMPTY_SELECTIONS);
  const [bookmarks, setBookmarks] = useState<BookmarkPreset[]>([]);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [newBookmarkName, setNewBookmarkName] = useState("");

  const [activeMeasureIndex, setActiveMeasureIndex] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [visualizationMode, setVisualizationMode] = useState<"chart" | "donut">("chart");
  const [graphDimensionKey, setGraphDimensionKey] = useState<DimensionKey>("store");
  const [productViewMode, setProductViewMode] = useState<"consolidated" | "master_catalog" | "stores_grid" | "replenishment" | "aging_slob" | "audit_logs">("consolidated");
  
  const [masterCatalogSearch, setMasterCatalogSearch] = useState<string>("");
  const [masterCatalogStoreFilter, setMasterCatalogStoreFilter] = useState<string>("All Stores");
  const [masterCatalogDeptFilter, setMasterCatalogDeptFilter] = useState<string>("All Departments");

  const [masterSortKey, setMasterSortKey] = useState<string>("unitsSold");
  const [masterSortDirection, setMasterSortDirection] = useState<"asc" | "desc">("desc");

  const [masterPage, setMasterPage] = useState<number>(1);
  const [masterPageSize, setMasterPageSize] = useState<number>(10);

  const [selectedBranchDetail, setSelectedBranchDetail] = useState<string | null>(null);
  const [branchModalSearch, setBranchModalSearch] = useState<string>("");
  const [branchModalTierFilter, setBranchModalTierFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [isBranchModalExpanded, setIsBranchModalExpanded] = useState<boolean>(false);

  const [expandedPanel, setExpandedPanel] = useState<"none" | "graph" | "table">("none");

  const [detailSearch, setDetailSearch] = useState("");
  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<DimensionKey>("store");
  const [drawerSearch, setDrawerSearch] = useState("");

  const [tableDensity, setTableDensity] = useState<"compact" | "comfortable">("comfortable");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    style: 280,
    class: 100,
    variant: 160,
    price: 110,
    units: 110,
  });

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resizingColumnRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    resizingColumnRef.current = colKey;
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[colKey] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColumnRef.current) return;
      const diff = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(80, startWidthRef.current + diff);
      setColumnWidths((prev) => ({ ...prev, [resizingColumnRef.current!]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingColumnRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const [inspectedProduct, setInspectedProduct] = useState<ProductSummaryItem | null>(null);

  // CHUNKED FETCHING TO BYPASS SUPABASE 1000-ROW LIMIT COMPLETELY
  const fetchData = useCallback(async () => {
    setLoading(true);

    let allLogs: any[] = [];
    let logPage = 0;
    const pageSize = 1000;
    let fetchMoreLogs = true;

    while (fetchMoreLogs) {
      const { data: chunk, error } = await supabase
        .from("scanned_logs")
        .select("id, store, style_code, sku, style_name, description, color, size, category, department, price, quantity, scanned_at")
        .order("scanned_at", { ascending: false })
        .range(logPage * pageSize, (logPage + 1) * pageSize - 1);

      if (error || !chunk || chunk.length === 0) {
        fetchMoreLogs = false;
      } else {
        allLogs = [...allLogs, ...chunk];
        if (chunk.length < pageSize) {
          fetchMoreLogs = false;
        } else {
          logPage++;
        }
      }
    }

    let allInv: any[] = [];
    let invPage = 0;
    let fetchMoreInv = true;

    while (fetchMoreInv) {
      const { data: chunk, error } = await supabase
        .from("store_inventory")
        .select("*")
        .range(invPage * pageSize, (invPage + 1) * pageSize - 1);

      if (error || !chunk || chunk.length === 0) {
        fetchMoreInv = false;
      } else {
        allInv = [...allInv, ...chunk];
        if (chunk.length < pageSize) {
          fetchMoreInv = false;
        } else {
          invPage++;
        }
      }
    }

    const [prodRes, auditRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100)
    ]);

    if (allLogs.length > 0) {
      const parsed: SalesRecord[] = allLogs.map((row: any) => {
        const qty = Number(row.quantity) || 1;
        const pr = parseFloat(row.price) || 0;
        const dt = row.scanned_at ? new Date(row.scanned_at) : new Date();
        return {
          id: String(row.id),
          store: row.store ? row.store.trim() : "Unassigned Store",
          style_code: row.style_code || "Unknown Style",
          sku: row.sku || "-",
          style_name: row.style_name && row.style_name !== "-" ? row.style_name.trim() : "Unassigned Item",
          description: row.description || "-",
          color: row.color && row.color !== "-" ? row.color.trim() : "Unassigned Color",
          size: row.size && row.size !== "-" ? row.size.trim() : "Unassigned Size",
          category: row.category && row.category !== "-" ? row.category.trim() : "Unassigned Category",
          department: row.department && row.department !== "-" ? row.department.trim() : "Unassigned Dept",
          price: pr,
          quantity: qty,
          revenue: pr * qty,
          scanned_at: row.scanned_at,
          scanned_date: dt.toISOString().split("T")[0],
        };
      });
      setData(parsed);
    }

    if (allInv.length > 0) {
      const normalizedInv = allInv.map((inv: any) => ({
        ...inv,
        store: inv.store ? inv.store.trim() : "Unassigned Store",
        price: inv.price !== null && inv.price !== undefined ? parseFloat(inv.price) : undefined,
      }));
      setInventoryData(normalizedInv as InventoryRecord[]);
    }
    if (!prodRes.error && prodRes.data) {
      const normalizedProds = prodRes.data.map((p: any) => ({
        ...p,
        price: parseFloat(p.price) || 0,
      }));
      setProductsMaster(normalizedProds as ProductMasterRecord[]);
    }
    if (!auditRes.error && auditRes.data) setAuditLogs(auditRes.data as AuditLogRecord[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem("qlik_analytics_bookmarks");
    if (saved) {
      try { setBookmarks(JSON.parse(saved)); } catch (e) { console.error("Failed to parse bookmarks", e); }
    }
  }, [fetchData]);

  useEffect(() => {
    setMasterPage(1);
  }, [masterCatalogSearch, masterCatalogStoreFilter, masterCatalogDeptFilter]);

  const applyDatePreset = (preset: "today" | "yesterday" | "7days" | "month" | "clear") => {
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "today") {
      const todayStr = formatDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const yest = new Date();
      yest.setDate(now.getDate() - 1);
      const yestStr = formatDate(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(formatDate(past));
      setEndDate(formatDate(now));
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(now));
    } else if (preset === "clear") {
      setStartDate("");
      setEndDate("");
    }
    logUserActivity("DATE_PRESET_APPLIED", `Applied filter preset: ${preset}`);
  };

  const saveBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmarkName.trim()) return;
    const newBm: BookmarkPreset = { id: Date.now().toString(), name: newBookmarkName.trim(), selection: stateA, startDate, endDate };
    const updated = [newBm, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem("qlik_analytics_bookmarks", JSON.stringify(updated));
    setNewBookmarkName("");
    setIsBookmarkModalOpen(false);
    logUserActivity("PRESET_SAVED", `Saved bookmark preset: ${newBm.name}`);
  };

  const loadBookmark = (bm: BookmarkPreset) => {
    setStateA(() => bm.selection);
    setStartDate(bm.startDate);
    setEndDate(bm.endDate);
    logUserActivity("PRESET_LOADED", `Loaded bookmark preset: ${bm.name}`);
  };

  const deleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem("qlik_analytics_bookmarks", JSON.stringify(updated));
    logUserActivity("PRESET_DELETED", `Deleted bookmark ID: ${id}`);
  };

  const dateFilteredData = useMemo(() => {
    if (!startDate && !endDate) return data;
    return data.filter((row) => {
      if (startDate && row.scanned_date < startDate) return false;
      if (endDate && row.scanned_date > endDate) return false;
      return true;
    });
  }, [data, startDate, endDate]);

  const universe = useMemo(() => {
    return {
      stores: Array.from(new Set(dateFilteredData.map((d) => d.store))).sort(),
      departments: Array.from(new Set(dateFilteredData.map((d) => d.department))).sort(),
      categories: Array.from(new Set(dateFilteredData.map((d) => d.category))).sort(),
      colors: Array.from(new Set(dateFilteredData.map((d) => d.color))).sort(),
      sizes: Array.from(new Set(dateFilteredData.map((d) => d.size))).sort(),
      styles: Array.from(new Set(dateFilteredData.map((d) => d.style_code))).sort(),
      styleNames: Array.from(new Set(dateFilteredData.map((d) => d.style_name))).sort(),
      totalRevenue: dateFilteredData.reduce((acc, d) => acc + d.revenue, 0),
      totalUnits: dateFilteredData.reduce((acc, d) => acc + d.quantity, 0),
    };
  }, [dateFilteredData]);

  const evaluateSubset = useCallback(
    (selection: StateSelection) => {
      return dateFilteredData.filter((row) => {
        return (selection.stores.length === 0 || selection.stores.includes(row.store)) &&
               (selection.departments.length === 0 || selection.departments.includes(row.department)) &&
               (selection.categories.length === 0 || selection.categories.includes(row.category)) &&
               (selection.colors.length === 0 || selection.colors.includes(row.color)) &&
               (selection.sizes.length === 0 || selection.sizes.includes(row.size)) &&
               (selection.styles.length === 0 || selection.styles.includes(row.style_code)) &&
               (selection.styleNames.length === 0 || selection.styleNames.includes(row.style_name));
      });
    },
    [dateFilteredData]
  );

  const currentSubset = useMemo(() => evaluateSubset(stateA), [evaluateSubset, stateA]);

  const { possibleValues, fieldFrequencies } = useMemo(() => {
    const calcPossibleAndFreq = (targetField: "store" | "department" | "category" | "color" | "size" | "style_name") => {
      const subset = dateFilteredData.filter((row) => {
        const mStore = targetField === "store" || stateA.stores.length === 0 || stateA.stores.includes(row.store);
        const mDept = targetField === "department" || stateA.departments.length === 0 || stateA.departments.includes(row.department);
        const mCat = targetField === "category" || stateA.categories.length === 0 || stateA.categories.includes(row.category);
        const mColor = targetField === "color" || stateA.colors.length === 0 || stateA.colors.includes(row.color);
        const mSize = targetField === "size" || stateA.sizes.length === 0 || stateA.sizes.includes(row.size);
        const mStyle = stateA.styles.length === 0 || stateA.styles.includes(row.style_code);
        const mStyleName = targetField === "style_name" || stateA.styleNames.length === 0 || stateA.styleNames.includes(row.style_name);
        return mStore && mDept && mCat && mColor && mSize && mStyle && mStyleName;
      });

      const possibleSet = new Set<string>();
      const freqMap: Record<string, number> = {};
      subset.forEach((row) => {
        const val = row[targetField]; 
        possibleSet.add(val);
        freqMap[val] = (freqMap[val] || 0) + row.quantity;
      });
      return { possibleSet, freqMap };
    };

    return {
      possibleValues: {
        stores: calcPossibleAndFreq("store").possibleSet,
        departments: calcPossibleAndFreq("department").possibleSet,
        categories: calcPossibleAndFreq("category").possibleSet,
        colors: calcPossibleAndFreq("color").possibleSet,
        sizes: calcPossibleAndFreq("size").possibleSet,
        styleNames: calcPossibleAndFreq("style_name").possibleSet,
      },
      fieldFrequencies: {
        stores: calcPossibleAndFreq("store").freqMap,
        departments: calcPossibleAndFreq("department").freqMap,
        categories: calcPossibleAndFreq("category").freqMap,
        colors: calcPossibleAndFreq("color").freqMap,
        sizes: calcPossibleAndFreq("size").freqMap,
        styleNames: calcPossibleAndFreq("style_name").freqMap,
      },
    };
  }, [dateFilteredData, stateA]);

  const toggleSelection = (field: "store" | "department" | "category" | "color" | "size" | "style_code" | "style_name", value: string) => {
    setStateA((prev) => {
      const fieldKeyMap: Record<string, keyof StateSelection> = { 
        store: "stores", 
        department: "departments", 
        category: "categories", 
        color: "colors", 
        size: "sizes", 
        style_code: "styles",
        styleNames: "styleNames" 
      };
      const key = fieldKeyMap[field];
      const exists = prev[key].includes(value);
      return { ...prev, [key]: exists ? prev[key].filter((v) => v !== value) : [...prev[key], value] };
    });
  };

  const clearCurrentStateSelections = () => { setStateA(() => EMPTY_SELECTIONS); };

  const calcMetrics = (subset: SalesRecord[]) => {
    const revenue = subset.reduce((acc, curr) => acc + curr.revenue, 0);
    const units = subset.reduce((acc, curr) => acc + curr.quantity, 0);
    const aur = units > 0 ? revenue / units : 0;
    const shareOfTotal = universe.totalRevenue > 0 ? (revenue / universe.totalRevenue) * 100 : 0;
    return { revenue, units, transactions: subset.length, aur, shareOfTotal };
  };

  const metricsA = useMemo(() => calcMetrics(currentSubset), [currentSubset, universe.totalRevenue]);
  const activeMeasure = MEASURES[activeMeasureIndex];
  const cycleMeasure = () => setActiveMeasureIndex((prev) => (prev + 1) % MEASURES.length);

  const graphRows = useMemo(() => {
    const map: Record<string, { label: string; revenue: number; units: number; count: number; aur: number }> = {};
    currentSubset.forEach((item) => {
      const keyVal = String(item[graphDimensionKey as keyof SalesRecord] ?? "Unknown");
      if (!map[keyVal]) map[keyVal] = { label: keyVal, revenue: 0, units: 0, count: 0, aur: 0 };
      map[keyVal].revenue += item.revenue;
      map[keyVal].units += item.quantity;
      map[keyVal].count += 1;
    });

    Object.values(map).forEach((r) => r.aur = r.units > 0 ? r.revenue / r.units : 0);
    const rows = Object.values(map).sort((a, b) => {
      if (activeMeasure.key === "units") return b.units - a.units;
      if (activeMeasure.key === "transactions") return b.count - a.count;
      if (activeMeasure.key === "aur") return b.aur - a.aur;
      return b.revenue - a.revenue;
    });

    const totalVal = rows.reduce((sum, r) => sum + (activeMeasure.key === "units" ? r.units : activeMeasure.key === "transactions" ? r.count : activeMeasure.key === "aur" ? r.aur : r.revenue), 0);
    return rows.map((r, idx) => ({
      ...r,
      measureValue: activeMeasure.key === "units" ? r.units : activeMeasure.key === "transactions" ? r.count : activeMeasure.key === "aur" ? r.aur : r.revenue,
      share: totalVal > 0 ? ((activeMeasure.key === "units" ? r.units : activeMeasure.key === "transactions" ? r.count : activeMeasure.key === "aur" ? r.aur : r.revenue) / totalVal) * 100 : 0,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [currentSubset, graphDimensionKey, activeMeasure]);

  const maxGraphMeasureValue = useMemo(() => graphRows.length === 0 ? 1 : Math.max(...graphRows.map((r) => r.measureValue), 1), [graphRows]);

  const donutSlices = useMemo(() => {
    let cumulativePercent = 0;
    return graphRows.map((row) => {
      const startAngle = (cumulativePercent / 100) * 360;
      cumulativePercent += row.share;
      return { ...row, startAngle, endAngle: (cumulativePercent / 100) * 360 };
    });
  }, [graphRows]);

  const masterCatalogProducts = useMemo(() => {
    const stockMap: Record<string, number> = {};
    const priceMap: Record<string, number> = {};

    inventoryData.forEach((inv) => {
      if (inv.store && inv.style_code) {
        stockMap[`${inv.store}-${inv.style_code}`] = Number(inv.current_stock) || 0;
        if (inv.price !== undefined && inv.price !== null && Number(inv.price) > 0) {
          priceMap[String(inv.style_code).trim()] = parseFloat(String(inv.price));
        }
      }
    });

    data.forEach((log) => {
      if (log.style_code && log.price > 0) {
        priceMap[String(log.style_code).trim()] = parseFloat(String(log.price));
      }
    });

    const salesMap: Record<string, { units: number; revenue: number }> = {};
    data.forEach((log) => {
      if (log.store && log.style_code) {
        const k = `${log.store}-${log.style_code}`;
        if (!salesMap[k]) salesMap[k] = { units: 0, revenue: 0 };
        salesMap[k].units += log.quantity;
        salesMap[k].revenue += log.revenue;
      }
    });

    const list: Array<{
      id: string;
      store: string;
      styleCode: string;
      sku: string;
      styleName: string;
      color: string;
      size: string;
      department: string;
      category: string;
      currentStock: number;
      price: number;
      unitsSold: number;
      revenue: number;
      storeBreakdown: Record<string, number>;
    }> = [];

    const storesList = universe.stores.length > 0 ? universe.stores : ["Unassigned Store"];

    if (productsMaster.length > 0) {
      productsMaster.forEach((prod) => {
        const styleCodeStr = prod.style_code ? String(prod.style_code).trim() : "";
        const precisePrice = priceMap[styleCodeStr] || parseFloat(String(prod.price)) || 299.00;

        storesList.forEach((st) => {
          const k = `${st}-${prod.style_code}`;
          const storeBreakdown: Record<string, number> = {};
          storesList.forEach(s => {
            storeBreakdown[s] = stockMap[`${s}-${prod.style_code}`] || 0;
          });

          list.push({
            id: prod.id,
            store: st,
            styleCode: prod.style_code || "-",
            sku: prod.sku || "-",
            styleName: prod.style_name || prod.style_code,
            color: prod.color || "Default",
            size: prod.size || "Free Size",
            department: prod.department || "General",
            category: prod.category || "General",
            currentStock: stockMap[k] || 0,
            price: precisePrice,
            unitsSold: salesMap[k]?.units || 0,
            revenue: salesMap[k]?.revenue || (salesMap[k]?.units || 0) * precisePrice,
            storeBreakdown,
          });
        });
      });
    } else {
      inventoryData.forEach((inv) => {
        const st = inv.store || "Unassigned Store";
        const styleCode = inv.style_code || "-";
        const styleCodeStr = String(styleCode).trim();
        const precisePrice = priceMap[styleCodeStr] || (inv.price !== undefined && inv.price !== null ? parseFloat(String(inv.price)) : 299.00);

        const k = `${st}-${styleCode}`;
        const storeBreakdown: Record<string, number> = {};
        storesList.forEach(s => {
          storeBreakdown[s] = stockMap[`${s}-${styleCode}`] || 0;
        });

        list.push({
          id: inv.id,
          store: st,
          styleCode: styleCode,
          sku: inv.sku || "-",
          styleName: inv.style_name || styleCode,
          color: inv.color || "Default",
          size: inv.size || "Free Size",
          department: inv.department || "General",
          category: inv.category || "General",
          currentStock: Number(inv.current_stock) || 0,
          price: precisePrice,
          unitsSold: salesMap[k]?.units || 0,
          revenue: salesMap[k]?.revenue || (salesMap[k]?.units || 0) * precisePrice,
          storeBreakdown,
        });
      });
    }

    let filtered = list;
    if (masterCatalogStoreFilter !== "All Stores") {
      filtered = filtered.filter((p) => p.store === masterCatalogStoreFilter);
    }
    if (masterCatalogDeptFilter !== "All Departments") {
      filtered = filtered.filter((p) => p.department === masterCatalogDeptFilter);
    }

    if (masterCatalogSearch.trim()) {
      const q = masterCatalogSearch.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const searchableText = [
          p.styleCode,
          p.styleName,
          p.sku,
          p.store,
          p.color,
          p.size,
          p.department,
          p.category
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(q);
      });
    }

    return filtered.sort((a, b) => {
      let valA: any = a[masterSortKey as keyof typeof a];
      let valB: any = b[masterSortKey as keyof typeof b];

      if (typeof valA === "string") {
        return masterSortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return masterSortDirection === "asc"
        ? (Number(valA) || 0) - (Number(valB) || 0)
        : (Number(valB) || 0) - (Number(valA) || 0);
    });
  }, [productsMaster, inventoryData, data, universe.stores, masterCatalogSearch, masterCatalogStoreFilter, masterCatalogDeptFilter, masterSortKey, masterSortDirection]);

  const handleMasterSort = (key: string) => {
    if (masterSortKey === key) {
      setMasterSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setMasterSortKey(key);
      setMasterSortDirection("asc");
    }
  };

  const masterTotalItems = masterCatalogProducts.length;
  const masterTotalPages = Math.ceil(masterTotalItems / masterPageSize) || 1;
  const masterStartIndex = (masterPage - 1) * masterPageSize;
  const paginatedMasterProducts = useMemo(() => {
    return masterCatalogProducts.slice(masterStartIndex, masterStartIndex + masterPageSize);
  }, [masterCatalogProducts, masterStartIndex, masterPageSize]);

  const filteredProducts = useMemo(() => {
    let daysInPeriod = 30;
    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      daysInPeriod = Math.max(1, (e - s) / (1000 * 3600 * 24));
    }

    const map: Record<string, ProductSummaryItem> = {};
    const validStores = stateA.stores.length > 0 ? stateA.stores : universe.stores;
    const relevantInv = inventoryData.filter(i => validStores.includes(i.store));

    currentSubset.forEach((item) => {
      const prodKey = `${item.style_code}-${item.sku}-${item.size}-${item.color}`;
      if (!map[prodKey]) {
        map[prodKey] = {
          key: prodKey, styleCode: item.style_code, sku: item.sku, styleName: item.style_name, color: item.color, size: item.size,
          category: item.category, department: item.department, price: parseFloat(String(item.price)) || 0, units: 0, revenue: 0, abcClass: "C", storeBreakdown: {},
          currentStock: 0, safetyStock: 0, velocity: 0, daysOfSupply: 999, stockStatus: "HEALTHY", slobStatus: "ACTIVE", tiedUpCapital: 0
        };
      }
      map[prodKey].units += item.quantity;
      map[prodKey].revenue += item.revenue;
      map[prodKey].storeBreakdown[item.store] = (map[prodKey].storeBreakdown[item.store] || 0) + item.quantity;
    });

    Object.values(map).forEach(prod => {
      const invMatches = relevantInv.filter(i => i.style_code === prod.styleCode);
      prod.currentStock = invMatches.reduce((acc, curr) => acc + (curr.current_stock || 0), 0);
      prod.safetyStock = invMatches.reduce((acc, curr) => acc + (curr.safety_stock || 0), 0);
      
      prod.tiedUpCapital = prod.currentStock * prod.price;
      prod.velocity = prod.units / daysInPeriod;
      prod.daysOfSupply = prod.velocity > 0 ? prod.currentStock / prod.velocity : 999;

      if (prod.currentStock <= 0) prod.stockStatus = "CRITICAL";
      else if (prod.currentStock <= prod.safetyStock || prod.daysOfSupply < 14) prod.stockStatus = "WARNING";
      else prod.stockStatus = "HEALTHY";

      if (prod.daysOfSupply > 120 || (prod.velocity === 0 && prod.currentStock > 0)) prod.slobStatus = "DEAD";
      else if (prod.daysOfSupply > 60) prod.slobStatus = "SLOW";
      else prod.slobStatus = "ACTIVE";
    });

    const list = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    const totalSubRevenue = list.reduce((sum, p) => sum + p.revenue, 0);
    let cumulativeRevenue = 0;

    const classifiedList = list.map((p) => {
      cumulativeRevenue += p.revenue;
      const cumulativePct = totalSubRevenue > 0 ? (cumulativeRevenue / totalSubRevenue) * 100 : 100;
      return { ...p, abcClass: cumulativePct <= 80 ? "A" : cumulativePct <= 95 ? "B" : "C" as "A"|"B"|"C" };
    });

    if (!detailSearch.trim()) return classifiedList;
    const q = detailSearch.toLowerCase().trim();
    return classifiedList.filter((p) => {
      const searchableText = [
        p.styleCode,
        p.styleName,
        p.sku,
        p.color,
        p.size,
        p.department,
        p.category
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(q);
    });
  }, [currentSubset, detailSearch, inventoryData, stateA.stores, universe.stores, startDate, endDate]);

  const tableTotals = useMemo(() => {
    const totalUnits = filteredProducts.reduce((acc, p) => acc + p.units, 0);
    const totalRevenue = filteredProducts.reduce((acc, p) => acc + (p.price * p.units), 0);
    const avgPrice = filteredProducts.length > 0 ? filteredProducts.reduce((acc, p) => acc + p.price, 0) / filteredProducts.length : 0;
    return { totalUnits, totalRevenue, avgPrice };
  }, [filteredProducts]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/25 border border-indigo-500/30 rounded-xl text-indigo-400">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Qlik Analytics Dashboard</h1>
            <p className="text-xs text-slate-400">Interactive associative analytics & multi-dimensional retail reporting</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => applyDatePreset("today")}
            className="px-3 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-xl text-xs font-bold transition text-slate-300"
          >
            Today
          </button>
          <button
            onClick={() => applyDatePreset("7days")}
            className="px-3 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-xl text-xs font-bold transition text-slate-300"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => applyDatePreset("clear")}
            className="px-3 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-xl text-xs font-bold transition text-slate-300 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Dates</span>
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Revenue</p>
          <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
            ₱{metricsA.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Units Sold</p>
          <p className="text-2xl font-black text-indigo-400 mt-1 font-mono">{metricsA.units.toLocaleString()} pcs</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average Unit Retail (AUR)</p>
          <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
            ₱{metricsA.aur.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Transaction Logs</p>
          <p className="text-2xl font-black text-sky-400 mt-1 font-mono">{metricsA.transactions.toLocaleString()} logs</p>
        </div>
      </div>

      {/* Product Catalog Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wide">Product Catalog & Branches</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product..."
                value={masterCatalogSearch}
                onChange={(e) => setMasterCatalogSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs pl-10 pr-3 py-2 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Master Catalog Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold border-b border-slate-800">
              <tr>
                <th onClick={() => handleMasterSort("styleName")} className="px-4 py-3 cursor-pointer hover:text-white">Style Name / Details</th>
                <th onClick={() => handleMasterSort("department")} className="px-4 py-3 cursor-pointer hover:text-white">Class</th>
                <th className="px-4 py-3">Color & Size</th>
                <th onClick={() => handleMasterSort("price")} className="px-4 py-3 text-right cursor-pointer hover:text-white">Price</th>
                <th onClick={() => handleMasterSort("unitsSold")} className="px-4 py-3 text-right cursor-pointer hover:text-white">Units Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">Loading catalog records...</td>
                </tr>
              ) : paginatedMasterProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 italic font-sans">No matching product records found.</td>
                </tr>
              ) : (
                paginatedMasterProducts.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <span className="font-bold text-emerald-400 block text-sm">{item.styleName}</span>
                      <span className="text-[11px] text-slate-400">Code: {item.styleCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                        {item.department || "General"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <span>{item.color}</span> • <span className="text-white font-bold">{item.size}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400 font-bold">
                      ₱{Number(item.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-300">
                      {item.unitsSold} pcs
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Filtered Totals Footer */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="text-emerald-400 font-bold">
            Filtered Totals ({masterTotalItems} styles):
          </div>
          <div className="flex flex-wrap items-center gap-6 text-slate-300">
            <div>Avg Price: <span className="text-indigo-400 font-bold">₱{tableTotals.avgPrice.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            <div>Total Units: <span className="text-indigo-400 font-bold">{tableTotals.totalUnits} pcs</span></div>
            <div>Est. Revenue: <span className="text-emerald-400 font-bold">₱{tableTotals.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}