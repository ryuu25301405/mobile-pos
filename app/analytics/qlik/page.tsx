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
  Table,
  ChevronDown,
  ChevronUp,
  Bookmark,
  BookmarkPlus,
  Trash2,
  ScanBarcode,
  Store,
  LayoutDashboard,
  PlusCircle,
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

// --- QLIK LIST BOX COMPONENT ---
interface ListBoxProps {
  title: string;
  items: string[];
  selectedItems: string[];
  possibleValues: Set<string>;
  frequencies: Record<string, number>;
  onToggle: (val: string) => void;
  onClear: () => void;
  maxHeight?: string;
}

function QlikListBox({
  title,
  items,
  selectedItems,
  possibleValues,
  frequencies,
  onToggle,
  onClear,
  maxHeight = "max-h-32",
}: ListBoxProps) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const normalizedItems = useMemo(() => {
    const map = new Map<string, { display: string; originals: string[]; totalFreq: number }>();

    items.forEach((item) => {
      const key = item.trim().toUpperCase();
      const existing = map.get(key);
      const freq = frequencies[item] || 0;

      if (!existing) {
        map.set(key, {
          display: item.trim(),
          originals: [item],
          totalFreq: freq,
        });
      } else {
        existing.originals.push(item);
        existing.totalFreq += freq;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const aSel = a.originals.some((o) => selectedItems.includes(o));
      const bSel = b.originals.some((o) => selectedItems.includes(o));
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.display.localeCompare(b.display);
    });
  }, [items, selectedItems, frequencies]);

  const filtered = normalizedItems.filter((item) =>
    item.display.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = selectedItems.length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all duration-200 hover:border-slate-700">
      <div className="bg-slate-950 px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <span className="text-[11px] font-bold text-slate-200 tracking-wide truncate">
            {title}
          </span>
          {selectedCount > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
              {selectedCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              showSearch || search ? "text-emerald-400 bg-slate-800" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Search list"
          >
            <Search className="w-3 h-3" />
          </button>

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors font-medium px-1 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!collapsed && showSearch && (
        <div className="p-1.5 bg-slate-950/40 border-b border-slate-800/70 relative">
          <input
            type="text"
            placeholder={`Filter ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 text-[11px] pl-2 pr-6 py-1 rounded-md text-white placeholder-slate-500 focus:outline-none transition-colors"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {!collapsed && (
        <div
          className={`${maxHeight} overflow-y-auto divide-y divide-slate-800/30 text-[11px] select-none [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/60`}
        >
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-[10px] italic">
              No matching items
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = item.originals.some((o) => selectedItems.includes(o));
              const isPossible = item.originals.some((o) => possibleValues.has(o));
              const primaryOriginal = item.originals[0];

              return (
                <div
                  key={item.display}
                  onClick={() => onToggle(primaryOriginal)}
                  className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-600 text-white font-semibold shadow-xs"
                      : isPossible
                      ? "bg-slate-900/60 text-slate-200 hover:bg-slate-800/90 hover:text-white"
                      : "bg-slate-950/70 text-slate-600 opacity-40 hover:opacity-60"
                  }`}
                >
                  <span className="truncate pr-2">{item.display}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-emerald-700/60 text-emerald-100 font-bold"
                          : isPossible
                          ? "bg-slate-800/80 text-slate-400 font-medium"
                          : "text-slate-600"
                      }`}
                    >
                      {item.totalFreq}
                    </span>
                    {isSelected && <Check className="w-3 h-3 text-white stroke-[2.5]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// --- MAIN PAGE ---
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
  const [visualizationMode, setVisualizationMode] = useState<"table" | "chart">("table");
  const [chartDimensionIndex, setChartDimensionIndex] = useState<number>(0);
  const [drillBreadcrumbs, setDrillBreadcrumbs] = useState<
    { dim: DimensionConfig; value: string }[]
  >([]);

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

  const chartDimension = CYCLIC_DIMENSIONS[chartDimensionIndex];

  const chartRows = useMemo(() => {
    const map: Record<
      string,
      { label: string; revenue: number; units: number; count: number; aur: number }
    > = {};

    currentSubset.forEach((item) => {
      const keyVal = item[chartDimension.key] || "Unknown";
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

    return rows.map((r) => {
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
      };
    });
  }, [currentSubset, chartDimension, activeMeasure]);

  const maxChartMeasureValue = useMemo(() => {
    if (chartRows.length === 0) return 1;
    return Math.max(...chartRows.map((r) => r.measureValue), 1);
  }, [chartRows]);

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

  const topProductsForMiniChart = useMemo(() => {
    const list = filteredProducts.slice(0, 6);
    const maxRev = Math.max(...list.map((p) => p.revenue), 1);
    return { list, maxRev };
  }, [filteredProducts]);

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
      "SKU": p.sku !== "-" ? p.sku : "",
      "Product Name": p.styleName,
      "Department": p.department,
      "Category": p.category,
      "Color": p.color,
      "Size": p.size,
      "ABC Class": `Class ${p.abcClass}`,
      "Unit Price (₱)": p.price,
      "Units Sold": p.units,
      "Total Revenue (₱)": p.revenue,
    }));

    const totalUnits = filteredProducts.reduce((sum, p) => sum + p.units, 0);
    const totalRev = filteredProducts.reduce((sum, p) => sum + p.revenue, 0);

    rows.push({
      "Style Code": "TOTAL",
      "SKU": "",
      "Product Name": `Filtered Items Count: ${filteredProducts.length}`,
      "Department": "",
      "Category": "",
      "Color": "",
      "Size": "",
      "ABC Class": "",
      "Unit Price (₱)": 0,
      "Units Sold": totalUnits,
      "Total Revenue (₱)": totalRev,
    });

    if (format === "csv") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "QlikView_Export");
      const stateTag = isComparativeMode ? `State_${activeEditingState}` : "Selection";
      XLSX.writeFile(workbook, `Qlik_Export_${stateTag}_${new Date().toISOString().split("T")[0]}.csv`, { bookType: "csv" });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);

    const headerStyle = {
      font: { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "064E3B" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "022C22" } },
        bottom: { style: "thin", color: { rgb: "022C22" } },
        left: { style: "thin", color: { rgb: "022C22" } },
        right: { style: "thin", color: { rgb: "022C22" } },
      },
    };

    const cellStyle = {
      font: { name: "Arial", sz: 10, color: { rgb: "334155" } },
      alignment: { vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } },
      },
    };

    const totalRowStyle = {
      font: { name: "Arial", sz: 11, bold: true, color: { rgb: "0F172A" } },
      fill: { fgColor: { rgb: "F1F5F9" } },
      border: {
        top: { style: "medium", color: { rgb: "022C22" } },
        bottom: { style: "medium", color: { rgb: "022C22" } },
      },
    };

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;

        if (R === 0) {
          worksheet[cellAddress].s = headerStyle;
        } else if (R === range.e.r) {
          worksheet[cellAddress].s = totalRowStyle;
        } else {
          worksheet[cellAddress].s = cellStyle;
        }
      }
    }

    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Executive_Sales_Report");

    const stateTag = isComparativeMode ? `State_${activeEditingState}` : "Selection";
    const filename = `Executive_Sales_Report_${stateTag}_${new Date().toISOString().split("T")[0]}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-4">
      
      {/* GLOBAL MASTER NAVIGATION BAR */}
      <nav className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Retail Control Center</h2>
            <p className="text-[10px] text-slate-400 font-mono">Multi-Branch Analytics & Operations</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/analytics/qlik"
            className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics Hub</span>
          </Link>

          <Link
            href="/inventory"
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-400" />
            <span>Store Inventory</span>
          </Link>

          <Link
            href="/scanview"
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scanner</span>
          </Link>

          <Link
            href="/reports/daily-sales"
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Daily Sales Report</span>
          </Link>
        </div>
      </nav>

      {/* 1. COMMAND HUB HEADER */}
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
          <button
            onClick={() => setIsBookmarkModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Saved Selection Presets"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Presets ({bookmarks.length})</span>
          </button>

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

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => exportToSpreadsheet("xlsx")}
              className="flex items-center gap-1 text-emerald-400 hover:text-white px-2.5 py-1 rounded transition font-semibold cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Excel</span>
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => exportToSpreadsheet("csv")}
              className="text-slate-400 hover:text-white px-2 py-1 rounded transition font-semibold cursor-pointer"
            >
              CSV
            </button>
          </div>
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
                  activeEditingState === "A" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                State A (Baseline)
              </button>
              <button
                onClick={() => setActiveEditingState("B")}
                className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                  activeEditingState === "B" ? "bg-purple-500 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                State B (Comparison)
              </button>
            </div>
          </div>

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
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 transition"
                >
                  Store: {s} <X className="w-2.5 h-2.5" />
                </span>
              ))}
              {activeSelection.departments.map((d) => (
                <span
                  key={d}
                  onClick={() => toggleSelection("department", d)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 transition"
                >
                  Dept: {d} <X className="w-2.5 h-2.5" />
                </span>
              ))}
              {activeSelection.categories.map((c) => (
                <span
                  key={c}
                  onClick={() => toggleSelection("category", c)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 transition"
                >
                  Category: {c} <X className="w-2.5 h-2.5" />
                </span>
              ))}
              {activeSelection.colors.map((cl) => (
                <span
                  key={cl}
                  onClick={() => toggleSelection("color", cl)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 transition"
                >
                  Color: {cl} <X className="w-2.5 h-2.5" />
                </span>
              ))}
              {activeSelection.sizes.map((sz) => (
                <span
                  key={sz}
                  onClick={() => toggleSelection("size", sz)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 transition"
                >
                  Size: {sz} <X className="w-2.5 h-2.5" />
                </span>
              ))}
              {activeSelection.styles.map((st) => (
                <span
                  key={st}
                  onClick={() => toggleSelection("style_code", st)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 transition"
                >
                  Style: {st} <X className="w-2.5 h-2.5" />
                </span>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBookmarkModalOpen(true)}
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold transition px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md cursor-pointer text-[11px]"
          >
            <BookmarkPlus className="w-3 h-3" />
            <span>Save Preset</span>
          </button>

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
      </div>

      {/* 2. KPI EXECUTIVE STRIP */}
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

      {/* 3. ASSOCIATIVE WORKSPACE (Split-Pane Grid) */}
      <div className="grid grid-cols-12 gap-4 items-start pt-1">
        
        {/* Left Pane: Sticky Filter Hub */}
        <div className="col-span-12 md:col-span-3 space-y-2.5 sticky top-4 z-20">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
            <span>Filter Dimensions {isComparativeMode && `(${activeEditingState})`}</span>
            <div className="flex items-center gap-1 text-[9px] lowercase text-slate-400">
              <span className="w-2 h-2 rounded bg-emerald-600 inline-block"></span> sel
              <span className="w-2 h-2 rounded bg-slate-800 border border-slate-700 inline-block ml-1"></span> opt
              <span className="w-2 h-2 rounded bg-slate-950/60 opacity-40 inline-block ml-1"></span> excl
            </div>
          </div>

          <QlikListBox
            title="Store Location"
            items={universe.stores}
            selectedItems={activeSelection.stores}
            possibleValues={possibleValues.stores}
            frequencies={fieldFrequencies.stores}
            onToggle={(val) => toggleSelection("store", val)}
            onClear={() => setActiveSelection((prev) => ({ ...prev, stores: [] }))}
            maxHeight="max-h-32"
          />

          <QlikListBox
            title="Department"
            items={universe.departments}
            selectedItems={activeSelection.departments}
            possibleValues={possibleValues.departments}
            frequencies={fieldFrequencies.departments}
            onToggle={(val) => toggleSelection("department", val)}
            onClear={() => setActiveSelection((prev) => ({ ...prev, departments: [] }))}
            maxHeight="max-h-24"
          />

          <QlikListBox
            title="Category"
            items={universe.categories}
            selectedItems={activeSelection.categories}
            possibleValues={possibleValues.categories}
            frequencies={fieldFrequencies.categories}
            onToggle={(val) => toggleSelection("category", val)}
            onClear={() => setActiveSelection((prev) => ({ ...prev, categories: [] }))}
            maxHeight="max-h-24"
          />

          <QlikListBox
            title="Color"
            items={universe.colors}
            selectedItems={activeSelection.colors}
            possibleValues={possibleValues.colors}
            frequencies={fieldFrequencies.colors}
            onToggle={(val) => toggleSelection("color", val)}
            onClear={() => setActiveSelection((prev) => ({ ...prev, colors: [] }))}
            maxHeight="max-h-28"
          />

          <QlikListBox
            title="Size"
            items={universe.sizes}
            selectedItems={activeSelection.sizes}
            possibleValues={possibleValues.sizes}
            frequencies={fieldFrequencies.sizes}
            onToggle={(val) => toggleSelection("size", val)}
            onClear={() => setActiveSelection((prev) => ({ ...prev, sizes: [] }))}
            maxHeight="max-h-28"
          />
        </div>

        {/* Right Pane: Dynamic Analytics Stage */}
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
                >
                  <CornerLeftUp className="w-3 h-3" />
                  <span>Drill Up</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Table vs Chart Switcher */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
                <button
                  onClick={() => setVisualizationMode("table")}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded transition ${
                    visualizationMode === "table" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Table className="w-3 h-3" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setVisualizationMode("chart")}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded transition ${
                    visualizationMode === "chart" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <BarChart2 className="w-3 h-3" />
                  <span>Chart</span>
                </button>
              </div>

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
                  Summary
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

          {/* TABLES / CHARTS GRID */}
          <div className={`grid gap-3 ${activeTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
            
            {/* TABLE 1 OR INDEPENDENT CHART VIEW */}
            {(activeTab === "both" || activeTab === "summary") && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow flex flex-col">
                <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {visualizationMode === "chart" ? `Chart: ${chartDimension.label}` : currentDimension.label}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Sorted by {activeMeasure.label}
                  </span>
                </div>

                {visualizationMode === "table" ? (
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
                ) : (
                  /* INTERACTIVE BAR CHART VIEW */
                  <div className="p-3 space-y-3">
                    <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
                      <span className="text-slate-400 font-semibold">Viewing Dimension:</span>
                      <select
                        value={chartDimensionIndex}
                        onChange={(e) => setChartDimensionIndex(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-800 text-emerald-400 font-bold px-2 py-1 rounded-md focus:outline-none cursor-pointer"
                      >
                        {CYCLIC_DIMENSIONS.map((dim, idx) => (
                          <option key={dim.key} value={idx}>
                            {dim.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="max-h-[390px] overflow-y-auto space-y-2.5 pr-1">
                      {chartRows.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs">No chart data available.</div>
                      ) : (
                        chartRows.map((row) => {
                          const pct = Math.max(6, (row.measureValue / maxChartMeasureValue) * 100);
                          const displayVal =
                            activeMeasure.key === "units"
                              ? `${row.units.toLocaleString()} pcs`
                              : activeMeasure.key === "transactions"
                              ? `${row.count.toLocaleString()} logs`
                              : activeMeasure.key === "aur"
                              ? `₱${row.aur.toFixed(2)}`
                              : `₱${row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

                          return (
                            <div
                              key={row.label}
                              onClick={() => handleRowClick(row.label)}
                              className="bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/50 p-2.5 rounded-xl cursor-pointer transition space-y-1.5 group"
                              title={`Drill / Filter by ${row.label}`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-white group-hover:text-emerald-400 transition truncate mr-2">
                                  {row.label}
                                </span>
                                <div className="flex items-center gap-2 font-mono shrink-0">
                                  <span className="text-[10px] text-slate-400">{row.share.toFixed(1)}%</span>
                                  <span className="font-bold text-emerald-400">{displayVal}</span>
                                </div>
                              </div>

                              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
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

            {/* TABLE 2: ITEMIZED PRODUCTS WITH ABC MERCHANDISING TAGS */}
            {(activeTab === "both" || activeTab === "details") && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow flex flex-col">
                <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Itemized Products (ABC Classified)</span>
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

                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-3 py-2">Style / SKU</th>
                        <th className="px-2 py-2">Class</th>
                        <th className="px-2 py-2">Color / Size</th>
                        <th className="px-2 py-2 text-right">Price</th>
                        <th className="px-2 py-2 text-right">Sold</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-500">
                            No product records in selection.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((prod: any) => (
                          <tr key={prod.key} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2 font-mono whitespace-nowrap">
                              <span className="font-bold text-emerald-400 block text-[11px]">
                                {prod.styleCode}
                              </span>
                              <span className="text-blue-400 text-[10px] block">
                                {prod.sku !== "-" ? prod.sku : ""}
                              </span>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  prod.abcClass === "A"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : prod.abcClass === "B"
                                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}
                                title={`Class ${prod.abcClass}: Pareto Contribution Tier`}
                              >
                                Class {prod.abcClass}
                              </span>
                            </td>
                            <td className="px-2 py-2 max-w-[120px] truncate">
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
                  </table>
                </div>

                {/* Nested Mini-Chart */}
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
                      {topProductsForMiniChart.list.map((item) => {
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

      {/* Bookmarks / Saved Presets Modal */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Saved Selection Presets
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Bookmarks Manager</h2>
              </div>
              <button
                onClick={() => setIsBookmarkModalOpen(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
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
                  placeholder="e.g. Makati Underwear Audit..."
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
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
                      <p className="font-bold text-white text-xs group-hover:text-amber-400 transition">
                        {bm.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {bm.startDate && bm.endDate ? `${bm.startDate} to ${bm.endDate}` : "All Time"} • Stores: {bm.selection.stores.length > 0 ? bm.selection.stores.join(", ") : "All"}
                      </p>
                    </div>

                    <button
                      onClick={(e) => deleteBookmark(bm.id, e)}
                      className="text-slate-600 hover:text-rose-400 p-1.5 transition rounded-lg hover:bg-slate-900 cursor-pointer"
                      title="Delete preset"
                    >
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