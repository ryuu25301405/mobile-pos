"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
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
  scanned_date: string; // YYYY-MM-DD
}

type DimensionKey = "store" | "department" | "category" | "color" | "size" | "style_code";

interface DimensionConfig {
  key: DimensionKey;
  label: string;
}

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

export default function QlikViewAnalyticsPage() {
  const [data, setData] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Range State
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");

  // Active Field Selections (Green values)
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // View state
  const [activeTab, setActiveTab] = useState<"both" | "summary" | "details">("both");

  // Mode: 'cyclic' or 'drilldown'
  const [tableMode, setTableMode] = useState<"cyclic" | "drilldown">("drilldown");
  const [cyclicIndex, setCyclicIndex] = useState<number>(0);
  const [drillLevel, setDrillLevel] = useState<number>(0);

  // Breadcrumbs for drilldown
  const [drillBreadcrumbs, setDrillBreadcrumbs] = useState<
    { dim: DimensionConfig; value: string }[]
  >([]);

  // Search States for list boxes
  const [storeSearch, setStoreSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [colorSearch, setColorSearch] = useState("");
  const [sizeSearch, setSizeSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");

  // 1. Fetch raw transaction data
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

  // Date Preset Handler
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

  // 2. Base Date Filter
  const dateFilteredData = useMemo(() => {
    if (!startDate && !endDate) return data;
    return data.filter((row) => {
      if (startDate && row.scanned_date < startDate) return false;
      if (endDate && row.scanned_date > endDate) return false;
      return true;
    });
  }, [data, startDate, endDate]);

  // 3. Universe Sets for current timeframe
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

  // 4. Current Selection Subset ($ State)
  const currentSubset = useMemo(() => {
    return dateFilteredData.filter((row) => {
      const matchStore = selectedStores.length === 0 || selectedStores.includes(row.store);
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(row.department);
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      const matchColor = selectedColors.length === 0 || selectedColors.includes(row.color);
      const matchSize = selectedSizes.length === 0 || selectedSizes.includes(row.size);
      const matchStyle = selectedStyles.length === 0 || selectedStyles.includes(row.style_code);

      return matchStore && matchDept && matchCat && matchColor && matchSize && matchStyle;
    });
  }, [
    dateFilteredData,
    selectedStores,
    selectedDepartments,
    selectedCategories,
    selectedColors,
    selectedSizes,
    selectedStyles,
  ]);

  // 5. Associative Possible / Excluded Sets and Dynamic Frequencies
  const { possibleValues, fieldFrequencies } = useMemo(() => {
    const calcPossibleAndFreq = (
      targetField: "store" | "department" | "category" | "color" | "size"
    ) => {
      const subset = dateFilteredData.filter((row) => {
        const mStore =
          targetField === "store" || selectedStores.length === 0 || selectedStores.includes(row.store);
        const mDept =
          targetField === "department" ||
          selectedDepartments.length === 0 ||
          selectedDepartments.includes(row.department);
        const mCat =
          targetField === "category" ||
          selectedCategories.length === 0 ||
          selectedCategories.includes(row.category);
        const mColor =
          targetField === "color" || selectedColors.length === 0 || selectedColors.includes(row.color);
        const mSize =
          targetField === "size" || selectedSizes.length === 0 || selectedSizes.includes(row.size);
        const mStyle = selectedStyles.length === 0 || selectedStyles.includes(row.style_code);

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

    const storesData = calcPossibleAndFreq("store");
    const deptsData = calcPossibleAndFreq("department");
    const catsData = calcPossibleAndFreq("category");
    const colorsData = calcPossibleAndFreq("color");
    const sizesData = calcPossibleAndFreq("size");

    return {
      possibleValues: {
        stores: storesData.possibleSet,
        departments: deptsData.possibleSet,
        categories: catsData.possibleSet,
        colors: colorsData.possibleSet,
        sizes: sizesData.possibleSet,
      },
      fieldFrequencies: {
        stores: storesData.freqMap,
        departments: deptsData.freqMap,
        categories: catsData.freqMap,
        colors: colorsData.freqMap,
        sizes: sizesData.freqMap,
      },
    };
  }, [
    dateFilteredData,
    selectedStores,
    selectedDepartments,
    selectedCategories,
    selectedColors,
    selectedSizes,
    selectedStyles,
  ]);

  const toggleSelection = (
    field: "store" | "department" | "category" | "color" | "size" | "style_code",
    value: string
  ) => {
    if (field === "store") {
      setSelectedStores((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else if (field === "department") {
      setSelectedDepartments((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else if (field === "category") {
      setSelectedCategories((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else if (field === "color") {
      setSelectedColors((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else if (field === "size") {
      setSelectedSizes((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else if (field === "style_code") {
      setSelectedStyles((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    }
  };

  const clearAllSelections = () => {
    setSelectedStores([]);
    setSelectedDepartments([]);
    setSelectedCategories([]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedStyles([]);
    setDrillLevel(0);
    setDrillBreadcrumbs([]);
  };

  const metrics = useMemo(() => {
    const revenue = currentSubset.reduce((acc, curr) => acc + curr.revenue, 0);
    const units = currentSubset.reduce((acc, curr) => acc + curr.quantity, 0);
    const transactions = currentSubset.length;
    const shareOfTotal = universe.totalRevenue > 0 ? (revenue / universe.totalRevenue) * 100 : 0;
    return { revenue, units, transactions, shareOfTotal };
  }, [currentSubset, universe.totalRevenue]);

  const currentDimension = useMemo(() => {
    return tableMode === "drilldown"
      ? DRILL_HIERARCHY[drillLevel]
      : CYCLIC_DIMENSIONS[cyclicIndex];
  }, [tableMode, drillLevel, cyclicIndex]);

  // Aggregated Rows for Drill/Cyclic
  const tableRows = useMemo(() => {
    const map: Record<string, { label: string; revenue: number; units: number; count: number }> = {};

    currentSubset.forEach((item) => {
      const keyVal = item[currentDimension.key] || "Unknown";
      if (!map[keyVal]) {
        map[keyVal] = { label: keyVal, revenue: 0, units: 0, count: 0 };
      }
      map[keyVal].revenue += item.revenue;
      map[keyVal].units += item.quantity;
      map[keyVal].count += 1;
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [currentSubset, currentDimension]);

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
      if (currentDimension.key === "store") setSelectedStores([label]);
      if (currentDimension.key === "department") setSelectedDepartments([label]);
      if (currentDimension.key === "category") setSelectedCategories([label]);
      if (currentDimension.key === "color") setSelectedColors([label]);
      if (currentDimension.key === "size") setSelectedSizes([label]);
      if (currentDimension.key === "style_code") setSelectedStyles([label]);

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

      if (targetDim.key === "store") setSelectedStores([]);
      if (targetDim.key === "department") setSelectedDepartments([]);
      if (targetDim.key === "category") setSelectedCategories([]);
      if (targetDim.key === "color") setSelectedColors([]);
      if (targetDim.key === "size") setSelectedSizes([]);
      if (targetDim.key === "style_code") setSelectedStyles([]);

      setDrillBreadcrumbs((prev) => prev.slice(0, targetLevel));
      setDrillLevel(targetLevel);
    }
  };

  const handleBreadcrumbClick = (targetIndex: number) => {
    for (let i = targetIndex; i < DRILL_HIERARCHY.length; i++) {
      const dim = DRILL_HIERARCHY[i];
      if (dim.key === "store") setSelectedStores([]);
      if (dim.key === "department") setSelectedDepartments([]);
      if (dim.key === "category") setSelectedCategories([]);
      if (dim.key === "color") setSelectedColors([]);
      if (dim.key === "size") setSelectedSizes([]);
      if (dim.key === "style_code") setSelectedStyles([]);
    }
    setDrillBreadcrumbs((prev) => prev.slice(0, targetIndex));
    setDrillLevel(targetIndex);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3.5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              QlikView Engine Active
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Associative In-Memory Client
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Associative Sales & Drill-Down Analyzer
          </h1>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Current Selections Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-emerald-400" />
            Active Selections:
          </span>

          {selectedStores.length === 0 &&
          selectedDepartments.length === 0 &&
          selectedCategories.length === 0 &&
          selectedColors.length === 0 &&
          selectedSizes.length === 0 &&
          selectedStyles.length === 0 ? (
            <span className="text-slate-500 italic text-[11px]">None (Universe State)</span>
          ) : (
            <>
              {selectedStores.map((s) => (
                <span
                  key={s}
                  onClick={() => toggleSelection("store", s)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Store: {s} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {selectedDepartments.map((d) => (
                <span
                  key={d}
                  onClick={() => toggleSelection("department", d)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Dept: {d} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {selectedCategories.map((c) => (
                <span
                  key={c}
                  onClick={() => toggleSelection("category", c)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Category: {c} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {selectedColors.map((cl) => (
                <span
                  key={cl}
                  onClick={() => toggleSelection("color", cl)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Color: {cl} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {selectedSizes.map((sz) => (
                <span
                  key={sz}
                  onClick={() => toggleSelection("size", sz)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Remove filter"
                >
                  Size: {sz} <X className="w-2.5 h-2.5" />
                </span>
              ))}

              {selectedStyles.map((st) => (
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

        {(selectedStores.length > 0 ||
          selectedDepartments.length > 0 ||
          selectedCategories.length > 0 ||
          selectedColors.length > 0 ||
          selectedSizes.length > 0 ||
          selectedStyles.length > 0) && (
          <button
            onClick={clearAllSelections}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md cursor-pointer text-[11px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtered Revenue</p>
            <h3 className="text-xl font-black text-white mt-0.5">
              ₱{metrics.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-400 font-mono">
              {metrics.shareOfTotal.toFixed(1)}% of total (₱{universe.totalRevenue.toLocaleString()})
            </p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Units in Selection</p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {metrics.units.toLocaleString()} <span className="text-xs text-slate-400 font-normal">pcs</span>
            </h3>
            <p className="text-[10px] text-indigo-400 font-mono">
              out of {universe.totalUnits.toLocaleString()} total units
            </p>
          </div>
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Transactions</p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {metrics.transactions.toLocaleString()} <span className="text-xs text-slate-400 font-normal">logs</span>
            </h3>
            <p className="text-[10px] text-blue-400 font-mono">matching state</p>
          </div>
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Ticket</p>
            <h3 className="text-xl font-black text-white mt-0.5">
              ₱
              {metrics.transactions > 0
                ? (metrics.revenue / metrics.transactions).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })
                : "0.00"}
            </h3>
            <p className="text-[10px] text-purple-400 font-mono">per transaction</p>
          </div>
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-12 gap-3.5">
        {/* Left: 5 Associative List Boxes (Store, Dept, Category, Color, Size) */}
        <div className="col-span-12 md:col-span-3 space-y-2.5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
            <span>List Boxes</span>
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
              {selectedStores.length > 0 && (
                <button
                  onClick={() => setSelectedStores([])}
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
                  const isSelected = selectedStores.includes(store);
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
              {selectedDepartments.length > 0 && (
                <button
                  onClick={() => setSelectedDepartments([])}
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
                  const isSelected = selectedDepartments.includes(dept);
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
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
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
                  const isSelected = selectedCategories.includes(cat);
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
              {selectedColors.length > 0 && (
                <button
                  onClick={() => setSelectedColors([])}
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
                  const isSelected = selectedColors.includes(col);
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
              {selectedSizes.length > 0 && (
                <button
                  onClick={() => setSelectedSizes([])}
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
                  const isSelected = selectedSizes.includes(sz);
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
            <div className="flex items-center gap-2">
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
                  <span className="text-[10px] text-slate-500 font-mono">
                    {tableRows.length} items
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[460px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-3 py-2">{currentDimension.label}</th>
                        <th className="px-2 py-2 text-right">Logs</th>
                        <th className="px-2 py-2 text-right">Units</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
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
                        tableRows.map((row) => (
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
                              ₱{row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABLE 2: ITEMIZED PRODUCT DETAILS */}
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

                  <div className="relative w-36 sm:w-44">
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

                <div className="overflow-x-auto max-h-[460px]">
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
                            {metrics.units}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-400">
                            ₱{metrics.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}