"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
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
    label: "Revenue (₱)",
    format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
  },
  {
    key: "units",
    label: "Units Sold",
    format: (v) => `${v.toLocaleString()} pcs`,
  },
  {
    key: "aur",
    label: "AUR (₱)",
    format: (v) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
  },
  {
    key: "transactions",
    label: "Transactions",
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

const EMPTY_SELECTIONS: StateSelection = {
  stores: [],
  departments: [],
  categories: [],
  colors: [],
  sizes: [],
  styles: [],
};

export default function QlikViewAnalyticsPage() {
  const [data, setData] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Alternate States Configuration
  const [isComparativeMode, setIsComparativeMode] = useState<boolean>(false);
  const [activeEditingState, setActiveEditingState] = useState<"A" | "B">("A");

  const [stateA, setStateA] = useState<StateSelection>(EMPTY_SELECTIONS);
  const [stateB, setStateB] = useState<StateSelection>(EMPTY_SELECTIONS);

  // Multi-Metric Measure Switcher
  const [activeMeasureIndex, setActiveMeasureIndex] = useState<number>(0);

  // Date Range State
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");

  // Mode: 'cyclic' or 'drilldown'
  const [tableMode, setTableMode] = useState<"cyclic" | "drilldown">("drilldown");
  const [cyclicIndex, setCyclicIndex] = useState<number>(0);
  const [drillLevel, setDrillLevel] = useState<number>(0);

  // Main analytics panel focus
  const [activeTab, setActiveTab] = useState<"both" | "summary" | "details">("both");

  // Breadcrumbs for drilldown
  const [drillBreadcrumbs, setDrillBreadcrumbs] = useState<
    { dim: DimensionConfig; value: string }[]
  >([]);

  // Search States
  const [storeSearch, setStoreSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [colorSearch, setColorSearch] = useState("");
  const [sizeSearch, setSizeSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");

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
  }, [fetchData]);

  const applyDatePreset = (preset: "today" | "yesterday" | "7days" | "30days" | "all") => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }

    if (preset === "today") {
      const s = formatDate(today);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const s = formatDate(y);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === "7days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 6);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (preset === "30days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 29);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    }
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
    setDrillBreadcrumbs([]);
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

  const currentDimension = useMemo(() => {
    return tableMode === "drilldown"
      ? DRILL_HIERARCHY[drillLevel]
      : CYCLIC_DIMENSIONS[cyclicIndex];
  }, [tableMode, drillLevel, cyclicIndex]);

  // Aggregated Rows for Drill/Cyclic
  const tableRows = useMemo(() => {
    const map: Record<
      string,
      { label: string; revenue: number; units: number; count: number; aur: number }
    > = {};

    currentSubset.forEach((item) => {
      const keyVal = item[currentDimension.key] || "Unknown";
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

    return Object.values(map).sort((a, b) => {
      if (activeMeasure.key === "units") return b.units - a.units;
      if (activeMeasure.key === "transactions") return b.count - a.count;
      if (activeMeasure.key === "aur") return b.aur - a.aur;
      return b.revenue - a.revenue;
    });
  }, [currentSubset, currentDimension, activeMeasure]);

  // Granular Product Details
  const filteredProducts = useMemo(() => {
    const map: Record<
      string,
      {
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
      }
    > = {};

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
        };
      }
      map[prodKey].units += item.quantity;
      map[prodKey].revenue += item.revenue;
    });

    const list = Object.values(map).sort((a, b) => b.revenue - a.revenue);

    if (!detailSearch.trim()) return list;
    const q = detailSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.styleCode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.styleName.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q)
    );
  }, [currentSubset, detailSearch]);

  const handleRowClick = (label: string) => {
    if (tableMode === "cyclic") {
      toggleSelection(currentDimension.key, label);
    } else {
      toggleSelection(currentDimension.key, label);
      setDrillBreadcrumbs((prev) => [...prev, { dim: currentDimension, value: label }]);
      if (drillLevel < DRILL_HIERARCHY.length - 1) {
        setDrillLevel((prev) => prev + 1);
      }
    }
  };

  const handleDrillUp = () => {
    if (drillLevel > 0) {
      const targetLevel = drillLevel - 1;
      const targetDim = DRILL_HIERARCHY[targetLevel];

      setActiveSelection((prev) => {
        const fieldKeyMap: Record<string, keyof StateSelection> = {
          store: "stores",
          department: "departments",
          category: "categories",
          color: "colors",
          size: "sizes",
          style_code: "styles",
        };
        return { ...prev, [fieldKeyMap[targetDim.key]]: [] };
      });

      setDrillBreadcrumbs((prev) => prev.slice(0, targetLevel));
      setDrillLevel(targetLevel);
    }
  };

  const handleBreadcrumbClick = (targetIndex: number) => {
    for (let i = targetIndex; i < DRILL_HIERARCHY.length; i++) {
      const dim = DRILL_HIERARCHY[i];
      setActiveSelection((prev) => {
        const fieldKeyMap: Record<string, keyof StateSelection> = {
          store: "stores",
          department: "departments",
          category: "categories",
          color: "colors",
          size: "sizes",
          style_code: "styles",
        };
        return { ...prev, [fieldKeyMap[dim.key]]: [] };
      });
    }
    setDrillBreadcrumbs((prev) => prev.slice(0, targetIndex));
    setDrillLevel(targetIndex);
  };

  const exportToSpreadsheet = (format: "xlsx" | "csv") => {
    if (filteredProducts.length === 0) {
      alert("No data available to export under active selections.");
      return;
    }

    const rows = filteredProducts.map((p) => ({
      "Style Code": p.styleCode,
      SKU: p.sku,
      "Product Name": p.styleName,
      Department: p.department,
      Category: p.category,
      Color: p.color,
      Size: p.size,
      "Unit Price": p.price,
      "Units Sold": p.units,
      "Total Revenue": p.revenue,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QlikView_Export");

    const stateTag = isComparativeMode ? `State_${activeEditingState}` : "Selection";
    const filename = `Qlik_Export_${stateTag}_${new Date().toISOString().split("T")[0]}.${format}`;

    XLSX.writeFile(workbook, filename, { bookType: format });
  };

  // Top products for compact nested mini-chart
  const topProductsForMiniChart = useMemo(() => {
    const list = filteredProducts.slice(0, 6);
    const maxRev = Math.max(...list.map((p) => p.revenue), 1);
    return { list, maxRev };
  }, [filteredProducts]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-4">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3.5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              QlikView Engine Active
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Associative Visual Analytics
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Associative Sales & Drill-Down Analyzer
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Comparative Mode Toggle */}
          <button
            onClick={() => setIsComparativeMode(!isComparativeMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
              isComparativeMode
                ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{isComparativeMode ? "Comparative: ON" : "Alternate States (A/B)"}</span>
          </button>

          {/* Export */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => exportToSpreadsheet("xlsx")}
              className="flex items-center gap-1 text-emerald-400 hover:text-white px-2.5 py-1 rounded transition font-semibold cursor-pointer"
              title="Export filtered items to Excel"
            >
              <Download className="w-3 h-3" />
              <span>Excel</span>
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => exportToSpreadsheet("csv")}
              className="text-slate-400 hover:text-white px-2 py-1 rounded transition font-semibold cursor-pointer"
              title="Export filtered items to CSV"
            >
              CSV
            </button>
          </div>

          <Link
            href="/inventory"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-400" />
            <span>Store Inventory</span>
          </Link>
          <Link
            href="/reports/daily-sales"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Daily Sales</span>
          </Link>
        </div>
      </header>

      {/* Date Range Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Date Range:</span>
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => applyDatePreset("all")}
              className={`px-2 py-1 rounded transition cursor-pointer ${
                datePreset === "all" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => applyDatePreset("today")}
              className={`px-2 py-1 rounded transition cursor-pointer ${
                datePreset === "today" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => applyDatePreset("yesterday")}
              className={`px-2 py-1 rounded transition cursor-pointer ${
                datePreset === "yesterday" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => applyDatePreset("7days")}
              className={`px-2 py-1 rounded transition cursor-pointer ${
                datePreset === "7days" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyDatePreset("30days")}
              className={`px-2 py-1 rounded transition cursor-pointer ${
                datePreset === "30days" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Custom Start & End Date Inputs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-[10px] uppercase text-slate-500 font-bold">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset("custom");
              }}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-[10px] uppercase text-slate-500 font-bold">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset("custom");
              }}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => applyDatePreset("all")}
              className="text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer"
              title="Reset date filter"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Alternate States Selector Bar */}
      {isComparativeMode && (
        <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-purple-300 flex items-center gap-1.5">
              <GitCompare className="w-4 h-4 text-purple-400" />
              Active Target State:
            </span>

            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setActiveEditingState("A")}
                className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                  activeEditingState === "A"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                State A (Baseline)
              </button>
              <button
                onClick={() => setActiveEditingState("B")}
                className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                  activeEditingState === "B"
                    ? "bg-purple-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                State B (Comparison)
              </button>
            </div>
          </div>

          {/* Variance KPIs */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Δ Revenue:</span>
              <span
                className={`font-bold flex items-center ${
                  metricsA.revenue >= metricsB.revenue ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {metricsA.revenue >= metricsB.revenue ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                ₱{Math.abs(metricsA.revenue - metricsB.revenue).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Δ Units:</span>
              <span
                className={`font-bold ${
                  metricsA.units >= metricsB.units ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {metricsA.units - metricsB.units > 0 ? "+" : ""}
                {metricsA.units - metricsB.units} pcs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Current Selections Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-emerald-400" />
            {isComparativeMode ? `State ${activeEditingState} Selections:` : "Active Selections:"}
          </span>

          {activeSelection.stores.length === 0 &&
          activeSelection.departments.length === 0 &&
          activeSelection.categories.length === 0 &&
          activeSelection.colors.length === 0 &&
          activeSelection.sizes.length === 0 &&
          activeSelection.styles.length === 0 ? (
            <span className="text-slate-500 italic text-[11px]">None (Universe State)</span>
          ) : (
            <>
              {activeSelection.stores.map((s) => (
                <span
                  key={s}
                  onClick={() => toggleSelection("store", s)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Store: {s} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {activeSelection.departments.map((d) => (
                <span
                  key={d}
                  onClick={() => toggleSelection("department", d)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Dept: {d} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {activeSelection.categories.map((c) => (
                <span
                  key={c}
                  onClick={() => toggleSelection("category", c)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Category: {c} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {activeSelection.colors.map((cl) => (
                <span
                  key={cl}
                  onClick={() => toggleSelection("color", cl)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Color: {cl} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {activeSelection.sizes.map((sz) => (
                <span
                  key={sz}
                  onClick={() => toggleSelection("size", sz)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Size: {sz} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {activeSelection.styles.map((st) => (
                <span
                  key={st}
                  onClick={() => toggleSelection("style_code", st)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Style: {st} <X className="w-2.5 h-2.5" />
                </span>
              ))}
            </>
          )}
        </div>

        {(activeSelection.stores.length > 0 ||
          activeSelection.departments.length > 0 ||
          activeSelection.categories.length > 0 ||
          activeSelection.colors.length > 0 ||
          activeSelection.sizes.length > 0 ||
          activeSelection.styles.length > 0) && (
          <button
            onClick={clearCurrentStateSelections}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md cursor-pointer text-[11px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear State</span>
          </button>
        )}
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isComparativeMode ? "State A Revenue" : "Filtered Revenue"}
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              ₱{metricsA.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-400 font-mono">
              {metricsA.shareOfTotal.toFixed(1)}% of universe
            </p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isComparativeMode ? "State B Revenue" : "Units Sold"}
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {isComparativeMode
                ? `₱${metricsB.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                : `${metricsA.units.toLocaleString()} pcs`}
            </h3>
            <p className="text-[10px] text-indigo-400 font-mono">
              {isComparativeMode
                ? `${metricsB.shareOfTotal.toFixed(1)}% of universe`
                : `out of ${universe.totalUnits.toLocaleString()} total units`}
            </p>
          </div>
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isComparativeMode ? "State A Units" : "Transactions"}
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {isComparativeMode
                ? `${metricsA.units.toLocaleString()} pcs`
                : `${metricsA.transactions.toLocaleString()} logs`}
            </h3>
            <p className="text-[10px] text-blue-400 font-mono">
              {isComparativeMode ? `State B: ${metricsB.units} pcs` : "matching state"}
            </p>
          </div>
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Average Unit Retail (AUR)
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              ₱{metricsA.aur.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-purple-400 font-mono">
              {isComparativeMode ? `State B AUR: ₱${metricsB.aur.toFixed(2)}` : "per unit retail"}
            </p>
          </div>
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-12 gap-3.5">
        {/* Left: 5 Associative List Boxes */}
        <div className="col-span-12 md:col-span-3 space-y-2.5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
            <span>List Boxes {isComparativeMode && `(${activeEditingState})`}</span>
            <div className="flex items-center gap-1 text-[9px] lowercase text-slate-400">
              <span className="w-2 h-2 rounded bg-emerald-600 inline-block"></span> sel
              <span className="w-2 h-2 rounded bg-slate-800 border border-slate-700 inline-block ml-1"></span> opt
              <span className="w-2 h-2 rounded bg-slate-950/60 opacity-40 inline-block ml-1"></span> excl
            </div>
          </div>

          {/* STORE LIST BOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
            <div className="bg-slate-950 px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200">Store</span>
              {activeSelection.stores.length > 0 && (
                <button
                  onClick={() => setActiveSelection((prev) => ({ ...prev, stores: [] }))}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter stores..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-[11px] px-2 py-0.5 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-24 overflow-y-auto divide-y divide-slate-800/40 text-[11px]">
              {universe.stores
                .filter((s) => s.toLowerCase().includes(storeSearch.toLowerCase()))
                .map((store) => {
                  const isSelected = activeSelection.stores.includes(store);
                  const isPossible = possibleValues.stores.has(store);
                  const freq = fieldFrequencies.stores[store] || 0;

                  return (
                    <div
                      key={store}
                      onClick={() => toggleSelection("store", store)}
                      className={`px-2.5 py-1 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate mr-1">{store}</span>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                        {isPossible && <span className="opacity-70">({freq})</span>}
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* DEPARTMENT LIST BOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
            <div className="bg-slate-950 px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200">Department</span>
              {activeSelection.departments.length > 0 && (
                <button
                  onClick={() => setActiveSelection((prev) => ({ ...prev, departments: [] }))}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter dept..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-[11px] px-2 py-0.5 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-24 overflow-y-auto divide-y divide-slate-800/40 text-[11px]">
              {universe.departments
                .filter((d) => d.toLowerCase().includes(deptSearch.toLowerCase()))
                .map((dept) => {
                  const isSelected = activeSelection.departments.includes(dept);
                  const isPossible = possibleValues.departments.has(dept);
                  const freq = fieldFrequencies.departments[dept] || 0;

                  return (
                    <div
                      key={dept}
                      onClick={() => toggleSelection("department", dept)}
                      className={`px-2.5 py-1 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate mr-1">{dept}</span>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                        {isPossible && <span className="opacity-70">({freq})</span>}
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* CATEGORY LIST BOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
            <div className="bg-slate-950 px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200">Category</span>
              {activeSelection.categories.length > 0 && (
                <button
                  onClick={() => setActiveSelection((prev) => ({ ...prev, categories: [] }))}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter cat..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-[11px] px-2 py-0.5 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-24 overflow-y-auto divide-y divide-slate-800/40 text-[11px]">
              {universe.categories
                .filter((c) => c.toLowerCase().includes(catSearch.toLowerCase()))
                .map((cat) => {
                  const isSelected = activeSelection.categories.includes(cat);
                  const isPossible = possibleValues.categories.has(cat);
                  const freq = fieldFrequencies.categories[cat] || 0;

                  return (
                    <div
                      key={cat}
                      onClick={() => toggleSelection("category", cat)}
                      className={`px-2.5 py-1 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate mr-1">{cat}</span>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                        {isPossible && <span className="opacity-70">({freq})</span>}
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* COLOR LIST BOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
            <div className="bg-slate-950 px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200">Color</span>
              {activeSelection.colors.length > 0 && (
                <button
                  onClick={() => setActiveSelection((prev) => ({ ...prev, colors: [] }))}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter color..."
                value={colorSearch}
                onChange={(e) => setColorSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-[11px] px-2 py-0.5 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-24 overflow-y-auto divide-y divide-slate-800/40 text-[11px]">
              {universe.colors
                .filter((c) => c.toLowerCase().includes(colorSearch.toLowerCase()))
                .map((col) => {
                  const isSelected = activeSelection.colors.includes(col);
                  const isPossible = possibleValues.colors.has(col);
                  const freq = fieldFrequencies.colors[col] || 0;

                  return (
                    <div
                      key={col}
                      onClick={() => toggleSelection("color", col)}
                      className={`px-2.5 py-1 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate mr-1">{col}</span>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                        {isPossible && <span className="opacity-70">({freq})</span>}
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* SIZE LIST BOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
            <div className="bg-slate-950 px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200">Size</span>
              {activeSelection.sizes.length > 0 && (
                <button
                  onClick={() => setActiveSelection((prev) => ({ ...prev, sizes: [] }))}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter size..."
                value={sizeSearch}
                onChange={(e) => setSizeSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-[11px] px-2 py-0.5 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-24 overflow-y-auto divide-y divide-slate-800/40 text-[11px]">
              {universe.sizes
                .filter((s) => s.toLowerCase().includes(sizeSearch.toLowerCase()))
                .map((sz) => {
                  const isSelected = activeSelection.sizes.includes(sz);
                  const isPossible = possibleValues.sizes.has(sz);
                  const freq = fieldFrequencies.sizes[sz] || 0;

                  return (
                    <div
                      key={sz}
                      onClick={() => toggleSelection("size", sz)}
                      className={`px-2.5 py-1 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate mr-1">{sz}</span>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                        {isPossible && <span className="opacity-70">({freq})</span>}
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right: Consolidated Drill-Down & Product Details */}
        <div className="col-span-12 md:col-span-9 space-y-3">
          {/* Header Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
                <button
                  onClick={() => setTableMode("drilldown")}
                  className={`px-2 py-1 rounded-md transition cursor-pointer text-[11px] ${
                    tableMode === "drilldown"
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Drill-Down
                </button>
                <button
                  onClick={() => setTableMode("cyclic")}
                  className={`px-2 py-1 rounded-md transition cursor-pointer text-[11px] ${
                    tableMode === "cyclic"
                      ? "bg-indigo-600 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Cyclic
                </button>
              </div>

              {tableMode === "cyclic" && (
                <button
                  onClick={() => setCyclicIndex((prev) => (prev + 1) % CYCLIC_DIMENSIONS.length)}
                  className="flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Cycle: {currentDimension.label}</span>
                </button>
              )}

              {/* Multi-Metric Measure Switcher */}
              <button
                onClick={cycleMeasure}
                className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer"
                title="Click to cycle active measure"
              >
                <Layers className="w-3 h-3 text-emerald-400" />
                <span>Measure: {activeMeasure.label} ⟳</span>
              </button>

              {tableMode === "drilldown" && drillLevel > 0 && (
                <button
                  onClick={handleDrillUp}
                  className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-2 py-1 rounded-md font-bold transition cursor-pointer"
                  title="Step up one level"
                >
                  <CornerLeftUp className="w-3 h-3" />
                  <span>Drill Up</span>
                </button>
              )}
            </div>

            {/* Split View / Focus Selector */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setActiveTab("both")}
                className={`px-2 py-0.5 rounded transition ${
                  activeTab === "both" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Split View
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-2 py-0.5 rounded transition ${
                  activeTab === "summary" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Dimension Table
              </button>
              <button
                onClick={() => setActiveTab("details")}
                className={`px-2 py-0.5 rounded transition ${
                  activeTab === "details" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Products ({filteredProducts.length})
              </button>
            </div>
          </div>

          {/* Drill Breadcrumbs */}
          {tableMode === "drilldown" && (
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/80 flex items-center gap-1 text-[11px]">
              <span
                onClick={() => handleBreadcrumbClick(0)}
                className={`cursor-pointer hover:underline ${
                  drillLevel === 0 ? "text-emerald-400 font-bold" : "text-slate-400"
                }`}
              >
                All Stores
              </span>

              {drillBreadcrumbs.map((bc, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span
                    onClick={() => handleBreadcrumbClick(idx + 1)}
                    className={`cursor-pointer hover:underline ${
                      idx + 1 === drillLevel ? "text-emerald-400 font-bold" : "text-slate-400"
                    }`}
                  >
                    {bc.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TABLES GRID */}
          <div className={`grid gap-3 ${activeTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
            {/* TABLE 1: SUMMARY / DRILL / CYCLIC */}
            {(activeTab === "both" || activeTab === "summary") && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow flex flex-col">
                <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {currentDimension.label}
                    {tableMode === "drilldown" && drillLevel < DRILL_HIERARCHY.length - 1 && (
                      <span className="text-[9px] lowercase bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-normal">
                        click to drill
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Sorted by {activeMeasure.label}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[460px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-3 py-2">{currentDimension.label}</th>
                        <th className="px-2 py-2 text-right">Logs</th>
                        <th className="px-2 py-2 text-right">Units</th>
                        <th className="px-3 py-2 text-right">
                          <span
                            onClick={cycleMeasure}
                            className="cursor-pointer hover:text-emerald-400 underline decoration-dotted"
                            title="Click to cycle active measure"
                          >
                            {activeMeasure.label} ⟳
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-500">
                            Loading aggregations...
                          </td>
                        </tr>
                      ) : tableRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-500">
                            No records in active state.
                          </td>
                        </tr>
                      ) : (
                        tableRows.map((row) => {
                          const displayVal =
                            activeMeasure.key === "units"
                              ? `${row.units.toLocaleString()} pcs`
                              : activeMeasure.key === "transactions"
                              ? `${row.count.toLocaleString()} logs`
                              : activeMeasure.key === "aur"
                              ? `₱${row.aur.toFixed(2)}`
                              : `₱${row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

                          return (
                            <tr
                              key={row.label}
                              className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                              onClick={() => handleRowClick(row.label)}
                              title={`Filter / Drill into ${row.label}`}
                            >
                              <td className="px-3 py-2 font-semibold text-white group-hover:text-emerald-400 truncate max-w-[160px]">
                                {row.label}
                              </td>
                              <td className="px-2 py-2 text-right text-slate-400 font-mono">
                                {row.count}
                              </td>
                              <td className="px-2 py-2 text-right text-slate-300 font-mono">
                                {row.units}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-400 font-mono whitespace-nowrap">
                                {displayVal}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABLE 2: ITEMIZED PRODUCT DETAILS WITH EMBEDDED NESTED MINI-CHART */}
            {(activeTab === "both" || activeTab === "details") && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow flex flex-col">
                <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Itemized Products</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                      {filteredProducts.length}
                    </span>
                  </div>

                  <div className="relative w-32 sm:w-40">
                    <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search style/sku..."
                      value={detailSearch}
                      onChange={(e) => setDetailSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[10px] pl-6 pr-2 py-0.5 rounded text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Main Table */}
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-3 py-2">Style / SKU</th>
                        <th className="px-2 py-2">Color / Size</th>
                        <th className="px-2 py-2 text-right">Price</th>
                        <th className="px-2 py-2 text-right">Sold</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500">
                            No product records in selection.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((prod) => (
                          <tr key={prod.key} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2 font-mono whitespace-nowrap">
                              <span className="font-bold text-emerald-400 block text-[11px]">
                                {prod.styleCode}
                              </span>
                              <span className="text-blue-400 text-[10px] block">
                                {prod.sku !== "-" ? prod.sku : ""}
                              </span>
                            </td>
                            <td className="px-2 py-2 max-w-[130px] truncate">
                              <span className="text-white block truncate text-[11px]" title={prod.styleName}>
                                {prod.styleName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {prod.color} • <strong className="text-slate-200">{prod.size}</strong>
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right text-slate-300 font-mono whitespace-nowrap">
                              ₱{prod.price.toFixed(0)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono font-bold text-white whitespace-nowrap">
                              {prod.units}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                              ₱{prod.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredProducts.length > 0 && (
                      <tfoot className="bg-slate-950 text-slate-300 font-bold border-t border-slate-800 text-[11px]">
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-right uppercase text-[10px] text-slate-500">
                            Total:
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-white">
                            {metricsA.units}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-400">
                            ₱{metricsA.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* NESTED VISUAL MINI-CHART: Directly underneath the product table */}
                {topProductsForMiniChart.list.length > 0 && (
                  <div className="p-3 bg-slate-950/70 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Top Product Revenue Distribution</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {topProductsForMiniChart.list.length} variants
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {topProductsForMiniChart.list.map((item, idx) => {
                        const pct = Math.min(
                          100,
                          Math.max(8, (item.revenue / topProductsForMiniChart.maxRev) * 100)
                        );
                        return (
                          <div
                            key={item.key}
                            onClick={() => toggleSelection("style_code", item.styleCode)}
                            className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 p-2 rounded-lg cursor-pointer transition flex flex-col justify-between space-y-1.5"
                            title={`Click to filter by ${item.styleCode}`}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-mono font-bold text-slate-200 truncate mr-1">
                                {item.styleCode}
                              </span>
                              <span className="font-mono text-emerald-400 font-semibold shrink-0">
                                ₱{item.revenue.toLocaleString()}
                              </span>
                            </div>

                            {/* Mini bar graph */}
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                              />
                            </div>

                            <span className="text-[9px] text-slate-500 truncate block">
                              {item.color} • {item.size} ({item.units} pcs)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}