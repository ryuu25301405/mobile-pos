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

type DimensionKey = "store" | "department" | "category" | "color" | "size" | "style_code";
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
  { key: "revenue", label: "Total Revenue (₱)", format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` },
  { key: "units", label: "Units Sold", format: (v) => `${v.toLocaleString()} pcs` },
  { key: "aur", label: "Average Unit Retail (₱)", format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` },
  { key: "transactions", label: "Transaction Logs", format: (v) => `${v.toLocaleString()} logs` },
];

const CYCLIC_DIMENSIONS: DimensionConfig[] = [
  { key: "store", label: "Store Location" },
  { key: "department", label: "Department" },
  { key: "category", label: "Category" },
  { key: "color", label: "Color" },
  { key: "size", label: "Size" },
  { key: "style_code", label: "Style Code" },
];

interface StateSelection {
  stores: string[];
  departments: string[];
  categories: string[];
  colors: string[];
  sizes: string[];
  styles: string[];
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [logsRes, invRes, prodRes, auditRes] = await Promise.all([
      supabase.from("scanned_logs").select("id, store, style_code, sku, style_name, description, color, size, category, department, price, quantity, scanned_at").order("scanned_at", { ascending: false }),
      supabase.from("store_inventory").select("*"),
      supabase.from("products").select("*"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100)
    ]);

    if (!logsRes.error && logsRes.data) {
      const parsed: SalesRecord[] = logsRes.data.map((row: any) => {
        const qty = Number(row.quantity) || 1;
        const pr = Number(row.price) || 0;
        const dt = row.scanned_at ? new Date(row.scanned_at) : new Date();
        return {
          id: String(row.id),
          store: row.store || "Unassigned Store",
          style_code: row.style_code || "Unknown Style",
          sku: row.sku || "-",
          style_name: row.style_name || "Unassigned Item",
          description: row.description || "-",
          color: row.color && row.color !== "-" ? row.color : "Unassigned Color",
          size: row.size && row.size !== "-" ? row.size : "Unassigned Size",
          category: row.category && row.category !== "-" ? row.category : "Unassigned Category",
          department: row.department && row.department !== "-" ? row.department : "Unassigned Dept",
          price: pr,
          quantity: qty,
          revenue: pr * qty,
          scanned_at: row.scanned_at,
          scanned_date: dt.toISOString().split("T")[0],
        };
      });
      setData(parsed);
    }

    if (!invRes.error && invRes.data) setInventoryData(invRes.data as InventoryRecord[]);
    if (!prodRes.error && prodRes.data) setProductsMaster(prodRes.data as ProductMasterRecord[]);
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
               (selection.styles.length === 0 || selection.styles.includes(row.style_code));
      });
    },
    [dateFilteredData]
  );

  const currentSubset = useMemo(() => evaluateSubset(stateA), [evaluateSubset, stateA]);

  const { possibleValues, fieldFrequencies } = useMemo(() => {
    const calcPossibleAndFreq = (targetField: "store" | "department" | "category" | "color" | "size") => {
      const subset = dateFilteredData.filter((row) => {
        const mStore = targetField === "store" || stateA.stores.length === 0 || stateA.stores.includes(row.store);
        const mDept = targetField === "department" || stateA.departments.length === 0 || stateA.departments.includes(row.department);
        const mCat = targetField === "category" || stateA.categories.length === 0 || stateA.categories.includes(row.category);
        const mColor = targetField === "color" || stateA.colors.length === 0 || stateA.colors.includes(row.color);
        const mSize = targetField === "size" || stateA.sizes.length === 0 || stateA.sizes.includes(row.size);
        const mStyle = stateA.styles.length === 0 || stateA.styles.includes(row.style_code);
        return mStore && mDept && mCat && mColor && mSize && mStyle;
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
      },
      fieldFrequencies: {
        stores: calcPossibleAndFreq("store").freqMap,
        departments: calcPossibleAndFreq("department").freqMap,
        categories: calcPossibleAndFreq("category").freqMap,
        colors: calcPossibleAndFreq("color").freqMap,
        sizes: calcPossibleAndFreq("size").freqMap,
      },
    };
  }, [dateFilteredData, stateA]);

  const toggleSelection = (field: "store" | "department" | "category" | "color" | "size" | "style_code", value: string) => {
    setStateA((prev) => {
      const fieldKeyMap: Record<string, keyof StateSelection> = { store: "stores", department: "departments", category: "categories", color: "colors", size: "sizes", style_code: "styles" };
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
      const keyVal = item[graphDimensionKey] || "Unknown";
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
    inventoryData.forEach((inv) => {
      if (inv.store && inv.style_code) {
        stockMap[`${inv.store}-${inv.style_code}`] = Number(inv.current_stock) || 0;
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
            price: Number(prod.price) || 299.00,
            unitsSold: salesMap[k]?.units || 0,
            revenue: salesMap[k]?.revenue || 0,
            storeBreakdown,
          });
        });
      });
    } else {
      inventoryData.forEach((inv) => {
        const st = inv.store || "Unassigned Store";
        const styleCode = inv.style_code || "-";
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
          price: Number(inv.price) || 299.00,
          unitsSold: salesMap[k]?.units || 0,
          revenue: salesMap[k]?.revenue || 0,
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
          category: item.category, department: item.department, price: item.price, units: 0, revenue: 0, abcClass: "C", storeBreakdown: {},
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

  const storeCardsSummary = useMemo(() => {
    const map: Record<string, { store: string; totalUnits: number; totalRevenue: number }> = {};
    universe.stores.forEach((st) => map[st] = { store: st, totalUnits: 0, totalRevenue: 0 });
    currentSubset.forEach((item) => {
      if (!map[item.store]) map[item.store] = { store: item.store, totalUnits: 0, totalRevenue: 0 };
      map[item.store].totalUnits += item.quantity;
      map[item.store].totalRevenue += item.revenue;
    });
    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [currentSubset, universe.stores]);

  const selectedBranchProducts = useMemo(() => {
    if (!selectedBranchDetail) return [];
    let list = filteredProducts.filter((p) => (p.storeBreakdown[selectedBranchDetail] || 0) > 0).sort((a, b) => (b.storeBreakdown[selectedBranchDetail] || 0) - (a.storeBreakdown[selectedBranchDetail] || 0));
    if (branchModalTierFilter !== "ALL") list = list.filter((p) => p.abcClass === branchModalTierFilter);
    if (branchModalSearch.trim()) {
      const q = branchModalSearch.toLowerCase().trim();
      list = list.filter((p) => {
        const searchableText = [p.styleCode, p.styleName, p.color, p.size, p.sku].filter(Boolean).join(" ").toLowerCase();
        return searchableText.includes(q);
      });
    }
    return list;
  }, [filteredProducts, selectedBranchDetail, branchModalSearch, branchModalTierFilter]);

  const handleExportExcel = () => {
    const exportData = filteredProducts.map((p) => ({
      "Style Code": p.styleCode,
      "Style Name": p.styleName,
      "SKU": p.sku,
      "Department": p.department,
      "Category": p.category,
      "Color": p.color,
      "Size": p.size,
      "ABC Class": p.abcClass,
      "Price (PHP)": p.price,
      "Units Sold": p.units,
      "Revenue (PHP)": p.revenue,
      "Current Stock": p.currentStock,
      "Days of Supply": p.daysOfSupply > 365 ? "999+" : p.daysOfSupply.toFixed(0),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Analytics");
    XLSX.writeFile(workbook, `Retail_Analytics_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
    setIsExportMenuOpen(false);
    logUserActivity("EXPORT_EXCEL", "Exported sales analytics to Excel spreadsheet");
  };

  const handleExportCSV = () => {
    const exportData = filteredProducts.map((p) => ({
      StyleCode: p.styleCode,
      StyleName: p.styleName,
      Department: p.department,
      Class: p.abcClass,
      Price: p.price,
      UnitsSold: p.units,
      Revenue: p.revenue,
      Stock: p.currentStock,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Retail_Analytics_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
    logUserActivity("EXPORT_CSV", "Exported sales analytics to CSV format");
  };

  const handlePrintExecutivePDF = () => {
    setIsExportMenuOpen(false);
    window.print();
    logUserActivity("PRINT_REPORT", "Triggered executive PDF print report");
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 p-4 sm:p-6 space-y-4 font-sans print:bg-white print:text-black select-none">
      
      {/* CONSOLIDATED HEADER & VIEW NAVIGATION BAR */}
      <nav className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-2xl print:hidden select-none">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-tight text-white">RETAIL CONTROL DECK</span>
              <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                QlikView Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Multi-Branch Associative Visual Analytics</p>
          </div>
        </div>

        {/* CONSOLIDATED VIEW SWITCHERS IN HEADER */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
          <button 
            onClick={() => { setProductViewMode("consolidated"); setSelectedBranchDetail(null); }} 
            className={`px-3 py-1.5 rounded-lg transition font-bold cursor-pointer ${productViewMode === "consolidated" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
          >
            Sales Analytics
          </button>
          <button 
            onClick={() => setProductViewMode("master_catalog")} 
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold cursor-pointer ${productViewMode === "master_catalog" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
          >
            <Database className="w-3.5 h-3.5 text-indigo-400"/> Master Catalog
          </button>
          <button 
            onClick={() => setProductViewMode("replenishment")} 
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold cursor-pointer ${productViewMode === "replenishment" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400"/> Replenishment
          </button>
          <button 
            onClick={() => setProductViewMode("aging_slob")} 
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold cursor-pointer ${productViewMode === "aging_slob" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400"/> Aging / SLOB
          </button>
          <button 
            onClick={() => setProductViewMode("stores_grid")} 
            className={`px-3 py-1.5 rounded-lg transition font-bold cursor-pointer ${productViewMode === "stores_grid" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
          >
            Branches
          </button>
          <button 
            onClick={() => setProductViewMode("audit_logs")} 
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold cursor-pointer ${productViewMode === "audit_logs" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
          >
            <History className="w-3.5 h-3.5 text-purple-400"/> Audit Trail
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* QUICK EXPORT DROPDOWN MENU */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export Reports</span>
              <ChevronDown className="w-3 h-3 text-indigo-400 ml-0.5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition cursor-pointer text-left"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition cursor-pointer text-left"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Export CSV</span>
                </button>
                <div className="border-t border-slate-800 my-1"></div>
                <button
                  onClick={handlePrintExecutivePDF}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition cursor-pointer text-left"
                >
                  <Printer className="w-4 h-4 text-purple-400" />
                  <span>Print Report (PDF)</span>
                </button>
              </div>
            )}
          </div>

          <Link href="/inventory" className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition">
            <Boxes className="w-3.5 h-3.5 text-indigo-400" /><span>Inventory</span>
          </Link>
          <Link href="/scanview" className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition">
            <ScanBarcode className="w-3.5 h-3.5 text-emerald-400" /><span>Scanner</span>
          </Link>
        </div>
      </nav>

      {/* EXECUTIVE KPI STRIP */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 select-none">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl animate-pulse select-none">
              <div className="space-y-2 w-2/3">
                <div className="h-2.5 bg-slate-800 rounded w-1/2"></div>
                <div className="h-6 bg-slate-800 rounded w-3/4"></div>
                <div className="h-2 bg-slate-800 rounded w-1/3"></div>
              </div>
              <div className="w-10 h-10 bg-slate-800 rounded-2xl"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 select-none">
          <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl select-none">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtered Revenue</p>
              <h3 className="text-2xl font-black text-white mt-1">₱{metricsA.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-emerald-400 font-mono mt-1">{metricsA.shareOfTotal.toFixed(1)}% of total universe</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl"><DollarSign className="w-5 h-5" /></div>
          </div>

          <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl select-none">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Units Sold</p>
              <h3 className="text-2xl font-black text-white mt-1">{metricsA.units.toLocaleString()} pcs</h3>
              <p className="text-[10px] text-indigo-400 font-mono mt-1">out of {universe.totalUnits.toLocaleString()} total units</p>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl"><ShoppingBag className="w-5 h-5" /></div>
          </div>

          <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl select-none">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transactions</p>
              <h3 className="text-2xl font-black text-white mt-1">{metricsA.transactions.toLocaleString()} logs</h3>
              <p className="text-[10px] text-blue-400 font-mono mt-1">scanned audit records</p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl"><TrendingUp className="w-5 h-5" /></div>
          </div>

          <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl select-none">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Unit Retail (AUR)</p>
              <h3 className="text-2xl font-black text-white mt-1">₱{metricsA.aur.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-purple-400 font-mono mt-1">per unit retail avg</p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl"><Layers className="w-5 h-5" /></div>
          </div>
        </div>
      )}

      {/* FILTER, DATE RANGE & CONTROLS BAR */}
      <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden select-none">
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            <span>{isSidebarOpen ? "Hide Filter Sidebar" : "Show Filter Sidebar"}</span>
          </button>

          {/* QUICK DATE RANGE PRESETS CHIP BAR */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 select-none">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button onClick={() => applyDatePreset("today")} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-emerald-400 transition cursor-pointer">Today</button>
            <button onClick={() => applyDatePreset("yesterday")} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-emerald-400 transition cursor-pointer">Yesterday</button>
            <button onClick={() => applyDatePreset("7days")} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-emerald-400 transition cursor-pointer">Last 7D</button>
            <button onClick={() => applyDatePreset("month")} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-emerald-400 transition cursor-pointer">This Month</button>
          </div>

          {/* CUSTOM DATE INPUT PICKERS */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs select-none">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              title="Start Date"
            />
            <span className="text-slate-500 font-mono">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              title="End Date"
            />
            {(startDate || endDate) && (
              <button onClick={() => applyDatePreset("clear")} className="text-rose-400 hover:text-rose-300 ml-1 p-0.5 rounded cursor-pointer" title="Clear Date Filter">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 select-none">
          {/* TABLE ROW DENSITY TOGGLE */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setTableDensity("comfortable")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${tableDensity === "comfortable" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
              title="Comfortable Density"
            >
              <Rows3 className="w-3.5 h-3.5" /><span>Comfortable</span>
            </button>
            <button
              onClick={() => setTableDensity("compact")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${tableDensity === "compact" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}
              title="Compact Density"
            >
              <Rows2 className="w-3.5 h-3.5" /><span>Compact</span>
            </button>
          </div>

          <button onClick={() => setIsBookmarkModalOpen(true)} className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">
            <Bookmark className="w-3.5 h-3.5" /><span>Presets</span>
          </button>
          {(stateA.stores.length > 0 || stateA.departments.length > 0 || stateA.categories.length > 0 || stateA.colors.length > 0 || stateA.sizes.length > 0 || stateA.styles.length > 0) && (
            <button onClick={clearCurrentStateSelections} className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer text-xs">
              <RotateCcw className="w-3.5 h-3.5" /><span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE FACETS PILL TRAY */}
      {(stateA.stores.length > 0 || stateA.departments.length > 0 || stateA.categories.length > 0 || stateA.colors.length > 0 || stateA.sizes.length > 0 || stateA.styles.length > 0) && (
        <div className="bg-[#0E1526]/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs print:hidden select-none">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold mr-1">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Filters:</span>
          </div>

          {stateA.stores.map((val) => (
            <span key={`store-${val}`} className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl font-medium shadow-sm">
              <span>Store: {val}</span>
              <button onClick={() => toggleSelection("store", val)} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {stateA.departments.map((val) => (
            <span key={`dept-${val}`} className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-xl font-medium shadow-sm">
              <span>Dept: {val}</span>
              <button onClick={() => toggleSelection("department", val)} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {stateA.categories.map((val) => (
            <span key={`cat-${val}`} className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-xl font-medium shadow-sm">
              <span>Category: {val}</span>
              <button onClick={() => toggleSelection("category", val)} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {stateA.colors.map((val) => (
            <span key={`color-${val}`} className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-xl font-medium shadow-sm">
              <span>Color: {val}</span>
              <button onClick={() => toggleSelection("color", val)} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {stateA.sizes.map((val) => (
            <span key={`size-${val}`} className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-xl font-medium shadow-sm">
              <span>Size: {val}</span>
              <button onClick={() => toggleSelection("size", val)} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {stateA.styles.map((val) => (
            <span key={`style-${val}`} className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-xl font-medium shadow-sm">
              <span>Style: {val}</span>
              <button onClick={() => toggleSelection("style_code", val)} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}

          <button onClick={clearCurrentStateSelections} className="text-xs text-slate-400 hover:text-rose-400 font-semibold underline ml-2 cursor-pointer">
            Clear All Filters
          </button>
        </div>
      )}

      {/* MAIN LAYOUT WITH AUDIT LOG TAB SUPPORT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start select-none">
        
        {/* STICKY SIDEBAR FILTER PANE */}
        {isSidebarOpen && productViewMode !== "audit_logs" && (
          <div className="lg:col-span-3 bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-2xl space-y-4 print:hidden sticky top-4 select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Associative Facets</h3>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dimension Tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              {CYCLIC_DIMENSIONS.map((dim) => {
                const fieldKeyMap: Record<string, keyof StateSelection> = { store: "stores", department: "departments", category: "categories", color: "colors", size: "sizes", style_code: "styles" };
                const count = stateA[fieldKeyMap[dim.key]]?.length || 0;
                return (
                  <button
                    key={dim.key}
                    onClick={() => setActiveSidebarTab(dim.key)}
                    className={`py-2 px-1 rounded-lg font-bold transition truncate cursor-pointer relative ${
                      activeSidebarTab === dim.key
                        ? "bg-slate-800 text-emerald-400 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {dim.label}
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 px-1 py-0.2 rounded-full text-[9px] font-black">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search Input for Current Tab */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${activeSidebarTab}...`}
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs pl-9 pr-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Filter Values List */}
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 [scrollbar-width:thin]">
              {(() => {
                const fieldMap: Record<DimensionKey, { items: string[]; sel: string[]; poss: Set<string>; freq: Record<string, number> }> = {
                  store: { items: universe.stores, sel: stateA.stores, poss: possibleValues.stores, freq: fieldFrequencies.stores },
                  department: { items: universe.departments, sel: stateA.departments, poss: possibleValues.departments, freq: fieldFrequencies.departments },
                  category: { items: universe.categories, sel: stateA.categories, poss: possibleValues.categories, freq: fieldFrequencies.categories },
                  color: { items: universe.colors, sel: stateA.colors, poss: possibleValues.colors, freq: fieldFrequencies.colors },
                  size: { items: universe.sizes, sel: stateA.sizes, poss: possibleValues.sizes, freq: fieldFrequencies.sizes },
                  style_code: { items: universe.styles, sel: stateA.styles, poss: new Set(universe.styles), freq: {} },
                };
                const current = fieldMap[activeSidebarTab];
                const filteredList = current.items.filter((i) => i.toLowerCase().includes(drawerSearch.toLowerCase()));
                if (filteredList.length === 0) return <div className="py-8 text-center text-slate-500 text-xs italic">No matching options found.</div>;

                return filteredList.map((val) => {
                  const isSelected = current.sel.includes(val);
                  const isPossible = activeSidebarTab === "style_code" || current.poss.has(val);
                  const freq = current.freq[val] || 0;
                  return (
                    <div
                      key={val}
                      onClick={() => toggleSelection(activeSidebarTab, val)}
                      className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs border ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold border-emerald-500 shadow-md"
                          : isPossible
                          ? "bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700"
                          : "bg-slate-950/30 text-slate-600 border-slate-900 opacity-40"
                      }`}
                    >
                      <span className="truncate mr-2">{val}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${isSelected ? "bg-emerald-700 text-white" : "bg-slate-900 text-slate-400"}`}>
                        {freq}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* MAIN WORKSPACE AREA WITH AUDIT LOG TAB */}
        <div className={isSidebarOpen && productViewMode !== "audit_logs" ? "lg:col-span-9 select-none" : "lg:col-span-12 select-none"}>

          {/* CONDITIONAL RENDERING: AUDIT LOGS VIEW */}
          {productViewMode === "audit_logs" ? (
            <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4 select-none">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wide">System Audit Trail & Session Logs</h2>
                    <p className="text-xs text-slate-400 font-mono">Real-time operational activity ledger recorded across multi-branch terminals</p>
                  </div>
                </div>
                <button
                  onClick={fetchData}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Refresh Logs
                </button>
              </div>

              <div className="relative overflow-hidden border border-slate-800 rounded-2xl h-[560px] flex flex-col bg-slate-950">
                <div className="overflow-x-auto overflow-y-auto flex-1 [scrollbar-width:thin]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md">
                      <tr>
                        <th className="px-4 py-3.5 border-r border-slate-800">Timestamp</th>
                        <th className="px-4 py-3.5 border-r border-slate-800">Action Type</th>
                        <th className="px-5 py-3.5 border-r border-slate-800">Details / Description</th>
                        <th className="px-4 py-3.5 border-r border-slate-800">Store Context</th>
                        <th className="px-4 py-3.5">User Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-16 text-center text-slate-500 italic">No audit log entries recorded yet.</td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="px-4 py-3 text-slate-400 border-r border-slate-900/50">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3 border-r border-slate-900/50">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                                {log.action_type}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-white border-r border-slate-900/50 font-sans">{log.details}</td>
                            <td className="px-4 py-3 text-indigo-300 border-r border-slate-900/50">{log.store}</td>
                            <td className="px-4 py-3 text-slate-400">{log.user_email}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : productViewMode === "master_catalog" ? (
            <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4 select-none">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wide">All Master Product Catalog</h2>
                    <p className="text-xs text-slate-400 font-mono">Complete database listing with stock and lifetime transaction performance</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-72">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search master catalog by name, style code, SKU..."
                      value={masterCatalogSearch}
                      onChange={(e) => setMasterCatalogSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-xs pl-9 pr-3 py-2.5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs">
                    <StoreIcon className="w-4 h-4 text-indigo-400" />
                    <select
                      value={masterCatalogStoreFilter}
                      onChange={(e) => setMasterCatalogStoreFilter(e.target.value)}
                      className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-bold"
                    >
                      <option value="All Stores" className="bg-slate-900">All Stores</option>
                      {universe.stores.map((st) => (
                        <option key={st} value={st} className="bg-slate-900">{st}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Department:</span>
                <button
                  onClick={() => setMasterCatalogDeptFilter("All Departments")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition border cursor-pointer ${
                    masterCatalogDeptFilter === "All Departments"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  All
                </button>
                {universe.departments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setMasterCatalogDeptFilter(dept)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      masterCatalogDeptFilter === dept
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              {/* UNIFIED CONTAINER WITH FIXED HEADER & SCROLLABLE BODY */}
              <div className="relative overflow-hidden border border-slate-800 rounded-2xl h-[560px] flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1 [scrollbar-width:thin]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md select-none">
                      <tr>
                        <th onClick={() => handleMasterSort("store")} className="px-4 py-3.5 border-r border-slate-800 bg-slate-900 cursor-pointer hover:text-white transition-colors">
                          <div className="flex items-center justify-between">
                            <span>Store</span>
                            {masterSortKey === "store" ? (
                              masterSortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />}
                          </div>
                        </th>
                        <th onClick={() => handleMasterSort("styleName")} className="px-5 py-3.5 border-r border-slate-800 bg-slate-900 cursor-pointer hover:text-white transition-colors">
                          <div className="flex items-center justify-between">
                            <span>Style / Variant Details</span>
                            {masterSortKey === "styleName" ? (
                              masterSortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />}
                          </div>
                        </th>
                        <th onClick={() => handleMasterSort("color")} className="px-4 py-3.5 border-r border-slate-800 bg-slate-900 cursor-pointer hover:text-white transition-colors">
                          <div className="flex items-center justify-between">
                            <span>Color & Size</span>
                            {masterSortKey === "color" ? (
                              masterSortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />}
                          </div>
                        </th>
                        <th onClick={() => handleMasterSort("price")} className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 cursor-pointer hover:text-white transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            <span>Price</span>
                            {masterSortKey === "price" ? (
                              masterSortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />}
                          </div>
                        </th>
                        <th onClick={() => handleMasterSort("currentStock")} className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 cursor-pointer hover:text-white transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            <span>Current Stock</span>
                            {masterSortKey === "currentStock" ? (
                              masterSortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />}
                          </div>
                        </th>
                        <th onClick={() => handleMasterSort("unitsSold")} className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 cursor-pointer hover:text-white transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            <span>Total Units Sold</span>
                            {masterSortKey === "unitsSold" ? (
                              masterSortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />}
                          </div>
                        </th>
                        <th className="px-4 py-3.5 text-right print:hidden bg-slate-900">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs">
                      {loading ? (
                        Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse">
                            <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-20"></div></td>
                            <td className="px-5 py-4"><div className="h-4 bg-slate-800 rounded w-36 mb-1"></div><div className="h-2.5 bg-slate-800 rounded w-24"></div></td>
                            <td className="px-4 py-4"><div className="h-3 bg-slate-800 rounded w-16"></div></td>
                            <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                            <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                            <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                            <td className="px-4 py-4 text-right"><div className="h-6 bg-slate-800 rounded w-16 ml-auto"></div></td>
                          </tr>
                        ))
                      ) : paginatedMasterProducts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-16 text-center">
                            <div className="max-w-sm mx-auto space-y-3">
                              <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                                <FolderSearch className="w-6 h-6" />
                              </div>
                              <h4 className="font-bold text-white text-sm">No Matching Products Found</h4>
                              <p className="text-xs text-slate-400">Try modifying your search query, clearing filters, or switching store locations.</p>
                              <button
                                onClick={() => { setMasterCatalogSearch(""); setMasterCatalogStoreFilter("All Stores"); setMasterCatalogDeptFilter("All Departments"); }}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer"
                              >
                                Reset Catalog Filters
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedMasterProducts.map((prod, idx) => (
                          <tr key={`${prod.id}-${idx}`} className="hover:bg-slate-900/60 transition-colors">
                            <td className="px-4 py-3 font-bold text-indigo-300 border-r border-slate-900/50">{prod.store}</td>
                            <td className="px-5 py-3 font-mono border-r border-slate-900/50 space-y-1">
                              <span className="font-bold text-white block text-sm">{prod.styleName}</span>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>Code: {prod.styleCode}</span>
                                {prod.sku !== "-" && <span className="text-blue-400">SKU: {prod.sku}</span>}
                                <span className="bg-slate-900 text-indigo-300 px-1.5 py-0.2 rounded border border-slate-800">{prod.department}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 border-r border-slate-900/50 text-slate-300">
                              {prod.color} / <strong className="text-white">{prod.size}</strong>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300 border-r border-slate-900/50 text-sm">₱{prod.price.toFixed(0)}</td>
                            <td className={`px-4 py-3 text-right font-mono font-bold border-r border-slate-900/50 text-sm ${prod.currentStock > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {prod.currentStock} pcs
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-indigo-400 font-bold border-r border-slate-900/50 text-sm">{prod.unitsSold} pcs</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap print:hidden">
                              <button
                                onClick={() => {
                                  setInspectedProduct({
                                    key: `${prod.styleCode}-${prod.sku}-${prod.size}-${prod.color}`,
                                    styleCode: prod.styleCode,
                                    sku: prod.sku,
                                    styleName: prod.styleName,
                                    color: prod.color,
                                    size: prod.size,
                                    category: prod.category,
                                    department: prod.department,
                                    price: prod.price,
                                    units: prod.unitsSold,
                                    revenue: prod.revenue,
                                    abcClass: "B",
                                    storeBreakdown: prod.storeBreakdown,
                                    currentStock: prod.currentStock,
                                    safetyStock: 5,
                                    velocity: 0,
                                    daysOfSupply: 30,
                                    stockStatus: prod.currentStock > 0 ? "HEALTHY" : "CRITICAL",
                                    slobStatus: "ACTIVE",
                                    tiedUpCapital: prod.currentStock * prod.price
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                              >
                                <Eye className="w-3.5 h-3.5" /><span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Master Catalog Pagination Footer */}
              <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 bg-slate-950/60 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span>
                    Showing <strong className="text-slate-200">{masterTotalItems === 0 ? 0 : masterStartIndex + 1}</strong> to{" "}
                    <strong className="text-slate-200">{Math.min(masterStartIndex + masterPageSize, masterTotalItems)}</strong> of{" "}
                    <strong className="text-slate-200">{masterTotalItems}</strong> entries
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span>| Show</span>
                    <select
                      value={masterPageSize}
                      onChange={(e) => {
                        setMasterPageSize(Number(e.target.value));
                        setMasterPage(1);
                      }}
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
                    onClick={() => setMasterPage((p) => Math.max(p - 1, 1))}
                    disabled={masterPage === 1 || loading}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer text-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 bg-slate-800 text-slate-200 rounded-lg border border-slate-700 font-medium">
                    {masterPage} / {masterTotalPages}
                  </span>

                  <button
                    onClick={() => setMasterPage((p) => Math.min(p + 1, masterTotalPages))}
                    disabled={masterPage === masterTotalPages || loading}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer text-slate-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (

          /* FULLY EXPANDED SIDE-BY-SIDE WORKSPACE WITH SKELETONS & STICKY FOOTER */
          <div className="bg-[#0E1526]/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-2xl space-y-4 print:bg-white print:border-none print:shadow-none select-none">
            
            {/* Workspace Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 text-xs print:hidden select-none">
              <button onClick={cycleMeasure} className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">
                <Layers className="w-3.5 h-3.5 text-emerald-400" /><span>Measure: {activeMeasure.label} ⟳</span>
              </button>

              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
                <button onClick={() => setVisualizationMode("chart")} className={`px-3.5 py-1.5 rounded-lg transition ${visualizationMode === "chart" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}>Bars</button>
                <button onClick={() => setVisualizationMode("donut")} className={`px-3.5 py-1.5 rounded-lg transition ${visualizationMode === "donut" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}>Proportion Ring</button>
              </div>
            </div>

            {/* EXPANDED SIDE-BY-SIDE GRID WITH UNIFIED HEIGHT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1 select-none">
              
              {/* LEFT PANEL: CHART STAGE */}
              {expandedPanel !== "table" && (
                <div className={`bg-slate-950/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px] ${expandedPanel === "graph" ? "lg:col-span-2" : ""}`}>
                  <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-3 shadow-md shrink-0 select-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-5 bg-emerald-500 rounded-full"></div>
                      <span className="text-sm font-black text-white tracking-wide uppercase">{visualizationMode === "donut" ? "Proportion Share Breakdown" : "Bar Chart Breakdown"}</span>
                    </div>
                    <div className="flex items-center gap-3 print:hidden">
                      <select value={graphDimensionKey} onChange={(e) => setGraphDimensionKey(e.target.value as DimensionKey)} className="bg-slate-900 text-emerald-400 font-bold text-xs border border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer">
                        {CYCLIC_DIMENSIONS.map((dim) => (<option key={dim.key} value={dim.key}>{dim.label}</option>))}
                      </select>
                      <button onClick={() => setExpandedPanel(expandedPanel === "graph" ? "none" : "graph")} className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl transition cursor-pointer" title={expandedPanel === "graph" ? "Restore Split View" : "Maximize Panel"}>
                        {expandedPanel === "graph" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-6 space-y-3 flex-1 flex flex-col justify-center">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl animate-pulse space-y-2">
                          <div className="flex justify-between">
                            <div className="h-3 bg-slate-800 rounded w-1/3"></div>
                            <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                          </div>
                          <div className="h-2.5 bg-slate-800 rounded w-full"></div>
                        </div>
                      ))}
                    </div>
                  ) : visualizationMode === "donut" ? (
                    <div className="p-8 flex flex-col sm:flex-row items-center justify-center gap-10 flex-1 overflow-hidden select-none">
                      {graphRows.length === 0 ? (
                        <div className="w-full text-center space-y-3">
                          <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                            <FolderSearch className="w-6 h-6" />
                          </div>
                          <h4 className="font-bold text-white text-sm">No Data for Current Facets</h4>
                          <p className="text-xs text-slate-400">Try loosening your filters or resetting selections.</p>
                          <button onClick={clearCurrentStateSelections} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer">
                            Reset Facets
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#1E293B" strokeWidth="16" />
                              {donutSlices.map((slice, idx) => {
                                const circumference = 2 * Math.PI * 40;
                                const strokeDasharray = `${(slice.share / 100) * circumference} ${circumference}`;
                                const strokeDashoffset = -((donutSlices.slice(0, idx).reduce((acc, s) => acc + s.share, 0)) / 100) * circumference;
                                return (
                                  <circle key={slice.label} cx="50" cy="50" r="40" fill="transparent" stroke={slice.color} strokeWidth="16" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} onClick={() => toggleSelection(graphDimensionKey, slice.label)} className="cursor-pointer hover:opacity-80 transition-all duration-300" />
                                );
                              })}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
                              <span className="text-xs uppercase font-bold text-slate-400">Total</span>
                              <span className="text-base font-black text-white">{graphRows.length} items</span>
                            </div>
                          </div>
                          <div className="space-y-2.5 overflow-y-auto pr-2 w-full sm:w-72 max-h-[420px] [scrollbar-width:thin] select-none">
                            {graphRows.map((row) => (
                              <div key={row.label} onClick={() => toggleSelection(graphDimensionKey, row.label)} className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-900/60 border border-slate-700/80 hover:border-emerald-500/50 cursor-pointer transition shadow-sm select-none">
                                <div className="flex items-center gap-2.5 truncate mr-2 select-none">
                                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                                  <span className="font-semibold text-white truncate text-sm select-none">{row.label}</span>
                                </div>
                                <div className="font-mono text-emerald-400 font-bold shrink-0 text-sm select-none">{row.share.toFixed(1)}%</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 space-y-3.5 flex-1 overflow-hidden flex flex-col select-none">
                      <div className="overflow-y-auto space-y-3 pr-1 flex-1 [scrollbar-width:thin] select-none">
                        {graphRows.length === 0 ? (
                          <div className="h-full flex items-center justify-center p-12 text-center select-none">
                            <div className="space-y-3 select-none">
                              <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                                <FolderSearch className="w-6 h-6" />
                              </div>
                              <h4 className="font-bold text-white text-sm">No Chart Breakdown Available</h4>
                              <p className="text-xs text-slate-400">No records match the active filter set.</p>
                              <button onClick={clearCurrentStateSelections} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer">
                                Reset Facets
                              </button>
                            </div>
                          </div>
                        ) : (
                          graphRows.map((row) => {
                            const pct = Math.max(6, (row.measureValue / maxGraphMeasureValue) * 100);
                            const displayVal = activeMeasure.key === "units" ? `${row.units.toLocaleString()} pcs` : activeMeasure.key === "transactions" ? `${row.count.toLocaleString()} logs` : activeMeasure.key === "aur" ? `₱${row.aur.toFixed(2)}` : `₱${row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
                            return (
                              <div key={row.label} onClick={() => toggleSelection(graphDimensionKey, row.label)} className="bg-slate-900/60 border border-slate-700/80 hover:border-emerald-500/50 p-3.5 rounded-2xl cursor-pointer transition space-y-2 group shadow-sm select-none">
                                <div className="flex items-center justify-between text-sm select-none">
                                  <span className="font-bold text-white group-hover:text-emerald-400 transition truncate mr-2 select-none">{row.label}</span>
                                  <div className="flex items-center gap-3 font-mono shrink-0 select-none">
                                    <span className="text-xs text-slate-400 select-none">{row.share.toFixed(1)}%</span>
                                    <span className="font-black text-emerald-400 select-none">{displayVal}</span>
                                  </div>
                                </div>
                                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden select-none">
                                  <div style={{ width: `${pct}%`, backgroundColor: row.color }} className="h-full rounded-full transition-all duration-500" />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* RIGHT PANEL: PRODUCT CATALOG WITH SKELETON LOADERS */}
              {expandedPanel !== "graph" && (
                <div className={`bg-slate-950/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px] ${expandedPanel === "table" ? "lg:col-span-2" : ""}`}>
                  <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-3 shadow-md shrink-0 select-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-5 bg-emerald-500 rounded-full"></div>
                      <Package className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-black text-white tracking-wide uppercase">Product Catalog & Branches</span>
                    </div>

                    <div className="flex items-center gap-3 print:hidden">
                      <input type="text" placeholder="Search product..." value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} className="w-36 sm:w-44 bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner" />

                      <button onClick={() => setExpandedPanel(expandedPanel === "table" ? "none" : "table")} className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl transition cursor-pointer shadow-sm" title={expandedPanel === "table" ? "Restore Split View" : "Maximize Panel"}>
                        {expandedPanel === "table" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* FIXED CONTAINER WITH STICKY FOOTER TOTALS */}
                  <div className="relative flex-1 overflow-hidden flex flex-col select-none">
                    <div className={`overflow-x-auto overflow-y-auto flex-1 [scrollbar-width:thin] ${productViewMode === "stores_grid" ? "p-4" : ""}`}>
                      
                      {productViewMode === "consolidated" && (
                        <table className="w-full text-left text-xs border-collapse table-fixed select-none">
                          <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md select-none">
                            <tr>
                              <th style={{ width: columnWidths.style }} className="px-4 py-3.5 border-r border-slate-800 bg-slate-900 relative group select-none">
                                <div className="truncate select-none">Style Name / Details</div>
                                <div onMouseDown={(e) => handleResizeStart(e, "style")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500 transition-colors" />
                              </th>
                              <th style={{ width: columnWidths.class }} className="px-3 py-3.5 border-r border-slate-800 bg-slate-900 relative group select-none">
                                <div className="truncate select-none">Class</div>
                                <div onMouseDown={(e) => handleResizeStart(e, "class")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500 transition-colors" />
                              </th>
                              <th style={{ width: columnWidths.variant }} className="px-3 py-3.5 border-r border-slate-800 bg-slate-900 relative group select-none">
                                <div className="truncate select-none">Color & Size</div>
                                <div onMouseDown={(e) => handleResizeStart(e, "variant")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500 transition-colors" />
                              </th>
                              <th style={{ width: columnWidths.price }} className="px-3 py-3.5 text-right border-r border-slate-800 bg-slate-900 relative group select-none">
                                <div className="truncate select-none">Price</div>
                                <div onMouseDown={(e) => handleResizeStart(e, "price")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500 transition-colors" />
                              </th>
                              <th style={{ width: columnWidths.units }} className="px-3 py-3.5 text-right border-r border-slate-800 bg-slate-900 relative group select-none">
                                <div className="truncate select-none">Units Sold</div>
                                <div onMouseDown={(e) => handleResizeStart(e, "units")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500 transition-colors" />
                              </th>
                              <th className="px-3 py-3.5 text-right print:hidden bg-slate-900 w-20 select-none">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-xs select-none">
                            {loading ? (
                              Array.from({ length: 6 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                  <td className="px-4 py-3"><div className="h-3 bg-slate-800 rounded w-32 mb-1"></div><div className="h-2 bg-slate-800 rounded w-20"></div></td>
                                  <td className="px-3 py-3"><div className="h-4 bg-slate-800 rounded w-8"></div></td>
                                  <td className="px-3 py-3"><div className="h-3 bg-slate-800 rounded w-20 mb-1"></div><div className="h-2 bg-slate-800 rounded w-12"></div></td>
                                  <td className="px-3 py-3 text-right"><div className="h-3 bg-slate-800 rounded w-10 ml-auto"></div></td>
                                  <td className="px-3 py-3 text-right"><div className="h-3 bg-slate-800 rounded w-12 ml-auto"></div></td>
                                  <td className="px-3 py-3 text-right"><div className="h-5 bg-slate-800 rounded w-12 ml-auto"></div></td>
                                </tr>
                              ))
                            ) : filteredProducts.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-16 text-center">
                                  <div className="max-w-sm mx-auto space-y-3">
                                    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                                      <FolderSearch className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-white text-sm">No Products Found</h4>
                                    <p className="text-xs text-slate-400">No records match your keyword search or active facet selections.</p>
                                    <button
                                      onClick={() => { setDetailSearch(""); clearCurrentStateSelections(); }}
                                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer"
                                    >
                                      Clear Search & Filters
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredProducts.map((prod) => (
                                <tr key={prod.key} className="hover:bg-slate-900/60 transition-colors group select-none">
                                  <td className={`px-4 font-mono border-r border-slate-900/50 truncate select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <span className="font-black text-emerald-400 block text-xs truncate select-none">
                                      {prod.styleName !== "-" && prod.styleName !== "Unassigned Item" ? prod.styleName : prod.styleCode}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block truncate select-none">Code: {prod.styleCode}</span>
                                  </td>
                                  <td className={`px-3 whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border select-none ${
                                      prod.abcClass === "A" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                                      prod.abcClass === "B" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" :
                                      "bg-slate-800 text-slate-400 border-slate-700"
                                    }`}>
                                      {prod.abcClass}
                                    </span>
                                  </td>
                                  <td className={`px-3 border-r border-slate-900/50 truncate select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <span className="text-white block font-semibold truncate select-none">{prod.color}</span>
                                    <span className="text-[10px] text-slate-400 block truncate select-none">{prod.size}</span>
                                  </td>
                                  <td className={`px-3 text-right text-slate-300 font-mono text-xs whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>₱{prod.price.toFixed(0)}</td>
                                  <td className={`px-3 text-right font-mono font-bold text-emerald-400 text-xs whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>{prod.units} pcs</td>
                                  <td className={`px-3 text-right whitespace-nowrap print:hidden select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <button onClick={() => setInspectedProduct(prod)} className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer shadow-sm">
                                      <Eye className="w-3 h-3" /><span>View</span>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {productViewMode === "replenishment" && (
                        <table className="w-full text-left text-xs border-collapse select-none">
                          <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md select-none">
                            <tr>
                              <th className="px-5 py-3.5 border-r border-slate-800 bg-slate-900 select-none">Style Variant</th>
                              <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900 select-none">Status</th>
                              <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 select-none">Days of Supply</th>
                              <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 select-none">Daily Vel.</th>
                              <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 select-none">Stock vs Safety</th>
                              <th className="px-5 py-3.5 text-right print:hidden bg-slate-900 select-none">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-xs select-none">
                            {filteredProducts.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-16 text-center select-none">
                                  <div className="max-w-sm mx-auto space-y-3">
                                    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                                      <FolderSearch className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-white text-sm">No Replenishment Records</h4>
                                    <p className="text-xs text-slate-400">All filtered items are currently operating within healthy stock thresholds.</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredProducts.sort((a,b) => a.daysOfSupply - b.daysOfSupply).map((prod) => (
                                <tr key={prod.key} className="hover:bg-slate-900/60 transition-colors group select-none">
                                  <td className={`px-5 font-mono border-r border-slate-900/50 space-y-1 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <span className="font-bold text-emerald-400 block text-xs tracking-wide select-none">{prod.styleCode}</span>
                                    <span className="text-[10px] text-slate-400 select-none">{prod.color} ({prod.size})</span>
                                  </td>
                                  <td className={`px-4 whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    {prod.stockStatus === "CRITICAL" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1 w-max select-none"><AlertTriangle className="w-3 h-3"/> OUT OF STOCK</span>}
                                    {prod.stockStatus === "WARNING" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 w-max select-none"><ShieldAlert className="w-3 h-3"/> LOW STOCK</span>}
                                    {prod.stockStatus === "HEALTHY" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 w-max select-none"><Check className="w-3 h-3"/> HEALTHY</span>}
                                  </td>
                                  <td className={`px-4 text-right border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <span className={`font-black text-xs select-none ${prod.daysOfSupply < 14 ? 'text-rose-400' : prod.daysOfSupply < 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                      {prod.daysOfSupply > 365 ? "999+" : prod.daysOfSupply.toFixed(0)} <span className="text-[9px] font-sans text-slate-500 select-none">Days</span>
                                    </span>
                                  </td>
                                  <td className={`px-4 text-right text-slate-300 font-mono text-xs whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>{prod.velocity.toFixed(2)}/d</td>
                                  <td className={`px-4 text-right font-mono font-bold text-xs whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <span className={prod.currentStock <= prod.safetyStock ? "text-rose-400" : "text-emerald-400"}>{prod.currentStock}</span>
                                    <span className="text-slate-500"> / {prod.safetyStock}</span>
                                  </td>
                                  <td className={`px-5 text-right whitespace-nowrap print:hidden select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <button onClick={() => setInspectedProduct(prod)} className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer shadow-sm">
                                      <Eye className="w-3 h-3" /><span>View</span>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {productViewMode === "aging_slob" && (
                        <table className="w-full text-left text-xs border-collapse select-none">
                          <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md select-none">
                            <tr>
                              <th className="px-5 py-3.5 border-r border-slate-800 bg-slate-900 select-none">Style Variant</th>
                              <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900 select-none">SLOB Status</th>
                              <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 select-none">Units Sold (Period)</th>
                              <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 select-none">Remaining Stock</th>
                              <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900 select-none">Tied Capital</th>
                              <th className="px-5 py-3.5 text-right print:hidden bg-slate-900 select-none">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-xs select-none">
                            {filteredProducts.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-16 text-center select-none">
                                  <div className="max-w-sm mx-auto space-y-3">
                                    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                                      <FolderSearch className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-white text-sm">No Aging or SLOB Items</h4>
                                    <p className="text-xs text-slate-400">No stagnant inventory matches your current search or filters.</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredProducts.sort((a,b) => b.daysOfSupply - a.daysOfSupply).map((prod) => (
                                <tr key={prod.key} className={`transition-colors group select-none ${prod.slobStatus === 'DEAD' ? 'bg-rose-950/10 hover:bg-rose-950/20' : 'hover:bg-slate-900/60'}`}>
                                  <td className={`px-5 font-mono border-r border-slate-900/50 space-y-1 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <span className="font-bold text-emerald-400 block text-xs tracking-wide select-none">{prod.styleCode}</span>
                                    <span className="text-[10px] text-slate-400 select-none">{prod.color} ({prod.size})</span>
                                  </td>
                                  <td className={`px-4 whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    {prod.slobStatus === "DEAD" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1 w-max select-none"><AlertTriangle className="w-3 h-3"/> DEAD STOCK</span>}
                                    {prod.slobStatus === "SLOW" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 w-max select-none"><Clock className="w-3 h-3"/> SLOW MOVING</span>}
                                    {prod.slobStatus === "ACTIVE" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 w-max select-none"><Activity className="w-3 h-3"/> ACTIVE</span>}
                                  </td>
                                  <td className={`px-4 text-right border-r border-slate-900/50 font-bold text-slate-300 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>{prod.units}</td>
                                  <td className={`px-4 text-right font-mono font-bold text-xs whitespace-nowrap border-r border-slate-900/50 text-emerald-400 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    {prod.currentStock}
                                  </td>
                                  <td className={`px-4 text-right text-rose-400 font-mono font-bold text-xs whitespace-nowrap border-r border-slate-900/50 select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>₱{prod.tiedUpCapital.toLocaleString()}</td>
                                  <td className={`px-5 text-right whitespace-nowrap print:hidden select-none ${tableDensity === "compact" ? "py-2" : "py-3.5"}`}>
                                    <button onClick={() => setInspectedProduct(prod)} className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer shadow-sm">
                                      <Eye className="w-3 h-3" /><span>View</span>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {productViewMode === "stores_grid" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 select-none">
                          {storeCardsSummary.length === 0 ? (
                            <div className="col-span-full p-16 text-center select-none">
                              <div className="max-w-sm mx-auto space-y-3 select-none">
                                <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                                  <FolderSearch className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-white text-sm">No Branch Data Available</h4>
                                <p className="text-xs text-slate-400">No branch metrics match your current filter criteria.</p>
                              </div>
                            </div>
                          ) : (
                            storeCardsSummary.map((storeCard) => (
                              <div key={storeCard.store} onClick={() => { setSelectedBranchDetail(storeCard.store); setBranchModalSearch(""); setBranchModalTierFilter("ALL"); setIsBranchModalExpanded(false); }} className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-4 cursor-pointer transition space-y-3 group shadow-xl select-none">
                                <div className="flex items-center justify-between select-none">
                                  <div className="flex items-center gap-2.5 truncate mr-2 select-none">
                                    <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition shrink-0"><Building2 className="w-4 h-4" /></div>
                                    <h4 className="font-bold text-white text-xs truncate select-none">{storeCard.store}</h4>
                                  </div>
                                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition shrink-0 select-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80 text-xs font-mono select-none">
                                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 select-none">
                                    <span className="text-[9px] text-slate-500 uppercase block font-sans select-none">Units Sold</span>
                                    <span className="text-emerald-400 font-bold text-sm select-none">{storeCard.totalUnits.toLocaleString()} pcs</span>
                                  </div>
                                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 select-none">
                                    <span className="text-[9px] text-slate-500 uppercase block font-sans select-none">Branch Revenue</span>
                                    <span className="text-indigo-400 font-bold text-sm select-none">₱{storeCard.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 0 })}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* STICKY FOOTER SUMMARY ROW FOR CONSOLIDATED VIEW */}
                    {productViewMode === "consolidated" && filteredProducts.length > 0 && (
                      <div className="bg-slate-900 border-t-2 border-emerald-500/40 px-5 py-3 flex items-center justify-between text-xs font-mono font-bold text-white shrink-0 shadow-lg select-none">
                        <div className="flex items-center gap-2 select-none">
                          <Sigma className="w-4 h-4 text-emerald-400 select-none" />
                          <span className="select-none">Filtered Totals ({filteredProducts.length} styles):</span>
                        </div>
                        <div className="flex items-center gap-6 select-none">
                          <span className="select-none">Avg Price: <strong className="text-indigo-400 select-none">₱{tableTotals.avgPrice.toFixed(2)}</strong></span>
                          <span className="select-none">Total Units: <strong className="text-emerald-400 select-none">{tableTotals.totalUnits.toLocaleString()} pcs</strong></span>
                          <span className="text-emerald-300 select-none">Est. Revenue: <strong className="select-none">₱{tableTotals.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* ENHANCED BRANCH DEEP-DIVE MODAL WITH EXPANDED VIEW TOGGLE */}
      {selectedBranchDetail && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className={`bg-[#0E1526] border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4 text-left transition-all duration-300 flex flex-col select-none ${
            isBranchModalExpanded ? "w-full h-full max-w-none max-h-none m-2" : "w-full max-w-2xl max-h-[90vh]"
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0 select-none">
              <div className="flex items-center gap-3 select-none">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl select-none">
                  <Building2 className="w-5 h-5 select-none" />
                </div>
                <div className="select-none">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 select-none">Branch Inventory Breakdown</span>
                  <h2 className="text-base font-bold text-white select-none">{selectedBranchDetail}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2 select-none">
                <button
                  onClick={() => setIsBranchModalExpanded(!isBranchModalExpanded)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer select-none"
                  title={isBranchModalExpanded ? "Minimize Modal" : "Expand Full Screen"}
                >
                  {isBranchModalExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setSelectedBranchDetail(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer select-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 shrink-0 select-none">
              <div className="relative flex-1 select-none">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 select-none" />
                <input
                  type="text"
                  placeholder="Search style code, name, color..."
                  value={branchModalSearch}
                  onChange={(e) => setBranchModalSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs pl-9 pr-3 py-2.5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs select-none">
                <span className="text-[10px] uppercase text-slate-500 font-bold px-2 select-none">Tier:</span>
                {(["ALL", "A", "B", "C"] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setBranchModalTierFilter(tier)}
                    className={`px-3 py-1 rounded-lg transition font-bold text-xs select-none ${
                      branchModalTierFilter === tier
                        ? "bg-emerald-500 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div className={`overflow-y-auto space-y-2 pr-1 flex-1 [scrollbar-width:thin] select-none`}>
              {selectedBranchProducts.length === 0 ? (
                <div className="p-16 text-center select-none">
                  <div className="max-w-sm mx-auto space-y-3 select-none">
                    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500 select-none">
                      <FolderSearch className="w-6 h-6 select-none" />
                    </div>
                    <h4 className="font-bold text-white text-sm select-none">No Branch Items Found</h4>
                    <p className="text-xs text-slate-400 select-none">No products match your search or tier filter for this store.</p>
                  </div>
                </div>
              ) : (
                selectedBranchProducts.map((prod) => (
                  <div key={prod.key} className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between text-xs select-none">
                    <div className="space-y-1 select-none">
                      <div className="flex items-center gap-2 select-none">
                        <span className="font-bold text-white block text-sm select-none">{prod.styleName !== "-" ? prod.styleName : prod.styleCode}</span>
                        <span className={`text-[10px] font-black px-2 py-0.2 rounded border select-none ${
                          prod.abcClass === "A" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          prod.abcClass === "B" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" :
                          "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          Class {prod.abcClass}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono select-none">Code: {prod.styleCode} • {prod.color} ({prod.size})</span>
                    </div>
                    <div className="text-right font-mono select-none">
                      <span className="font-black text-emerald-400 text-base block select-none">{prod.storeBreakdown[selectedBranchDetail] || 0} pcs</span>
                      <span className="text-[11px] text-slate-500 select-none">₱{prod.price.toFixed(0)} / unit</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400 shrink-0 select-none">
              <span className="select-none">Showing {selectedBranchProducts.length} items</span>
              <button
                onClick={() => setSelectedBranchDetail(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl transition cursor-pointer select-none"
              >
                Close Branch View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL */}
      {inspectedProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden select-none">
          <div className="bg-[#0E1526] border border-slate-700/80 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-left select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 select-none">
              <div className="select-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full select-none">
                  SKU Inspection & Performance Audit
                </span>
                <h2 className="text-lg font-bold text-white mt-1 select-none">{inspectedProduct.styleName}</h2>
              </div>
              <button onClick={() => setInspectedProduct(null)} className="text-slate-500 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800 select-none">
                <X className="w-5 h-5 select-none" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 select-none">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 select-none">
                <p className="text-[10px] uppercase font-bold text-slate-500 select-none">Style Code</p>
                <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5 select-none">{inspectedProduct.styleCode}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 select-none">
                <p className="text-[10px] uppercase font-bold text-slate-500 select-none">Variant</p>
                <p className="text-xs font-semibold text-white mt-0.5 select-none">{inspectedProduct.color} / {inspectedProduct.size}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 select-none">
                <p className="text-[10px] uppercase font-bold text-slate-500 select-none">Pareto Tier</p>
                <p className="text-xs font-bold text-indigo-400 mt-0.5 select-none">Class {inspectedProduct.abcClass}</p>
              </div>
            </div>

            <div className="space-y-2 select-none">
              <div className="flex items-center justify-between text-xs px-1 select-none">
                <span className="text-slate-400 font-bold uppercase tracking-wider select-none">Multi-Branch Sales Breakdown</span>
                <span className="text-slate-500 font-mono select-none">total scan logs</span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 select-none">
                {Object.entries(inspectedProduct.storeBreakdown).map(([storeName, qty]) => (
                  <div key={storeName} className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs select-none">
                    <div className="flex items-center gap-2 select-none">
                      <StoreIcon className="w-3.5 h-3.5 text-indigo-400 select-none" />
                      <span className="font-bold text-white select-none">{storeName}</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono select-none">
                      <span className="text-emerald-400 font-bold select-none">{qty} pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 select-none">
              <button
                onClick={() => setInspectedProduct(null)}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer select-none"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKMARKS MANAGER MODAL */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden select-none">
          <div className="bg-[#0E1526] border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 text-left select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 select-none">
              <div className="select-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full select-none">
                  Saved Selection Presets
                </span>
                <h2 className="text-lg font-bold text-white mt-1 select-none">Bookmarks Manager</h2>
              </div>
              <button onClick={() => setIsBookmarkModalOpen(false)} className="text-slate-500 hover:text-white cursor-pointer select-none">
                <X className="w-5 h-5 select-none" />
              </button>
            </div>

            <form onSubmit={saveBookmark} className="space-y-3 select-none">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block select-none">
                Save Current Filter State
              </label>
              <div className="flex gap-2 select-none">
                <input
                  type="text"
                  placeholder="e.g. Q3 Metro Gaisano Audit..."
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer select-none">
                  Save Preset
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 select-none">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-2 select-none">
                Your Saved Presets ({bookmarks.length})
              </p>
              {bookmarks.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-slate-800 border-dashed rounded-xl select-none">
                  No bookmarks saved yet. Configure your filters and save a preset!
                </div>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => {
                      loadBookmark(bm);
                      setIsBookmarkModalOpen(false);
                    }}
                    className="bg-slate-950 border border-slate-800 hover:border-amber-500/60 p-3 rounded-xl flex items-center justify-between cursor-pointer transition group select-none"
                  >
                    <div className="select-none">
                      <p className="font-bold text-white text-xs group-hover:text-amber-400 transition select-none">{bm.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 select-none">
                        {bm.startDate && bm.endDate ? `${bm.startDate} to ${bm.endDate}` : "All Time"}
                      </p>
                    </div>
                    <button onClick={(e) => deleteBookmark(bm.id, e)} className="text-slate-600 hover:text-rose-400 p-1.5 transition rounded-lg hover:bg-slate-900 cursor-pointer select-none">
                      <Trash2 className="w-3.5 h-3.5 select-none" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}