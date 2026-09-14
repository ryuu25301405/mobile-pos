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

const DRILL_HIERARCHY: DimensionConfig[] = [
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
  "#10B981", // Emerald
  "#6366F1", // Indigo
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#14B8A6", // Teal
  "#F43F5E", // Rose
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
}

export default function QlikViewAnalyticsPage() {
  const [data, setData] = useState<SalesRecord[]>([]);
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

  const [tableMode, setTableMode] = useState<"cyclic" | "drilldown">("drilldown");
  const [cyclicIndex, setCyclicIndex] = useState<number>(0);
  const [drillLevel, setDrillLevel] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<"both" | "summary" | "details">("both");
  const [visualizationMode, setVisualizationMode] = useState<"chart" | "donut" | "table">("chart");
  const [graphDimensionKey, setGraphDimensionKey] = useState<DimensionKey>("store");
  const [productViewMode, setProductViewMode] = useState<"consolidated" | "store_breakdown">("consolidated");
  
  const [expandedPanel, setExpandedPanel] = useState<"none" | "graph" | "table">("none");

  const [detailSearch, setDetailSearch] = useState("");
  const [activeFilterDrawer, setActiveFilterDrawer] = useState<DimensionKey | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");

  const [inspectedProduct, setInspectedProduct] = useState<ProductSummaryItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: logs, error } = await supabase
      .from("scanned_logs")
      .select(
        "id, store, style_code, sku, style_name, description, color, size, category, department, price, quantity, scanned_at"
      )
      .order("scanned_at", { ascending: false });

    if (!error && logs) {
      const parsed: SalesRecord[] = logs.map((row: any) => {
        const qty = Number(row.quantity) || 1;
        const pr = Number(row.price) || 0;
        const dt = row.scanned_at ? new Date(row.scanned_at) : new Date();
        const dateStr = dt.toISOString().split("T")[0];

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
          scanned_date: dateStr,
        };
      });
      setData(parsed);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem("qlik_analytics_bookmarks");
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse bookmarks", e);
      }
    }
  }, [fetchData]);

  const saveBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmarkName.trim()) return;

    const newBm: BookmarkPreset = {
      id: Date.now().toString(),
      name: newBookmarkName.trim(),
      selection: activeSelection,
      startDate,
      endDate,
    };

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

  const activeSelection = isComparativeMode
    ? activeEditingState === "A"
      ? stateA
      : stateB
    : stateA;

  const setActiveSelection = (fn: (prev: StateSelection) => StateSelection) => {
    if (!isComparativeMode || activeEditingState === "A") {
      setStateA(fn);
    } else {
      setStateB(fn);
    }
  };

  const evaluateSubset = useCallback(
    (selection: StateSelection) => {
      return dateFilteredData.filter((row) => {
        const matchStore = selection.stores.length === 0 || selection.stores.includes(row.store);
        const matchDept =
          selection.departments.length === 0 || selection.departments.includes(row.department);
        const matchCat =
          selection.categories.length === 0 || selection.categories.includes(row.category);
        const matchColor = selection.colors.length === 0 || selection.colors.includes(row.color);
        const matchSize = selection.sizes.length === 0 || selection.sizes.includes(row.size);
        const matchStyle = selection.styles.length === 0 || selection.styles.includes(row.style_code);

        return matchStore && matchDept && matchCat && matchColor && matchSize && matchStyle;
      });
    },
    [dateFilteredData]
  );

  const currentSubset = useMemo(() => evaluateSubset(stateA), [evaluateSubset, stateA]);
  const subsetB = useMemo(() => evaluateSubset(stateB), [evaluateSubset, stateB]);

  const { possibleValues, fieldFrequencies } = useMemo(() => {
    const calcPossibleAndFreq = (
      targetField: "store" | "department" | "category" | "color" | "size"
    ) => {
      const subset = dateFilteredData.filter((row) => {
        const mStore =
          targetField === "store" ||
          activeSelection.stores.length === 0 ||
          activeSelection.stores.includes(row.store);
        const mDept =
          targetField === "department" ||
          activeSelection.departments.length === 0 ||
          activeSelection.departments.includes(row.department);
        const mCat =
          targetField === "category" ||
          activeSelection.categories.length === 0 ||
          activeSelection.categories.includes(row.category);
        const mColor =
          targetField === "color" ||
          activeSelection.colors.length === 0 ||
          activeSelection.colors.includes(row.color);
        const mSize =
          targetField === "size" ||
          activeSelection.sizes.length === 0 ||
          activeSelection.sizes.includes(row.size);
        const mStyle =
          activeSelection.styles.length === 0 || activeSelection.styles.includes(row.style_code);

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

  const toggleSelection = (
    field: "store" | "department" | "category" | "color" | "size" | "style_code",
    value: string
  ) => {
    setActiveSelection((prev) => {
      const fieldKeyMap: Record<string, keyof StateSelection> = {
        store: "stores",
        department: "departments",
        category: "categories",
        color: "colors",
        size: "sizes",
        style_code: "styles",
      };
      const key = fieldKeyMap[field];
      const exists = prev[key].includes(value);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((v) => v !== value) : [...prev[key], value],
      };
    });
  };

  const clearCurrentStateSelections = () => {
    setActiveSelection(() => EMPTY_SELECTIONS);
    setDrillLevel(0);
  };

  const calcMetrics = (subset: SalesRecord[]) => {
    const revenue = subset.reduce((acc, curr) => acc + curr.revenue, 0);
    const units = subset.reduce((acc, curr) => acc + curr.quantity, 0);
    const transactions = subset.length;
    const aur = units > 0 ? revenue / units : 0;
    const shareOfTotal = universe.totalRevenue > 0 ? (revenue / universe.totalRevenue) * 100 : 0;
    return { revenue, units, transactions, aur, shareOfTotal };
  };

  const metricsA = useMemo(() => calcMetrics(currentSubset), [currentSubset, universe.totalRevenue]);
  const metricsB = useMemo(() => calcMetrics(subsetB), [subsetB, universe.totalRevenue]);

  const activeMeasure = MEASURES[activeMeasureIndex];

  const cycleMeasure = () => {
    setActiveMeasureIndex((prev) => (prev + 1) % MEASURES.length);
  };

  const graphRows = useMemo(() => {
    const map: Record<
      string,
      { label: string; revenue: number; units: number; count: number; aur: number }
    > = {};

    currentSubset.forEach((item) => {
      const keyVal = item[graphDimensionKey] || "Unknown";
      if (!map[keyVal]) {
        map[keyVal] = { label: keyVal, revenue: 0, units: 0, count: 0, aur: 0 };
      }
      map[keyVal].revenue += item.revenue;
      map[keyVal].units += item.quantity;
      map[keyVal].count += 1;
    });

    Object.values(map).forEach((r) => {
      r.aur = r.units > 0 ? r.revenue / r.units : 0;
    });

    const rows = Object.values(map).sort((a, b) => {
      if (activeMeasure.key === "units") return b.units - a.units;
      if (activeMeasure.key === "transactions") return b.count - a.count;
      if (activeMeasure.key === "aur") return b.aur - a.aur;
      return b.revenue - a.revenue;
    });

    const totalVal = rows.reduce((sum, r) => {
      if (activeMeasure.key === "units") return sum + r.units;
      if (activeMeasure.key === "transactions") return sum + r.count;
      if (activeMeasure.key === "aur") return sum + r.aur;
      return sum + r.revenue;
    }, 0);

    return rows.map((r, idx) => {
      const val =
        activeMeasure.key === "units"
          ? r.units
          : activeMeasure.key === "transactions"
          ? r.count
          : activeMeasure.key === "aur"
          ? r.aur
          : r.revenue;
      return {
        ...r,
        measureValue: val,
        share: totalVal > 0 ? (val / totalVal) * 100 : 0,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      };
    });
  }, [currentSubset, graphDimensionKey, activeMeasure]);

  const maxGraphMeasureValue = useMemo(() => {
    if (graphRows.length === 0) return 1;
    return Math.max(...graphRows.map((r) => r.measureValue), 1);
  }, [graphRows]);

  const donutSlices = useMemo(() => {
    let cumulativePercent = 0;
    return graphRows.map((row) => {
      const startAngle = (cumulativePercent / 100) * 360;
      cumulativePercent += row.share;
      const endAngle = (cumulativePercent / 100) * 360;
      return {
        ...row,
        startAngle,
        endAngle,
      };
    });
  }, [graphRows]);

  const filteredProducts = useMemo(() => {
    const map: Record<string, ProductSummaryItem> = {};

    currentSubset.forEach((item) => {
      const prodKey = `${item.style_code}-${item.sku}-${item.size}-${item.color}`;
      if (!map[prodKey]) {
        map[prodKey] = {
          key: prodKey,
          styleCode: item.style_code,
          sku: item.sku,
          styleName: item.style_name,
          color: item.color,
          size: item.size,
          category: item.category,
          department: item.department,
          price: item.price,
          units: 0,
          revenue: 0,
          abcClass: "C",
          storeBreakdown: {},
        };
      }
      map[prodKey].units += item.quantity;
      map[prodKey].revenue += item.revenue;
      map[prodKey].storeBreakdown[item.store] = (map[prodKey].storeBreakdown[item.store] || 0) + item.quantity;
    });

    const list = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    const totalSubRevenue = list.reduce((sum, p) => sum + p.revenue, 0);
    let cumulativeRevenue = 0;

    const classifiedList = list.map((p) => {
      cumulativeRevenue += p.revenue;
      const cumulativePct = totalSubRevenue > 0 ? (cumulativeRevenue / totalSubRevenue) * 100 : 100;

      let abcClass: "A" | "B" | "C" = "C";
      if (cumulativePct <= 80) {
        abcClass = "A";
      } else if (cumulativePct <= 95) {
        abcClass = "B";
      } else {
        abcClass = "C";
      }

      return {
        ...p,
        abcClass,
      };
    });

    if (!detailSearch.trim()) return classifiedList;
    const q = detailSearch.toLowerCase();
    return classifiedList.filter(
      (p) =>
        p.styleCode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.styleName.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q)
    );
  }, [currentSubset, detailSearch]);

  const inspectedProductBreakdown = useMemo(() => {
    if (!inspectedProduct) return { stores: [], totalLogs: 0 };

    const matches = currentSubset.filter(
      (item) =>
        item.style_code === inspectedProduct.styleCode &&
        item.color === inspectedProduct.color &&
        item.size === inspectedProduct.size
    );

    const storeMap: Record<string, { store: string; units: number; revenue: number; logs: number }> = {};
    matches.forEach((m) => {
      if (!storeMap[m.store]) {
        storeMap[m.store] = { store: m.store, units: 0, revenue: 0, logs: 0 };
      }
      storeMap[m.store].units += m.quantity;
      storeMap[m.store].revenue += m.revenue;
      storeMap[m.store].logs += 1;
    });

    return {
      stores: Object.values(storeMap).sort((a, b) => b.revenue - a.revenue),
      totalLogs: matches.length,
    };
  }, [currentSubset, inspectedProduct]);

  const handleGraphSliceClick = (label: string) => {
    toggleSelection(graphDimensionKey, label);
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 p-4 sm:p-6 space-y-4 font-sans">
      
      {/* GLOBAL NAVIGATION BAR */}
      <nav className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
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
          <Link
            href="/analytics/qlik"
            className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold transition"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics Hub</span>
          </Link>

          <Link
            href="/inventory"
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-400" />
            <span>Store Inventory</span>
          </Link>

          <Link
            href="/scanview"
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scanner</span>
          </Link>

          <Link
            href="/reports/daily-sales"
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Daily Sales Report</span>
          </Link>
        </div>
      </nav>

      {/* EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl relative overflow-hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isComparativeMode ? "State A Revenue" : "Filtered Revenue"}
            </p>
            <h3 className="text-2xl font-black text-white mt-1">
              ₱{metricsA.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-400 font-mono mt-1">
              {metricsA.shareOfTotal.toFixed(1)}% of total universe
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl relative overflow-hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isComparativeMode ? "State B Revenue" : "Units Sold"}
            </p>
            <h3 className="text-2xl font-black text-white mt-1">
              {isComparativeMode
                ? `₱${metricsB.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                : `${metricsA.units.toLocaleString()} pcs`}
            </h3>
            <p className="text-[10px] text-indigo-400 font-mono mt-1">
              {isComparativeMode
                ? `${metricsB.shareOfTotal.toFixed(1)}% of universe`
                : `out of ${universe.totalUnits.toLocaleString()} total units`}
            </p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl relative overflow-hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isComparativeMode ? "State A Units" : "Transactions"}
            </p>
            <h3 className="text-2xl font-black text-white mt-1">
              {isComparativeMode
                ? `${metricsA.units.toLocaleString()} pcs`
                : `${metricsA.transactions.toLocaleString()} logs`}
            </h3>
            <p className="text-[10px] text-blue-400 font-mono mt-1">
              {isComparativeMode ? `State B: ${metricsB.units} pcs` : "scanned audit logs"}
            </p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0E1526]/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-xl relative overflow-hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Average Unit Retail (AUR)
            </p>
            <h3 className="text-2xl font-black text-white mt-1">
              ₱{metricsA.aur.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-purple-400 font-mono mt-1">
              {isComparativeMode ? `State B AUR: ₱${metricsB.aur.toFixed(2)}` : "per unit retail avg"}
            </p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* TOP-DOCKED FACET FILTER BAR */}
      <div className="bg-[#0E1526]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase tracking-wider text-[11px] mr-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>Associative Facets:</span>
          </div>

          {CYCLIC_DIMENSIONS.map((dim) => {
            const fieldKeyMap: Record<string, keyof StateSelection> = {
              store: "stores",
              department: "departments",
              category: "categories",
              color: "colors",
              size: "sizes",
              style_code: "styles",
            };
            const count = activeSelection[fieldKeyMap[dim.key]]?.length || 0;

            return (
              <button
                key={dim.key}
                onClick={() => setActiveFilterDrawer(activeFilterDrawer === dim.key ? null : dim.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  count > 0
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                    : activeFilterDrawer === dim.key
                    ? "bg-slate-800 text-white border-slate-700"
                    : "bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
              >
                <span>{dim.label}</span>
                {count > 0 && (
                  <span className="bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md text-[10px] font-black">
                    {count}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBookmarkModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Presets ({bookmarks.length})</span>
          </button>

          <button
            onClick={() => setIsComparativeMode(!isComparativeMode)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              isComparativeMode
                ? "bg-purple-600 text-white border-purple-500 shadow-lg"
                : "bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{isComparativeMode ? "State A/B: ON" : "State A/B"}</span>
          </button>

          {(activeSelection.stores.length > 0 ||
            activeSelection.departments.length > 0 ||
            activeSelection.categories.length > 0 ||
            activeSelection.colors.length > 0 ||
            activeSelection.sizes.length > 0 ||
            activeSelection.styles.length > 0) && (
            <button
              onClick={clearCurrentStateSelections}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER DRAWER POPUP */}
      {activeFilterDrawer && (
        <div className="bg-[#0E1526] border border-slate-700/80 rounded-2xl p-4 shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Filtering: {CYCLIC_DIMENSIONS.find((d) => d.key === activeFilterDrawer)?.label}
              </h3>
            </div>
            <button
              onClick={() => {
                setActiveFilterDrawer(null);
                setDrawerSearch("");
              }}
              className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search filter values..."
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs pl-9 pr-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
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

              if (filteredList.length === 0) {
                return <div className="col-span-full py-4 text-center text-slate-500 text-xs italic">No matching options found.</div>;
              }

              return filteredList.map((val) => {
                const isSelected = current.sel.includes(val);
                const isPossible = activeFilterDrawer === "style_code" || current.poss.has(val);
                const freq = current.freq[val] || 0;

                return (
                  <div
                    key={val}
                    onClick={() => toggleSelection(activeFilterDrawer, val)}
                    className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs border ${
                      isSelected
                        ? "bg-emerald-600 text-white font-bold border-emerald-500 shadow-md"
                        : isPossible
                        ? "bg-slate-950/80 text-slate-200 border-slate-800 hover:border-slate-700"
                        : "bg-slate-950/30 text-slate-600 border-slate-900 opacity-40"
                    }`}
                  >
                    <span className="truncate mr-1">{val}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isSelected ? "bg-emerald-700 text-white" : "bg-slate-900 text-slate-400"}`}>
                      {freq}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 4. MAIN ANALYTICS WORKSPACE - HIGHLY SEGREGATED & PROFESSIONAL HEADERS */}
      <div className="bg-[#0E1526]/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-2xl space-y-4">
        
        {/* Workspace Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={cycleMeasure}
              className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Measure: {activeMeasure.label} ⟳</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setVisualizationMode("chart")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
                  visualizationMode === "chart" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Bars</span>
              </button>
              <button
                onClick={() => setVisualizationMode("donut")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
                  visualizationMode === "donut" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Proportion Ring</span>
              </button>
            </div>
          </div>
        </div>

        {/* MAIN DISPLAY GRID WITH DISTINCTLY SEGREGATED HEADERS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* LEFT GRAPH STAGE */}
          {expandedPanel !== "table" && (
            <div className={`bg-slate-950/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[640px] ${expandedPanel === "graph" ? "lg:col-span-2" : ""}`}>
              {/* CLEARLY SEGREGATED HEADER SECTION */}
              <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-3 shadow-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-5 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm font-black text-white tracking-wide uppercase">
                    {visualizationMode === "donut" ? "Proportion Share Breakdown" : "Bar Chart Breakdown"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs shadow-inner">
                    <span className="text-slate-400 font-semibold">Analyze by:</span>
                    <select
                      value={graphDimensionKey}
                      onChange={(e) => setGraphDimensionKey(e.target.value as DimensionKey)}
                      className="bg-slate-900 text-emerald-400 font-bold focus:outline-none cursor-pointer"
                    >
                      {CYCLIC_DIMENSIONS.map((dim) => (
                        <option key={dim.key} value={dim.key}>{dim.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setExpandedPanel(expandedPanel === "graph" ? "none" : "graph")}
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl transition cursor-pointer shadow-sm"
                    title={expandedPanel === "graph" ? "Restore Split View" : "Maximize Panel"}
                  >
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
                          <circle
                            key={slice.label}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="16"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            onClick={() => toggleSelection(graphDimensionKey, slice.label)}
                            className="cursor-pointer hover:opacity-80 transition-all duration-300"
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-xs uppercase font-bold text-slate-400">Total</span>
                      <span className="text-base font-black text-white">
                        {graphRows.length} items
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto pr-2 w-full sm:w-72 max-h-[460px] [scrollbar-width:thin]">
                    {graphRows.map((row) => (
                      <div
                        key={row.label}
                        onClick={() => toggleSelection(graphDimensionKey, row.label)}
                        className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-900/60 border border-slate-700/80 hover:border-emerald-500/50 cursor-pointer transition shadow-sm"
                      >
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
                        const displayVal =
                          activeMeasure.key === "units" ? `${row.units.toLocaleString()} pcs` :
                          activeMeasure.key === "transactions" ? `${row.count.toLocaleString()} logs` :
                          activeMeasure.key === "aur" ? `₱${row.aur.toFixed(2)}` :
                          `₱${row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

                        return (
                          <div
                            key={row.label}
                            onClick={() => toggleSelection(graphDimensionKey, row.label)}
                            className="bg-slate-900/60 border border-slate-700/80 hover:border-emerald-500/50 p-3.5 rounded-2xl cursor-pointer transition space-y-2 group shadow-sm"
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-bold text-white group-hover:text-emerald-400 transition truncate mr-2">
                                {row.label}
                              </span>
                              <div className="flex items-center gap-3 font-mono shrink-0">
                                <span className="text-xs text-slate-400">{row.share.toFixed(1)}%</span>
                                <span className="font-black text-emerald-400">{displayVal}</span>
                              </div>
                            </div>
                            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${pct}%`, backgroundColor: row.color }}
                                className="h-full rounded-full transition-all duration-500"
                              />
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

          {/* RIGHT ITEMIZED PRODUCTS TABLE WITH HIGLY DISTINCT HEADERS & BORDERS */}
          {expandedPanel !== "graph" && (
            <div className={`bg-slate-950/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[640px] ${expandedPanel === "table" ? "lg:col-span-2" : ""}`}>
              {/* CLEARLY SEGREGATED HEADER SECTION */}
              <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-3 shadow-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-5 bg-emerald-500 rounded-full"></div>
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-black text-white tracking-wide uppercase">Product Catalog ({filteredProducts.length})</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-0.5 text-xs shadow-inner">
                    <button
                      onClick={() => setProductViewMode("consolidated")}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                        productViewMode === "consolidated" ? "bg-slate-800 text-emerald-400 font-bold shadow-sm" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Total Stock</span>
                    </button>
                    <button
                      onClick={() => setProductViewMode("store_breakdown")}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                        productViewMode === "store_breakdown" ? "bg-slate-800 text-emerald-400 font-bold shadow-sm" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>Store Breakdown Matrix</span>
                    </button>
                  </div>

                  <div className="relative w-44 sm:w-52">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search style..."
                      value={detailSearch}
                      onChange={(e) => setDetailSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-xs pl-9 pr-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
                    />
                  </div>

                  <button
                    onClick={() => setExpandedPanel(expandedPanel === "table" ? "none" : "table")}
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl transition cursor-pointer shadow-sm"
                    title={expandedPanel === "table" ? "Restore Split View" : "Maximize Panel"}
                  >
                    {expandedPanel === "table" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto flex-1 overflow-y-auto [scrollbar-width:thin]">
                {productViewMode === "consolidated" ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/95 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 backdrop-blur-md z-10 shadow-md">
                      <tr>
                        <th className="px-5 py-3.5 border-r border-slate-800">Style / SKU</th>
                        <th className="px-4 py-3.5 border-r border-slate-800">Class</th>
                        <th className="px-4 py-3.5 border-r border-slate-800">Color & Size</th>
                        <th className="px-4 py-3.5 text-right border-r border-slate-800">Price</th>
                        <th className="px-4 py-3.5 text-right border-r border-slate-800">Total Stock</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs">
                      {filteredProducts.length === 0 ? (
                        <tr><td colSpan={6} className="p-10 text-center text-slate-500 text-sm">No product records in active state.</td></tr>
                      ) : (
                        filteredProducts.map((prod) => (
                          <tr key={prod.key} className="hover:bg-slate-900/60 transition-colors group">
                            <td className="px-5 py-3 font-mono border-r border-slate-900/50">
                              <span className="font-bold text-emerald-400 block text-sm">{prod.styleCode}</span>
                              <span className="text-blue-400 text-xs block">{prod.sku !== "-" ? prod.sku : ""}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-900/50">
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                                prod.abcClass === "A" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                                prod.abcClass === "B" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" :
                                "bg-slate-800 text-slate-400 border-slate-700"
                              }`}>
                                Class {prod.abcClass}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[180px] border-r border-slate-900/50">
                              <span className="text-white block font-medium text-sm" title={prod.styleName}>{prod.styleName}</span>
                              <span className="text-xs text-slate-400">{prod.color} • <strong className="text-slate-200">{prod.size}</strong></span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300 font-mono text-sm whitespace-nowrap border-r border-slate-900/50">₱{prod.price.toFixed(0)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-sm whitespace-nowrap border-r border-slate-900/50">{prod.units} pcs</td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => setInspectedProduct(prod)}
                                className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/95 text-slate-300 uppercase tracking-widest text-[11px] font-extrabold border-b-2 border-slate-700 sticky top-0 backdrop-blur-md z-10 shadow-md">
                      <tr>
                        <th className="px-5 py-3.5 sticky left-0 bg-slate-900 z-20 border-r border-slate-700">Style / Variant</th>
                        {universe.stores.map((st) => (
                          <th key={st} className="px-3 py-3.5 text-right truncate max-w-[120px] border-r border-slate-800" title={st}>
                            {st}
                          </th>
                        ))}
                        <th className="px-5 py-3.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs">
                      {filteredProducts.length === 0 ? (
                        <tr><td colSpan={universe.stores.length + 2} className="p-10 text-center text-slate-500 text-sm">No product records.</td></tr>
                      ) : (
                        filteredProducts.map((prod) => (
                          <tr key={prod.key} className="hover:bg-slate-900/60 transition-colors">
                            <td className="px-5 py-3.5 font-mono sticky left-0 bg-[#0B0F19] z-10 whitespace-nowrap border-r-2 border-slate-700">
                              <span className="font-bold text-emerald-400 block text-sm">{prod.styleCode}</span>
                              <span className="text-xs text-slate-400">{prod.color} / {prod.size}</span>
                            </td>
                            {universe.stores.map((st) => {
                              const storeQty = prod.storeBreakdown[st] || 0;
                              return (
                                <td key={st} className={`px-3 py-3.5 text-right font-mono text-sm border-r border-slate-900/50 ${storeQty > 0 ? "text-white font-bold" : "text-slate-700"}`}>
                                  {storeQty > 0 ? `${storeQty}` : "-"}
                                </td>
                              );
                            })}
                            <td className="px-5 py-3.5 text-right font-mono font-black text-emerald-400 text-sm whitespace-nowrap">
                              {prod.units} pcs
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CLICK-TO-INSPECT PRODUCT MODAL DRAWER */}
      {inspectedProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
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
                <span className="text-slate-500 font-mono">{inspectedProductBreakdown.totalLogs} total scan logs</span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {inspectedProductBreakdown.stores.map((st) => (
                  <div key={st.store} className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <StoreIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold text-white">{st.store}</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span className="text-slate-400">{st.units} pcs</span>
                      <span className="font-bold text-emerald-400">₱{st.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
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