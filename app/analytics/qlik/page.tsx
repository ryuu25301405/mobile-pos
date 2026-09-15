"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx-js-style";
import {
  Filter,
  RotateCcw,
  Boxes,
  BarChart3,
  Layers,
  ArrowRightLeft,
  Check,
  X,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CornerLeftUp,
  ChevronRight,
  Package,
  Search,
  Calendar,
  Download,
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  PieChart as PieChartIcon,
  Table,
  ChevronDown,
  Bookmark,
  BookmarkPlus,
  Trash2,
  ScanBarcode,
  LayoutDashboard,
  SlidersHorizontal,
  Eye,
  Store as StoreIcon,
  Grid,
  List,
  Maximize2,
  Minimize2,
  Printer,
  Building2,
  ArrowRight,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Activity,
  Database
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
  {
    key: "revenue",
    label: "Total Revenue (₱)",
    format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
  },
  {
    key: "units",
    label: "Units Sold",
    format: (v) => `${v.toLocaleString()} pcs`,
  },
  {
    key: "aur",
    label: "Average Unit Retail (₱)",
    format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
  },
  {
    key: "transactions",
    label: "Transaction Logs",
    format: (v) => `${v.toLocaleString()} logs`,
  },
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
  const [loading, setLoading] = useState(true);

  const [isComparativeMode, setIsComparativeMode] = useState<boolean>(false);
  const [activeEditingState, setActiveEditingState] = useState<"A" | "B">("A");

  const [stateA, setStateA] = useState<StateSelection>(EMPTY_SELECTIONS);
  const [stateB, setStateB] = useState<StateSelection>(EMPTY_SELECTIONS);

  const [bookmarks, setBookmarks] = useState<BookmarkPreset[]>([]);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [newBookmarkName, setNewBookmarkName] = useState("");

  const [activeMeasureIndex, setActiveMeasureIndex] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");

  const [visualizationMode, setVisualizationMode] = useState<"chart" | "donut">("chart");
  const [graphDimensionKey, setGraphDimensionKey] = useState<DimensionKey>("store");
  const [productViewMode, setProductViewMode] = useState<"consolidated" | "master_catalog" | "stores_grid" | "replenishment" | "aging_slob">("consolidated");
  
  const [masterCatalogSearch, setMasterCatalogSearch] = useState<string>("");
  const [masterCatalogStoreFilter, setMasterCatalogStoreFilter] = useState<string>("All Stores");

  const [selectedBranchDetail, setSelectedBranchDetail] = useState<string | null>(null);
  const [branchModalSearch, setBranchModalSearch] = useState<string>("");
  const [branchModalTierFilter, setBranchModalTierFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [isBranchModalExpanded, setIsBranchModalExpanded] = useState<boolean>(false);

  const [expandedPanel, setExpandedPanel] = useState<"none" | "graph" | "table">("none");

  const [detailSearch, setDetailSearch] = useState("");
  const [activeFilterDrawer, setActiveFilterDrawer] = useState<DimensionKey | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");

  const [inspectedProduct, setInspectedProduct] = useState<ProductSummaryItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [logsRes, invRes, prodRes] = await Promise.all([
      supabase.from("scanned_logs").select("id, store, style_code, sku, style_name, description, color, size, category, department, price, quantity, scanned_at").order("scanned_at", { ascending: false }),
      supabase.from("store_inventory").select("*"),
      supabase.from("products").select("*")
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

    if (!invRes.error && invRes.data) {
      setInventoryData(invRes.data as InventoryRecord[]);
    }

    if (!prodRes.error && prodRes.data) {
      setProductsMaster(prodRes.data as ProductMasterRecord[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem("qlik_analytics_bookmarks");
    if (saved) {
      try { setBookmarks(JSON.parse(saved)); } catch (e) { console.error("Failed to parse bookmarks", e); }
    }
  }, [fetchData]);

  const saveBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmarkName.trim()) return;
    const newBm: BookmarkPreset = { id: Date.now().toString(), name: newBookmarkName.trim(), selection: activeSelection, startDate, endDate };
    const updated = [newBm, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem("qlik_analytics_bookmarks", JSON.stringify(updated));
    setNewBookmarkName("");
    setIsBookmarkModalOpen(false);
  };

  const loadBookmark = (bm: BookmarkPreset) => {
    setActiveSelection(() => bm.selection);
    setStartDate(bm.startDate);
    setEndDate(bm.endDate);
    setDatePreset("custom");
  };

  const deleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem("qlik_analytics_bookmarks", JSON.stringify(updated));
  };

  const applyDatePreset = (preset: "today" | "yesterday" | "7days" | "30days" | "all") => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "all") { setStartDate(""); setEndDate(""); return; }
    if (preset === "today") { const s = formatDate(today); setStartDate(s); setEndDate(s); }
    else if (preset === "yesterday") { const y = new Date(today); y.setDate(y.getDate() - 1); const s = formatDate(y); setStartDate(s); setEndDate(s); }
    else if (preset === "7days") { const past = new Date(today); past.setDate(past.getDate() - 6); setStartDate(formatDate(past)); setEndDate(formatDate(today)); }
    else if (preset === "30days") { const past = new Date(today); past.setDate(past.getDate() - 29); setStartDate(formatDate(past)); setEndDate(formatDate(today)); }
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

  const activeSelection = isComparativeMode ? (activeEditingState === "A" ? stateA : stateB) : stateA;

  const setActiveSelection = (fn: (prev: StateSelection) => StateSelection) => {
    if (!isComparativeMode || activeEditingState === "A") setStateA(fn);
    else setStateB(fn);
  };

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
        const mStore = targetField === "store" || activeSelection.stores.length === 0 || activeSelection.stores.includes(row.store);
        const mDept = targetField === "department" || activeSelection.departments.length === 0 || activeSelection.departments.includes(row.department);
        const mCat = targetField === "category" || activeSelection.categories.length === 0 || activeSelection.categories.includes(row.category);
        const mColor = targetField === "color" || activeSelection.colors.length === 0 || activeSelection.colors.includes(row.color);
        const mSize = targetField === "size" || activeSelection.sizes.length === 0 || activeSelection.sizes.includes(row.size);
        const mStyle = activeSelection.styles.length === 0 || activeSelection.styles.includes(row.style_code);
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
  }, [dateFilteredData, activeSelection]);

  const toggleSelection = (field: "store" | "department" | "category" | "color" | "size" | "style_code", value: string) => {
    setActiveSelection((prev) => {
      const fieldKeyMap: Record<string, keyof StateSelection> = { store: "stores", department: "departments", category: "categories", color: "colors", size: "sizes", style_code: "styles" };
      const key = fieldKeyMap[field];
      const exists = prev[key].includes(value);
      return { ...prev, [key]: exists ? prev[key].filter((v) => v !== value) : [...prev[key], value] };
    });
  };

  const clearCurrentStateSelections = () => { setActiveSelection(() => EMPTY_SELECTIONS); };

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

  // Master Catalog: Driven by the `products` table as the primary source of truth
  const masterCatalogProducts = useMemo(() => {
    const stockMap: Record<string, number> = {};
    inventoryData.forEach((inv) => {
      stockMap[`${inv.store}-${inv.style_code}`] = Number(inv.current_stock) || 0;
    });

    const salesMap: Record<string, { units: number; revenue: number }> = {};
    data.forEach((log) => {
      const k = `${log.store}-${log.style_code}`;
      if (!salesMap[k]) salesMap[k] = { units: 0, revenue: 0 };
      salesMap[k].units += log.quantity;
      salesMap[k].revenue += log.revenue;
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
    }> = [];

    const storesList = universe.stores.length > 0 ? universe.stores : ["Unassigned Store"];

    if (productsMaster.length > 0) {
      productsMaster.forEach((prod) => {
        storesList.forEach((st) => {
          const k = `${st}-${prod.style_code}`;
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
          });
        });
      });
    } else {
      inventoryData.forEach((inv) => {
        const k = `${inv.store}-${inv.style_code}`;
        list.push({
          id: inv.id,
          store: inv.store || "Unassigned Store",
          styleCode: inv.style_code || "-",
          sku: inv.sku || "-",
          styleName: inv.style_name || inv.style_code,
          color: inv.color || "Default",
          size: inv.size || "Free Size",
          department: inv.department || "General",
          category: inv.category || "General",
          currentStock: Number(inv.current_stock) || 0,
          price: Number(inv.price) || 299.00,
          unitsSold: salesMap[k]?.units || 0,
          revenue: salesMap[k]?.revenue || 0,
        });
      });
    }

    let filtered = list;
    if (masterCatalogStoreFilter !== "All Stores") {
      filtered = filtered.filter((p) => p.store === masterCatalogStoreFilter);
    }

    if (masterCatalogSearch.trim()) {
      const q = masterCatalogSearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.styleCode.toLowerCase().includes(q) ||
          p.styleName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.store.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q) ||
          p.size.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => b.unitsSold - a.unitsSold);
  }, [productsMaster, inventoryData, data, universe.stores, masterCatalogSearch, masterCatalogStoreFilter]);

  const filteredProducts = useMemo(() => {
    let daysInPeriod = 30;
    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      daysInPeriod = Math.max(1, (e - s) / (1000 * 3600 * 24));
    }

    const map: Record<string, ProductSummaryItem> = {};
    const validStores = activeSelection.stores.length > 0 ? activeSelection.stores : universe.stores;
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
    const q = detailSearch.toLowerCase();
    return classifiedList.filter((p) => p.styleCode.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.styleName.toLowerCase().includes(q) || p.color.toLowerCase().includes(q) || p.size.toLowerCase().includes(q));
  }, [currentSubset, detailSearch, inventoryData, activeSelection.stores, universe.stores, startDate, endDate]);

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
      const q = branchModalSearch.toLowerCase();
      list = list.filter((p) => p.styleCode.toLowerCase().includes(q) || p.styleName.toLowerCase().includes(q) || p.color.toLowerCase().includes(q) || p.size.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return list;
  }, [filteredProducts, selectedBranchDetail, branchModalSearch, branchModalTierFilter]);

  const handlePrintExecutivePDF = () => window.print();

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 p-4 sm:p-6 space-y-4 font-sans print:bg-white print:text-black">
      
      {/* HEADER & NAV */}
      <nav className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-2xl print:hidden">
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

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handlePrintExecutivePDF} className="flex items-center gap-1.5 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">
            <Printer className="w-3.5 h-3.5 text-indigo-400" /><span>Export Executive PDF</span>
          </button>
          <Link href="/analytics/qlik" className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold transition">
            <BarChart3 className="w-3.5 h-3.5" /><span>Analytics Hub</span>
          </Link>
          <Link href="/inventory" className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition">
            <Boxes className="w-3.5 h-3.5 text-indigo-400" /><span>Store Inventory</span>
          </Link>
          <Link href="/scanview" className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition">
            <ScanBarcode className="w-3.5 h-3.5 text-emerald-400" /><span>Scanner</span>
          </Link>
        </div>
      </nav>

      {/* EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtered Revenue</p>
            <h3 className="text-2xl font-black text-white mt-1">₱{metricsA.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-emerald-400 font-mono mt-1">{metricsA.shareOfTotal.toFixed(1)}% of total universe</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl"><DollarSign className="w-5 h-5" /></div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Units Sold</p>
            <h3 className="text-2xl font-black text-white mt-1">{metricsA.units.toLocaleString()} pcs</h3>
            <p className="text-[10px] text-indigo-400 font-mono mt-1">out of {universe.totalUnits.toLocaleString()} total units</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl"><ShoppingBag className="w-5 h-5" /></div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transactions</p>
            <h3 className="text-2xl font-black text-white mt-1">{metricsA.transactions.toLocaleString()} logs</h3>
            <p className="text-[10px] text-blue-400 font-mono mt-1">scanned audit records</p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl"><TrendingUp className="w-5 h-5" /></div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Unit Retail (AUR)</p>
            <h3 className="text-2xl font-black text-white mt-1">₱{metricsA.aur.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-purple-400 font-mono mt-1">per unit retail avg</p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl"><Layers className="w-5 h-5" /></div>
        </div>
      </div>

      {/* STREAMLINED FILTER & CONTROLS BAR */}
      <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase tracking-wider text-[11px] mr-1">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" /><span>Facets:</span>
          </div>
          {CYCLIC_DIMENSIONS.map((dim) => {
            const fieldKeyMap: Record<string, keyof StateSelection> = { store: "stores", department: "departments", category: "categories", color: "colors", size: "sizes", style_code: "styles" };
            const count = activeSelection[fieldKeyMap[dim.key]]?.length || 0;
            return (
              <button key={dim.key} onClick={() => setActiveFilterDrawer(activeFilterDrawer === dim.key ? null : dim.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${count > 0 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : activeFilterDrawer === dim.key ? "bg-slate-800 text-white border-slate-700" : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"}`}
              >
                <span>{dim.label}</span>
                {count > 0 && <span className="bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md text-[10px] font-black">{count}</span>}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsBookmarkModalOpen(true)} className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">
            <Bookmark className="w-3.5 h-3.5" /><span>Presets</span>
          </button>
          {(activeSelection.stores.length > 0 || activeSelection.departments.length > 0 || activeSelection.categories.length > 0 || activeSelection.colors.length > 0 || activeSelection.sizes.length > 0 || activeSelection.styles.length > 0) && (
            <button onClick={clearCurrentStateSelections} className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer text-xs">
              <RotateCcw className="w-3.5 h-3.5" /><span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER DRAWER POPUP */}
      {activeFilterDrawer && (
        <div className="bg-[#0E1526] border border-slate-700/80 rounded-2xl p-4 shadow-2xl space-y-3 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Filtering: {CYCLIC_DIMENSIONS.find((d) => d.key === activeFilterDrawer)?.label}</h3>
            </div>
            <button onClick={() => { setActiveFilterDrawer(null); setDrawerSearch(""); }} className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search filter values..." value={drawerSearch} onChange={(e) => setDrawerSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-xs pl-9 pr-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500" autoFocus />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
            {(() => {
              const fieldMap: Record<DimensionKey, { items: string[]; sel: string[]; poss: Set<string>; freq: Record<string, number> }> = {
                store: { items: universe.stores, sel: activeSelection.stores, poss: possibleValues.stores, freq: fieldFrequencies.stores },
                department: { items: universe.departments, sel: activeSelection.departments, poss: possibleValues.departments, freq: fieldFrequencies.departments },
                category: { items: universe.categories, sel: activeSelection.categories, poss: possibleValues.categories, freq: fieldFrequencies.categories },
                color: { items: universe.colors, sel: activeSelection.colors, poss: possibleValues.colors, freq: fieldFrequencies.colors },
                size: { items: universe.sizes, sel: activeSelection.sizes, poss: possibleValues.sizes, freq: fieldFrequencies.sizes },
                style_code: { items: universe.styles, sel: activeSelection.styles, poss: new Set(universe.styles), freq: {} },
              };
              const current = fieldMap[activeFilterDrawer];
              const filteredList = current.items.filter((i) => i.toLowerCase().includes(drawerSearch.toLowerCase()));
              if (filteredList.length === 0) return <div className="col-span-full py-4 text-center text-slate-500 text-xs italic">No matching options found.</div>;

              return filteredList.map((val) => {
                const isSelected = current.sel.includes(val);
                const isPossible = activeFilterDrawer === "style_code" || current.poss.has(val);
                const freq = current.freq[val] || 0;
                return (
                  <div key={val} onClick={() => toggleSelection(activeFilterDrawer, val)} className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs border ${isSelected ? "bg-emerald-600 text-white font-bold border-emerald-500 shadow-md" : isPossible ? "bg-slate-950/80 text-slate-200 border-slate-800 hover:border-slate-700" : "bg-slate-950/30 text-slate-600 border-slate-900 opacity-40"}`}>
                    <span className="truncate mr-1">{val}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isSelected ? "bg-emerald-700 text-white" : "bg-slate-900 text-slate-400"}`}>{freq}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* VIEW SELECTOR TOGGLE BAR FOR WORKSPACE / MASTER CATALOG */}
      <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">View Mode:</span>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
            <button onClick={() => { setProductViewMode("consolidated"); setSelectedBranchDetail(null); }} className={`px-3.5 py-1.5 rounded-lg transition ${productViewMode === "consolidated" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}>Sales Analytics Workspace</button>
            <button onClick={() => setProductViewMode("master_catalog")} className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${productViewMode === "master_catalog" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}><Database className="w-3.5 h-3.5 text-indigo-400"/> All Master Catalog</button>
            <button onClick={() => setProductViewMode("replenishment")} className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${productViewMode === "replenishment" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}><Activity className="w-3.5 h-3.5 text-emerald-400"/> Replenishment</button>
            <button onClick={() => setProductViewMode("aging_slob")} className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${productViewMode === "aging_slob" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}><Clock className="w-3.5 h-3.5 text-amber-400"/> Aging / SLOB</button>
            <button onClick={() => setProductViewMode("stores_grid")} className={`px-3 py-1.5 rounded-lg transition ${productViewMode === "stores_grid" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}>Branches</button>
          </div>
        </div>
      </div>

      {/* CONDITIONAL RENDERING: IF ALL MASTER IS SELECTED, DISPLAY AS ITS OWN FULL-WIDTH SECTION */}
      {productViewMode === "master_catalog" ? (
        <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4">
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

            {/* SEPARATED TOOLBAR CONTROLS */}
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

          <div className="relative overflow-x-auto max-h-[700px] [scrollbar-width:thin]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md">
                <tr>
                  <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900">Store</th>
                  <th className="px-5 py-3.5 border-r border-slate-800 bg-slate-900">Style / Variant Details</th>
                  <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900">Color & Size</th>
                  <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Price</th>
                  <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Current Stock</th>
                  <th className="px-4 py-3.5 text-right bg-slate-900">Total Units Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {masterCatalogProducts.length === 0 ? (
                  <tr><td colSpan={6} className="p-16 text-center text-slate-500 text-sm">No products found matching your search or branch filter.</td></tr>
                ) : (
                  masterCatalogProducts.map((prod, idx) => (
                    <tr key={`${prod.id}-${idx}`} className="hover:bg-slate-900/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-indigo-300 border-r border-slate-900/50">{prod.store}</td>
                      <td className="px-5 py-3 font-mono border-r border-slate-900/50">
                        <span className="font-bold text-white block text-sm">{prod.styleName}</span>
                        <span className="text-[11px] text-slate-400">Code: {prod.styleCode} {prod.sku !== "-" ? `• SKU: ${prod.sku}` : ""}</span>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-900/50 text-slate-300">
                        {prod.color} / <strong className="text-white">{prod.size}</strong>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300 border-r border-slate-900/50 text-sm">₱{prod.price.toFixed(0)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold border-r border-slate-900/50 text-sm ${prod.currentStock > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {prod.currentStock} pcs
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-400 font-bold text-sm">{prod.unitsSold} pcs</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (

      /* 4. FULLY EXPANDED SIDE-BY-SIDE WORKSPACE FOR OTHER VIEWS */
      <div className="bg-[#0E1526]/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-2xl space-y-4 print:bg-white print:border-none print:shadow-none">
        
        {/* Workspace Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 text-xs print:hidden">
          <button onClick={cycleMeasure} className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">
            <Layers className="w-3.5 h-3.5 text-emerald-400" /><span>Measure: {activeMeasure.label} ⟳</span>
          </button>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
            <button onClick={() => setVisualizationMode("chart")} className={`px-3.5 py-1.5 rounded-lg transition ${visualizationMode === "chart" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}>Bars</button>
            <button onClick={() => setVisualizationMode("donut")} className={`px-3.5 py-1.5 rounded-lg transition ${visualizationMode === "donut" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"}`}>Proportion Ring</button>
          </div>
        </div>

        {/* EXPANDED SIDE-BY-SIDE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
          
          {/* LEFT PANEL: CHART STAGE */}
          {expandedPanel !== "table" && (
            <div className={`bg-slate-950/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[640px] ${expandedPanel === "graph" ? "lg:col-span-2" : ""}`}>
              <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-3 shadow-md shrink-0">
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

              {visualizationMode === "donut" ? (
                <div className="p-8 flex flex-col sm:flex-row items-center justify-center gap-10 flex-1 overflow-hidden">
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-xs uppercase font-bold text-slate-400">Total</span>
                      <span className="text-base font-black text-white">{graphRows.length} items</span>
                    </div>
                  </div>
                  <div className="space-y-2.5 overflow-y-auto pr-2 w-full sm:w-72 max-h-[460px] [scrollbar-width:thin]">
                    {graphRows.map((row) => (
                      <div key={row.label} onClick={() => toggleSelection(graphDimensionKey, row.label)} className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-900/60 border border-slate-700/80 hover:border-emerald-500/50 cursor-pointer transition shadow-sm">
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="font-semibold text-white truncate text-sm">{row.label}</span>
                        </div>
                        <div className="font-mono text-emerald-400 font-bold shrink-0 text-sm">{row.share.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-3.5 flex-1 overflow-hidden flex flex-col">
                  <div className="overflow-y-auto space-y-3 pr-1 flex-1 [scrollbar-width:thin]">
                    {graphRows.length === 0 ? (
                      <div className="p-12 text-center text-slate-500 text-sm">No chart data available.</div>
                    ) : (
                      graphRows.map((row) => {
                        const pct = Math.max(6, (row.measureValue / maxGraphMeasureValue) * 100);
                        const displayVal = activeMeasure.key === "units" ? `${row.units.toLocaleString()} pcs` : activeMeasure.key === "transactions" ? `${row.count.toLocaleString()} logs` : activeMeasure.key === "aur" ? `₱${row.aur.toFixed(2)}` : `₱${row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
                        return (
                          <div key={row.label} onClick={() => toggleSelection(graphDimensionKey, row.label)} className="bg-slate-900/60 border border-slate-700/80 hover:border-emerald-500/50 p-3.5 rounded-2xl cursor-pointer transition space-y-2 group shadow-sm">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-bold text-white group-hover:text-emerald-400 transition truncate mr-2">{row.label}</span>
                              <div className="flex items-center gap-3 font-mono shrink-0">
                                <span className="text-xs text-slate-400">{row.share.toFixed(1)}%</span>
                                <span className="font-black text-emerald-400">{displayVal}</span>
                              </div>
                            </div>
                            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden">
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

          {/* RIGHT PANEL: PRODUCT CATALOG & STORE BREAKDOWN CARDS */}
          {expandedPanel !== "graph" && (
            <div className={`bg-slate-950/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[640px] ${expandedPanel === "table" ? "lg:col-span-2" : ""}`}>
              <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-3 shadow-md shrink-0">
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

              {/* FIXED RELATIVE CONTAINER WITH FLUSH STICKY HEADER */}
              <div className="relative flex-1 overflow-hidden flex flex-col">
                <div className={`overflow-x-auto overflow-y-auto flex-1 [scrollbar-width:thin] ${productViewMode === "stores_grid" ? "p-4" : ""}`}>
                  
                  {productViewMode === "consolidated" && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md">
                        <tr>
                          <th className="px-5 py-3.5 border-r border-slate-800 bg-slate-900">Style Name / Details</th>
                          <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900">Class</th>
                          <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900">Color & Size</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Price</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Units Sold</th>
                          <th className="px-5 py-3.5 text-right print:hidden bg-slate-900">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {filteredProducts.length === 0 ? (
                          <tr><td colSpan={6} className="p-12 text-center text-slate-500 text-sm">No product records in active state.</td></tr>
                        ) : (
                          filteredProducts.map((prod) => (
                            <tr key={prod.key} className="hover:bg-slate-900/60 transition-colors group">
                              <td className="px-5 py-3.5 font-mono border-r border-slate-900/50 space-y-1">
                                <span className="font-black text-emerald-400 block text-sm tracking-wide">
                                  {prod.styleName !== "-" && prod.styleName !== "Unassigned Item" ? prod.styleName : prod.styleCode}
                                </span>
                                <div className="text-[11px] text-slate-300 font-sans font-medium flex flex-wrap items-center gap-2">
                                  <span className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300 border border-slate-800">Code: {prod.styleCode}</span>
                                  {prod.sku !== "-" && <span className="text-blue-400 font-mono">SKU: {prod.sku}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-900/50">
                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                                  prod.abcClass === "A" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                                  prod.abcClass === "B" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" :
                                  "bg-slate-800 text-slate-400 border-slate-700"
                                }`}>
                                  Class {prod.abcClass}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 max-w-[180px] border-r border-slate-900/50">
                                <span className="text-white block font-semibold text-xs">{prod.color}</span>
                                <span className="text-[11px] text-slate-400">Size: <strong className="text-slate-200">{prod.size}</strong></span>
                              </td>
                              <td className="px-4 py-3.5 text-right text-slate-300 font-mono text-sm whitespace-nowrap border-r border-slate-900/50">₱{prod.price.toFixed(0)}</td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400 text-sm whitespace-nowrap border-r border-slate-900/50">{prod.units} pcs</td>
                              <td className="px-5 py-3.5 text-right whitespace-nowrap print:hidden">
                                <button onClick={() => setInspectedProduct(prod)} className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm">
                                  <Eye className="w-3.5 h-3.5" /><span>Inspect</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {productViewMode === "replenishment" && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md">
                        <tr>
                          <th className="px-5 py-3.5 border-r border-slate-800 bg-slate-900">Style Variant</th>
                          <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900">Status</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Days of Supply</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Daily Vel.</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Stock vs Safety</th>
                          <th className="px-5 py-3.5 text-right print:hidden bg-slate-900">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {filteredProducts.sort((a,b) => a.daysOfSupply - b.daysOfSupply).map((prod) => (
                          <tr key={prod.key} className="hover:bg-slate-900/60 transition-colors group">
                            <td className="px-5 py-3.5 font-mono border-r border-slate-900/50 space-y-1">
                              <span className="font-bold text-emerald-400 block text-sm tracking-wide">{prod.styleCode}</span>
                              <span className="text-[11px] text-slate-400">{prod.color} ({prod.size})</span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-900/50">
                              {prod.stockStatus === "CRITICAL" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3"/> OUT OF STOCK</span>}
                              {prod.stockStatus === "WARNING" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 w-max"><ShieldAlert className="w-3 h-3"/> LOW STOCK</span>}
                              {prod.stockStatus === "HEALTHY" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 w-max"><Check className="w-3 h-3"/> HEALTHY</span>}
                            </td>
                            <td className="px-4 py-3.5 text-right border-r border-slate-900/50">
                              <span className={`font-black text-sm ${prod.daysOfSupply < 14 ? 'text-rose-400' : prod.daysOfSupply < 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {prod.daysOfSupply > 365 ? "999+" : prod.daysOfSupply.toFixed(0)} <span className="text-[10px] font-sans text-slate-500">Days</span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right text-slate-300 font-mono text-sm whitespace-nowrap border-r border-slate-900/50">{prod.velocity.toFixed(2)}/d</td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-sm whitespace-nowrap border-r border-slate-900/50">
                              <span className={prod.currentStock <= prod.safetyStock ? "text-rose-400" : "text-emerald-400"}>{prod.currentStock}</span>
                              <span className="text-slate-500"> / {prod.safetyStock}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap print:hidden">
                              <button onClick={() => setInspectedProduct(prod)} className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm">
                                <Eye className="w-3.5 h-3.5" /><span>View</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {productViewMode === "aging_slob" && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 z-30 shadow-md">
                        <tr>
                          <th className="px-5 py-3.5 border-r border-slate-800 bg-slate-900">Style Variant</th>
                          <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900">SLOB Status</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Units Sold (Period)</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Remaining Stock</th>
                          <th className="px-4 py-3.5 text-right border-r border-slate-800 bg-slate-900">Tied Capital</th>
                          <th className="px-5 py-3.5 text-right print:hidden bg-slate-900">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {filteredProducts.sort((a,b) => b.daysOfSupply - a.daysOfSupply).map((prod) => (
                          <tr key={prod.key} className={`transition-colors group ${prod.slobStatus === 'DEAD' ? 'bg-rose-950/10 hover:bg-rose-950/20' : 'hover:bg-slate-900/60'}`}>
                            <td className="px-5 py-3.5 font-mono border-r border-slate-900/50 space-y-1">
                              <span className="font-bold text-emerald-400 block text-sm tracking-wide">{prod.styleCode}</span>
                              <span className="text-[11px] text-slate-400">{prod.color} ({prod.size})</span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-900/50">
                              {prod.slobStatus === "DEAD" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3"/> DEAD STOCK</span>}
                              {prod.slobStatus === "SLOW" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> SLOW MOVING</span>}
                              {prod.slobStatus === "ACTIVE" && <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 w-max"><Activity className="w-3 h-3"/> ACTIVE</span>}
                            </td>
                            <td className="px-4 py-3.5 text-right border-r border-slate-900/50 font-bold text-slate-300">{prod.units}</td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-sm whitespace-nowrap border-r border-slate-900/50 text-emerald-400">
                              {prod.currentStock}
                            </td>
                            <td className="px-4 py-3.5 text-right text-rose-400 font-mono font-bold text-sm whitespace-nowrap border-r border-slate-900/50">₱{prod.tiedUpCapital.toLocaleString()}</td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap print:hidden">
                              <button onClick={() => setInspectedProduct(prod)} className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm">
                                <Eye className="w-3.5 h-3.5" /><span>View</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {productViewMode === "stores_grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {storeCardsSummary.map((storeCard) => (
                        <div key={storeCard.store} onClick={() => { setSelectedBranchDetail(storeCard.store); setBranchModalSearch(""); setBranchModalTierFilter("ALL"); setIsBranchModalExpanded(false); }} className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-4 cursor-pointer transition space-y-3 group shadow-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 truncate mr-2">
                              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition shrink-0"><Building2 className="w-4 h-4" /></div>
                              <h4 className="font-bold text-white text-xs truncate">{storeCard.store}</h4>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition shrink-0" />
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
                            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                              <span className="text-[9px] text-slate-500 uppercase block font-sans">Units Sold</span>
                              <span className="text-emerald-400 font-bold text-sm">{storeCard.totalUnits.toLocaleString()} pcs</span>
                            </div>
                            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                              <span className="text-[9px] text-slate-500 uppercase block font-sans">Branch Revenue</span>
                              <span className="text-indigo-400 font-bold text-sm">₱{storeCard.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ENHANCED BRANCH DEEP-DIVE MODAL WITH EXPANDED VIEW TOGGLE */}
      {selectedBranchDetail && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className={`bg-[#0E1526] border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4 text-left transition-all duration-300 flex flex-col ${
            isBranchModalExpanded ? "w-full h-full max-w-none max-h-none m-2" : "w-full max-w-2xl max-h-[90vh]"
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Branch Inventory Breakdown</span>
                  <h2 className="text-base font-bold text-white">{selectedBranchDetail}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBranchModalExpanded(!isBranchModalExpanded)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                  title={isBranchModalExpanded ? "Minimize Modal" : "Expand Full Screen"}
                >
                  {isBranchModalExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setSelectedBranchDetail(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* SEARCH & FILTER CONTROLS INSIDE MODAL */}
            <div className="flex flex-wrap items-center gap-3 pt-1 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search style code, name, color..."
                  value={branchModalSearch}
                  onChange={(e) => setBranchModalSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs pl-9 pr-3 py-2.5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <span className="text-[10px] uppercase text-slate-500 font-bold px-2">Tier:</span>
                {(["ALL", "A", "B", "C"] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setBranchModalTierFilter(tier)}
                    className={`px-3 py-1 rounded-lg transition font-bold text-xs ${
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

            <div className={`overflow-y-auto space-y-2 pr-1 flex-1 [scrollbar-width:thin]`}>
              {selectedBranchProducts.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">No matching product records found for this branch.</div>
              ) : (
                selectedBranchProducts.map((prod) => (
                  <div key={prod.key} className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white block text-sm">{prod.styleName !== "-" ? prod.styleName : prod.styleCode}</span>
                        <span className={`text-[10px] font-black px-2 py-0.2 rounded border ${
                          prod.abcClass === "A" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          prod.abcClass === "B" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" :
                          "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          Class {prod.abcClass}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">Code: {prod.styleCode} • {prod.color} ({prod.size})</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-black text-emerald-400 text-base block">{prod.storeBreakdown[selectedBranchDetail] || 0} pcs</span>
                      <span className="text-[11px] text-slate-500">₱{prod.price.toFixed(0)} / unit</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400 shrink-0">
              <span>Showing {selectedBranchProducts.length} items</span>
              <button
                onClick={() => setSelectedBranchDetail(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Close Branch View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL */}
      {inspectedProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#0E1526] border border-slate-700/80 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  SKU Inspection & Performance Audit
                </span>
                <h2 className="text-lg font-bold text-white mt-1">{inspectedProduct.styleName}</h2>
              </div>
              <button onClick={() => setInspectedProduct(null)} className="text-slate-500 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Style Code</p>
                <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{inspectedProduct.styleCode}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Variant</p>
                <p className="text-xs font-semibold text-white mt-0.5">{inspectedProduct.color} / {inspectedProduct.size}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Pareto Tier</p>
                <p className="text-xs font-bold text-indigo-400 mt-0.5">Class {inspectedProduct.abcClass}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Multi-Branch Sales Breakdown</span>
                <span className="text-slate-500 font-mono">total scan logs</span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {Object.entries(inspectedProduct.storeBreakdown).map(([storeName, qty]) => (
                  <div key={storeName} className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <StoreIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold text-white">{storeName}</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span className="text-emerald-400 font-bold">{qty} pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectedProduct(null)}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKMARKS MANAGER MODAL */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#0E1526] border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Saved Selection Presets
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Bookmarks Manager</h2>
              </div>
              <button onClick={() => setIsBookmarkModalOpen(false)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveBookmark} className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Save Current Filter State
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Q3 Metro Gaisano Audit..."
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer">
                  Save Preset
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-2">
                Your Saved Presets ({bookmarks.length})
              </p>
              {bookmarks.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-slate-800 border-dashed rounded-xl">
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
                    className="bg-slate-950 border border-slate-800 hover:border-amber-500/60 p-3 rounded-xl flex items-center justify-between cursor-pointer transition group"
                  >
                    <div>
                      <p className="font-bold text-white text-xs group-hover:text-amber-400 transition">{bm.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {bm.startDate && bm.endDate ? `${bm.startDate} to ${bm.endDate}` : "All Time"}
                      </p>
                    </div>
                    <button onClick={(e) => deleteBookmark(bm.id, e)} className="text-slate-600 hover:text-rose-400 p-1.5 transition rounded-lg hover:bg-slate-900 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
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