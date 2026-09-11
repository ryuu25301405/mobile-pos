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
}

type DimensionKey = "store" | "department" | "category" | "style_code";

interface DimensionConfig {
  key: DimensionKey;
  label: string;
}

const CYCLIC_DIMENSIONS: DimensionConfig[] = [
  { key: "store", label: "Store Location" },
  { key: "category", label: "Category" },
  { key: "department", label: "Department" },
  { key: "style_code", label: "Style Code" },
];

const DRILL_HIERARCHY: DimensionConfig[] = [
  { key: "store", label: "Store Location" },
  { key: "department", label: "Department" },
  { key: "category", label: "Category" },
  { key: "style_code", label: "Style Code" },
];

export default function QlikViewAnalyticsPage() {
  const [data, setData] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Selections (Green values in Qlik)
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // Table Mode: 'cyclic' or 'drilldown'
  const [tableMode, setTableMode] = useState<"cyclic" | "drilldown">("cyclic");
  const [cyclicIndex, setCyclicIndex] = useState<number>(0);
  const [drillLevel, setDrillLevel] = useState<number>(0);

  // Breadcrumbs for hierarchical drilldown
  const [drillBreadcrumbs, setDrillBreadcrumbs] = useState<
    { dim: DimensionConfig; value: string }[]
  >([]);

  // List Box Search States
  const [storeSearch, setStoreSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");

  // Product detail table search
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
        return {
          id: String(row.id),
          store: row.store || "Unassigned Store",
          style_code: row.style_code || "Unknown Style",
          sku: row.sku || "-",
          style_name: row.style_name || "Unassigned Item",
          description: row.description || "-",
          color: row.color || "-",
          size: row.size || "-",
          category: row.category && row.category !== "-" ? row.category : "Unassigned Category",
          department: row.department && row.department !== "-" ? row.department : "Unassigned Dept",
          price: pr,
          quantity: qty,
          revenue: pr * qty,
          scanned_at: row.scanned_at,
        };
      });
      setData(parsed);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. Universe Sets (Full population - Qlik {1} identifier)
  const universe = useMemo(() => {
    return {
      stores: Array.from(new Set(data.map((d) => d.store))).sort(),
      categories: Array.from(new Set(data.map((d) => d.category))).sort(),
      departments: Array.from(new Set(data.map((d) => d.department))).sort(),
      styles: Array.from(new Set(data.map((d) => d.style_code))).sort(),
      totalRevenue: data.reduce((acc, d) => acc + d.revenue, 0),
      totalUnits: data.reduce((acc, d) => acc + d.quantity, 0),
    };
  }, [data]);

  // 3. Current Selection Subset ($ State)
  const currentSubset = useMemo(() => {
    return data.filter((row) => {
      const matchStore = selectedStores.length === 0 || selectedStores.includes(row.store);
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(row.department);
      const matchStyle = selectedStyles.length === 0 || selectedStyles.includes(row.style_code);
      return matchStore && matchCat && matchDept && matchStyle;
    });
  }, [data, selectedStores, selectedCategories, selectedDepartments, selectedStyles]);

  // 4. Associative Possible / Excluded Sets (White vs Gray)
  const possibleValues = useMemo(() => {
    const storeSubset = data.filter((row) => {
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(row.department);
      const matchStyle = selectedStyles.length === 0 || selectedStyles.includes(row.style_code);
      return matchCat && matchDept && matchStyle;
    });
    const possibleStores = new Set(storeSubset.map((r) => r.store));

    const catSubset = data.filter((row) => {
      const matchStore = selectedStores.length === 0 || selectedStores.includes(row.store);
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(row.department);
      const matchStyle = selectedStyles.length === 0 || selectedStyles.includes(row.style_code);
      return matchStore && matchDept && matchStyle;
    });
    const possibleCats = new Set(catSubset.map((r) => r.category));

    const deptSubset = data.filter((row) => {
      const matchStore = selectedStores.length === 0 || selectedStores.includes(row.store);
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      const matchStyle = selectedStyles.length === 0 || selectedStyles.includes(row.style_code);
      return matchStore && matchCat && matchStyle;
    });
    const possibleDepts = new Set(deptSubset.map((r) => r.department));

    return {
      stores: possibleStores,
      categories: possibleCats,
      departments: possibleDepts,
    };
  }, [data, selectedStores, selectedCategories, selectedDepartments, selectedStyles]);

  // List Box Selection Toggle
  const toggleSelection = (
    field: "store" | "category" | "department" | "style_code",
    value: string
  ) => {
    if (field === "store") {
      setSelectedStores((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else if (field === "category") {
      setSelectedCategories((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else if (field === "department") {
      setSelectedDepartments((prev) =>
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
    setSelectedCategories([]);
    setSelectedDepartments([]);
    setSelectedStyles([]);
    setDrillLevel(0);
    setDrillBreadcrumbs([]);
  };

  // 5. Active Metrics
  const metrics = useMemo(() => {
    const revenue = currentSubset.reduce((acc, curr) => acc + curr.revenue, 0);
    const units = currentSubset.reduce((acc, curr) => acc + curr.quantity, 0);
    const transactions = currentSubset.length;
    const shareOfTotal = universe.totalRevenue > 0 ? (revenue / universe.totalRevenue) * 100 : 0;
    return { revenue, units, transactions, shareOfTotal };
  }, [currentSubset, universe.totalRevenue]);

  // Active Dimension Definition
  const currentDimension = useMemo(() => {
    return tableMode === "drilldown"
      ? DRILL_HIERARCHY[drillLevel]
      : CYCLIC_DIMENSIONS[cyclicIndex];
  }, [tableMode, drillLevel, cyclicIndex]);

  // 6. Straight Table Aggregation
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

  // 7. Granular Product Details (Aggregated by Product Variant in the filtered state)
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
      if (dim.key === "style_code") setSelectedStyles([]);
    }
    setDrillBreadcrumbs((prev) => prev.slice(0, targetIndex));
    setDrillLevel(targetIndex);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-5">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              QlikView Engine Active
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Associative In-Memory Client
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            Associative Sales & Drill-Down Analyzer
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/inventory"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-400" />
            <span>Store Inventory</span>
          </Link>
          <Link
            href="/reports/daily-sales"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Daily Sales</span>
          </Link>
        </div>
      </header>

      {/* Current Selections Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Filter className="w-3 h-3 text-emerald-400" />
            Current Selections:
          </span>

          {selectedStores.length === 0 &&
          selectedCategories.length === 0 &&
          selectedDepartments.length === 0 &&
          selectedStyles.length === 0 ? (
            <span className="text-slate-500 italic">No selections active (Full Universe)</span>
          ) : (
            <>
              {selectedStores.map((s) => (
                <span
                  key={s}
                  onClick={() => toggleSelection("store", s)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Click to remove selection"
                >
                  Store: {s} <X className="w-3 h-3" />
                </span>
              ))}

              {selectedDepartments.map((d) => (
                <span
                  key={d}
                  onClick={() => toggleSelection("department", d)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Click to remove selection"
                >
                  Dept: {d} <X className="w-3 h-3" />
                </span>
              ))}

              {selectedCategories.map((c) => (
                <span
                  key={c}
                  onClick={() => toggleSelection("category", c)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Click to remove selection"
                >
                  Category: {c} <X className="w-3 h-3" />
                </span>
              ))}

              {selectedStyles.map((st) => (
                <span
                  key={st}
                  onClick={() => toggleSelection("style_code", st)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Click to remove selection"
                >
                  Style: {st} <X className="w-3 h-3" />
                </span>
              ))}
            </>
          )}
        </div>

        {(selectedStores.length > 0 ||
          selectedCategories.length > 0 ||
          selectedDepartments.length > 0 ||
          selectedStyles.length > 0) && (
          <button
            onClick={clearAllSelections}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filtered Revenue
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">
              ₱{metrics.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
              {metrics.shareOfTotal.toFixed(1)}% of total universe (₱
              {universe.totalRevenue.toLocaleString()})
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Units in Selection
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">
              {metrics.units.toLocaleString()} <span className="text-xs text-slate-400 font-normal">pcs</span>
            </h3>
            <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
              out of {universe.totalUnits.toLocaleString()} total units
            </p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Transactions
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">
              {metrics.transactions.toLocaleString()} <span className="text-xs text-slate-400 font-normal">logs</span>
            </h3>
            <p className="text-[10px] text-blue-400 font-mono mt-0.5">
              matching active state
            </p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Avg Ticket in State
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">
              ₱
              {metrics.transactions > 0
                ? (metrics.revenue / metrics.transactions).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })
                : "0.00"}
            </h3>
            <p className="text-[10px] text-purple-400 font-mono mt-0.5">
              per transaction
            </p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Workspace: 3 Associative List Boxes + 1 Drill-Down/Cyclic Table */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Side: Associative List Boxes */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
            <span>List Boxes (Green / White / Gray)</span>
            <div className="flex items-center gap-1.5 text-[10px] lowercase text-slate-400">
              <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span> sel
              <span className="w-2.5 h-2.5 rounded bg-slate-900 border border-slate-700 inline-block ml-1"></span> opt
              <span className="w-2.5 h-2.5 rounded bg-slate-950/60 opacity-40 inline-block ml-1"></span> excl
            </div>
          </div>

          {/* LIST BOX 1: STORES */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Store Location</span>
              {selectedStores.length > 0 && (
                <button
                  onClick={() => setSelectedStores([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1.5 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter stores..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs px-2 py-1 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/40 text-xs">
              {universe.stores
                .filter((s) => s.toLowerCase().includes(storeSearch.toLowerCase()))
                .map((store) => {
                  const isSelected = selectedStores.includes(store);
                  const isPossible = possibleValues.stores.has(store);

                  return (
                    <div
                      key={store}
                      onClick={() => toggleSelection("store", store)}
                      className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate">{store}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* LIST BOX 2: DEPARTMENTS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Department</span>
              {selectedDepartments.length > 0 && (
                <button
                  onClick={() => setSelectedDepartments([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1.5 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter departments..."
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs px-2 py-1 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/40 text-xs">
              {universe.departments
                .filter((d) => d.toLowerCase().includes(departmentSearch.toLowerCase()))
                .map((dept) => {
                  const isSelected = selectedDepartments.includes(dept);
                  const isPossible = possibleValues.departments.has(dept);

                  return (
                    <div
                      key={dept}
                      onClick={() => toggleSelection("department", dept)}
                      className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate">{dept}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* LIST BOX 3: CATEGORIES */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Category</span>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-1.5 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Filter categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs px-2 py-1 rounded text-white focus:outline-none"
              />
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/40 text-xs">
              {universe.categories
                .filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()))
                .map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  const isPossible = possibleValues.categories.has(cat);

                  return (
                    <div
                      key={cat}
                      onClick={() => toggleSelection("category", cat)}
                      className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold"
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Side: Straight Table Supporting Cyclic & Drill-Down */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {/* Table Control Header */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Mode Selector Toggle */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setTableMode("drilldown")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      tableMode === "drilldown"
                        ? "bg-emerald-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Drill-Down Group
                  </button>
                  <button
                    onClick={() => setTableMode("cyclic")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      tableMode === "cyclic"
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Cyclic Group
                  </button>
                </div>

                {/* Cyclic Button */}
                {tableMode === "cyclic" && (
                  <button
                    onClick={() => setCyclicIndex((prev) => (prev + 1) % CYCLIC_DIMENSIONS.length)}
                    className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Cycle: {currentDimension.label}</span>
                  </button>
                )}

                {/* Drill Up Button */}
                {tableMode === "drilldown" && drillLevel > 0 && (
                  <button
                    onClick={handleDrillUp}
                    className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                    title="Step back up one level"
                  >
                    <CornerLeftUp className="w-3.5 h-3.5" />
                    <span>Drill Up</span>
                  </button>
                )}
              </div>

              <span className="text-xs text-slate-400 font-mono">
                {tableRows.length} rows in active state
              </span>
            </div>

            {/* Drill-Down Breadcrumb Bar */}
            {tableMode === "drilldown" && (
              <div className="bg-slate-950/70 px-4 py-2 border-b border-slate-800/80 flex items-center gap-1.5 text-xs">
                <span
                  onClick={() => handleBreadcrumbClick(0)}
                  className={`cursor-pointer hover:underline ${
                    drillLevel === 0 ? "text-emerald-400 font-bold" : "text-slate-400"
                  }`}
                >
                  All Stores
                </span>

                {drillBreadcrumbs.map((bc, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span
                      onClick={() => handleBreadcrumbClick(idx + 1)}
                      className={`cursor-pointer hover:underline ${
                        idx + 1 === drillLevel
                          ? "text-emerald-400 font-bold"
                          : "text-slate-400"
                      }`}
                    >
                      {bc.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Straight Table View */}
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3">
                      <span className="text-white font-bold flex items-center gap-1.5">
                        {currentDimension.label}
                        {tableMode === "drilldown" && drillLevel < DRILL_HIERARCHY.length - 1 && (
                          <span className="text-[9px] lowercase bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-normal">
                            (click row to drill down)
                          </span>
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right">Transactions</th>
                    <th className="px-4 py-3 text-right">Units Sold</th>
                    <th className="px-4 py-3 text-right">Total Revenue</th>
                    <th className="px-4 py-3 w-32">Share of State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Calculating associative aggregations...
                      </td>
                    </tr>
                  ) : tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No transactions match the selected state.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => {
                      const share =
                        metrics.revenue > 0 ? (row.revenue / metrics.revenue) * 100 : 0;

                      return (
                        <tr
                          key={row.label}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          onClick={() => handleRowClick(row.label)}
                          title={
                            tableMode === "drilldown"
                              ? `Click to filter and drill down into ${row.label}`
                              : `Click to select / toggle ${row.label}`
                          }
                        >
                          <td className="px-4 py-3 font-semibold text-white group-hover:text-emerald-400 transition-colors truncate max-w-xs flex items-center justify-between">
                            <span>{row.label}</span>
                            {tableMode === "drilldown" &&
                              drillLevel < DRILL_HIERARCHY.length - 1 && (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                              )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 font-mono">
                            {row.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300 font-mono">
                            {row.units.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono">
                            ₱{row.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(share, 100)}%` }}
                                className="bg-emerald-500 h-full rounded-full"
                              />
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono block text-right mt-0.5">
                              {share.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Granular Product Details Table (Driven by Active Selections) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl space-y-0">
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                Itemized Product Sales Breakdown
              </h3>
              <p className="text-[11px] text-slate-400">
                Displaying specific items matching your active selections ({filteredProducts.length} variants found)
              </p>
            </div>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search Style, SKU, Color, Size..."
              value={detailSearch}
              onChange={(e) => setDetailSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs px-3 py-1.5 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
              <tr>
                <th className="px-4 py-3">Style Code</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 text-center">Color</th>
                <th className="px-4 py-3 text-center">Size</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Qty Sold</th>
                <th className="px-4 py-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No individual product records match this filter combination.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr
                    key={prod.key}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {prod.styleCode}
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-400 whitespace-nowrap">
                      {prod.sku}
                    </td>
                    <td className="px-4 py-3 font-medium text-white max-w-xs truncate">
                      {prod.styleName}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300 whitespace-nowrap">
                      {prod.color}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded text-[11px]">
                        {prod.size}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 font-mono whitespace-nowrap">
                      ₱{prod.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-200 whitespace-nowrap">
                      {prod.units}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      ₱{prod.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredProducts.length > 0 && (
              <tfoot className="bg-slate-950 text-slate-300 font-bold border-t border-slate-800">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-slate-400">
                    Selection Total:
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">
                    {metrics.units} pcs
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400 text-sm">
                    ₱{metrics.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}