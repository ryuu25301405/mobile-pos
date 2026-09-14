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
  LayoutDashboard,
  SlidersHorizontal,
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
  >([0 as any]);

  const [detailSearch, setDetailSearch] = useState("");
  const [activeFilterDrawer, setActiveFilterDrawer] = useState<DimensionKey | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");

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
    <div className="min-h-screen bg-[#090D16] text-slate-100 p-4 sm:p-6 space-y-4">
      
      {/* 1. TOP HEADER & GLOBAL NAVIGATION DECK */}
      <nav className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-tight text-white">RETAIL CONTROL CENTER</span>
              <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                QlikView Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Multi-Branch Associative Analytics Suite</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/analytics/qlik"
            className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics Hub</span>
          </Link>

          <Link
            href="/inventory"
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-400" />
            <span>Store Inventory</span>
          </Link>

          <Link
            href="/scanview"
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scanner</span>
          </Link>

          <Link
            href="/reports/daily-sales"
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Daily Sales Report</span>
          </Link>
        </div>
      </nav>

      {/* 2. EXECUTIVE KPI CARDS (Full Width Top Deck) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111827]/60 backdrop-blur-xl border border-slate-800/70 rounded-2xl p-4 flex items-center justify-between shadow-lg">
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

        <div className="bg-[#111827]/60 backdrop-blur-xl border border-slate-800/70 rounded-2xl p-4 flex items-center justify-between shadow-lg">
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

        <div className="bg-[#111827]/60 backdrop-blur-xl border border-slate-800/70 rounded-2xl p-4 flex items-center justify-between shadow-lg">
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

        <div className="bg-[#111827]/60 backdrop-blur-xl border border-slate-800/70 rounded-2xl p-4 flex items-center justify-between shadow-lg">
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

      {/* 3. TOP-DOCKED HORIZONTAL FACET BAR (Interactive Qlik Filter Drawer Trigger Hub) */}
      <div className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/70 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase tracking-wider text-[11px] mr-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>Associative Facets:</span>
          </div>

          {/* Dimension Toggle Buttons */}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  count > 0
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
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
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Presets ({bookmarks.length})</span>
          </button>

          <button
            onClick={() => setIsComparativeMode(!isComparativeMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
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
              className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER DRAWER / POPUP LISTBOX WHEN ACTIVE */}
      {activeFilterDrawer && (
        <div className="bg-[#111827] border border-slate-700/80 rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
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

      {/* 4. MAIN ANALYTICS WORKSTAGE (Full Width Workspace) */}
      <div className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/70 rounded-2xl p-4 shadow-2xl space-y-4">
        
        {/* Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs font-semibold">
              <button
                onClick={() => setTableMode("drilldown")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                  tableMode === "drilldown" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Drill-Down Mode
              </button>
              <button
                onClick={() => setTableMode("cyclic")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                  tableMode === "cyclic" ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Cyclic Mode
              </button>
            </div>

            {tableMode === "cyclic" && (
              <button
                onClick={() => setCyclicIndex((prev) => (prev + 1) % CYCLIC_DIMENSIONS.length)}
                className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Dimension: {currentDimension.label}</span>
              </button>
            )}

            <button
              onClick={cycleMeasure}
              className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Measure: {activeMeasure.label} ⟳</span>
            </button>

            {tableMode === "drilldown" && drillLevel > 0 && (
              <button
                onClick={handleDrillUp}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <CornerLeftUp className="w-3.5 h-3.5" />
                <span>Drill Up</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setVisualizationMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                  visualizationMode === "table" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setVisualizationMode("chart")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                  visualizationMode === "chart" ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Chart</span>
              </button>
            </div>

            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setActiveTab("both")}
                className={`px-3 py-1 rounded-lg transition ${activeTab === "both" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Split View
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-3 py-1 rounded-lg transition ${activeTab === "summary" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab("details")}
                className={`px-3 py-1 rounded-lg transition ${activeTab === "details" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Products ({filteredProducts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Drill Breadcrumbs */}
        {tableMode === "drilldown" && (
          <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 flex items-center gap-1.5 text-xs">
            <span
              onClick={() => handleBreadcrumbClick(0)}
              className={`cursor-pointer hover:underline ${drillLevel === 0 ? "text-emerald-400 font-bold" : "text-slate-400"}`}
            >
              All Stores
            </span>
            {drillBreadcrumbs.map((bc, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <span
                  onClick={() => handleBreadcrumbClick(idx + 1)}
                  className={`cursor-pointer hover:underline ${idx + 1 === drillLevel ? "text-emerald-400 font-bold" : "text-slate-400"}`}
                >
                  {bc.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* TABLES / CHARTS STAGE */}
        <div className={`grid gap-4 ${activeTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          
          {/* SUMMARY TABLE OR CHART */}
          {(activeTab === "both" || activeTab === "summary") && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  {visualizationMode === "chart" ? `Visual Distribution: ${chartDimension.label}` : `Aggregation Table: ${currentDimension.label}`}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Sorted by {activeMeasure.label}
                </span>
              </div>

              {visualizationMode === "table" ? (
                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-4 py-3">{currentDimension.label}</th>
                        <th className="px-3 py-3 text-right">Logs</th>
                        <th className="px-3 py-3 text-right">Units</th>
                        <th className="px-4 py-3 text-right">
                          <span onClick={cycleMeasure} className="cursor-pointer hover:text-emerald-400 underline decoration-dotted">
                            {activeMeasure.label} ⟳
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-xs">
                      {loading ? (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading dataset...</td></tr>
                      ) : tableRows.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-500">No records found matching active state.</td></tr>
                      ) : (
                        tableRows.map((row) => {
                          const displayVal =
                            activeMeasure.key === "units" ? `${row.units.toLocaleString()} pcs` :
                            activeMeasure.key === "transactions" ? `${row.count.toLocaleString()} logs` :
                            activeMeasure.key === "aur" ? `₱${row.aur.toFixed(2)}` :
                            `₱${row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

                          return (
                            <tr
                              key={row.label}
                              className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                              onClick={() => handleRowClick(row.label)}
                            >
                              <td className="px-4 py-2.5 font-bold text-white group-hover:text-emerald-400 truncate max-w-[200px]">
                                {row.label}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-400 font-mono">{row.count}</td>
                              <td className="px-3 py-2.5 text-right text-slate-300 font-mono">{row.units}</td>
                              <td className="px-4 py-2.5 text-right font-black text-emerald-400 font-mono whitespace-nowrap">
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
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 font-bold">Chart Dimension:</span>
                    <select
                      value={chartDimensionIndex}
                      onChange={(e) => setChartDimensionIndex(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-800 text-emerald-400 font-bold px-3 py-1 rounded-lg focus:outline-none cursor-pointer text-xs"
                    >
                      {CYCLIC_DIMENSIONS.map((dim, idx) => (
                        <option key={dim.key} value={idx}>{dim.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-[410px] overflow-y-auto space-y-2 pr-1">
                    {chartRows.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">No chart data available.</div>
                    ) : (
                      chartRows.map((row) => {
                        const pct = Math.max(6, (row.measureValue / maxChartMeasureValue) * 100);
                        const displayVal =
                          activeMeasure.key === "units" ? `${row.units.toLocaleString()} pcs` :
                          activeMeasure.key === "transactions" ? `${row.count.toLocaleString()} logs` :
                          activeMeasure.key === "aur" ? `₱${row.aur.toFixed(2)}` :
                          `₱${row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

                        return (
                          <div
                            key={row.label}
                            onClick={() => handleRowClick(row.label)}
                            className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 p-3 rounded-xl cursor-pointer transition space-y-1.5 group"
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
                            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                              <div style={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500" />
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

          {/* ITEMIZED PRODUCTS TABLE */}
          {(activeTab === "both" || activeTab === "details") && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Itemized Product Catalog (ABC Classified)</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg font-mono font-bold">
                    {filteredProducts.length} items
                  </span>
                </div>

                <div className="relative w-40 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search style or SKU..."
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs pl-8 pr-3 py-1 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-[340px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-2.5">Style / SKU</th>
                      <th className="px-3 py-2.5">Pareto Class</th>
                      <th className="px-3 py-2.5">Color & Size</th>
                      <th className="px-3 py-2.5 text-right">Unit Price</th>
                      <th className="px-3 py-2.5 text-right">Sold</th>
                      <th className="px-4 py-2.5 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-xs">
                    {filteredProducts.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-500">No product records in active state.</td></tr>
                    ) : (
                      filteredProducts.map((prod: any) => (
                        <tr key={prod.key} className="hover:bg-slate-900/60 transition-colors">
                          <td className="px-4 py-2 font-mono whitespace-nowrap">
                            <span className="font-bold text-emerald-400 block">{prod.styleCode}</span>
                            <span className="text-blue-400 text-[10px] block">{prod.sku !== "-" ? prod.sku : ""}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${
                              prod.abcClass === "A" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                              prod.abcClass === "B" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" :
                              "bg-slate-800 text-slate-400 border-slate-700"
                            }`}>
                              Class {prod.abcClass}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-[130px] truncate">
                            <span className="text-white block truncate font-medium" title={prod.styleName}>{prod.styleName}</span>
                            <span className="text-[10px] text-slate-400">{prod.color} • <strong className="text-slate-200">{prod.size}</strong></span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono whitespace-nowrap">₱{prod.price.toFixed(0)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-white whitespace-nowrap">{prod.units} pcs</td>
                          <td className="px-4 py-2 text-right font-mono font-black text-emerald-400 whitespace-nowrap">
                            ₱{prod.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Nested Mini-Chart Distribution */}
              {topProductsForMiniChart.list.length > 0 && (
                <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Top Product Revenue Distribution</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{topProductsForMiniChart.list.length} leading variants</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {topProductsForMiniChart.list.map((item) => {
                      const pct = Math.min(100, Math.max(8, (item.revenue / topProductsForMiniChart.maxRev) * 100));
                      return (
                        <div
                          key={item.key}
                          onClick={() => toggleSelection("style_code", item.styleCode)}
                          className="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 p-2.5 rounded-xl cursor-pointer transition flex flex-col justify-between space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold text-slate-200 truncate mr-1">{item.styleCode}</span>
                            <span className="font-mono text-emerald-400 font-bold shrink-0">₱{item.revenue.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div style={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full" />
                          </div>
                          <span className="text-[9px] text-slate-500 truncate block">{item.color} • {item.size} ({item.units} pcs)</span>
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

      {/* BOOKMARKS MANAGER MODAL */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 text-left">
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