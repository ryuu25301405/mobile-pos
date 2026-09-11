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
  Search,
  Check,
  X,
  TrendingUp,
  DollarSign,
  ShoppingBag,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface SalesRecord {
  id: string;
  store: string;
  style_code: string;
  sku: string;
  category: string;
  department: string;
  price: number;
  quantity: number;
  revenue: number;
}

type DimensionKey = "store" | "category" | "department" | "style_code";

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

export default function QlikViewAnalyticsPage() {
  const [data, setData] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Selections (Green values)
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Cyclic Group State
  const [cyclicIndex, setCyclicIndex] = useState(0);

  // List Box Search States
  const [storeSearch, setStoreSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");

  // 1. Fetch raw transaction data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: logs, error } = await supabase
      .from("scanned_logs")
      .select("id, store, style_code, sku, category, department, price, quantity")
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
          category: row.category && row.category !== "-" ? row.category : "Unassigned Category",
          department: row.department && row.department !== "-" ? row.department : "Unassigned Dept",
          price: pr,
          quantity: qty,
          revenue: pr * qty,
        };
      });
      setData(parsed);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. Compute Universe Sets (All distinct values in database)
  const universe = useMemo(() => {
    return {
      stores: Array.from(new Set(data.map((d) => d.store))).sort(),
      categories: Array.from(new Set(data.map((d) => d.category))).sort(),
      departments: Array.from(new Set(data.map((d) => d.department))).sort(),
      totalRevenue: data.reduce((acc, d) => acc + d.revenue, 0), // Equivalent to {1} Sum(Revenue)
      totalUnits: data.reduce((acc, d) => acc + d.quantity, 0),
    };
  }, [data]);

  // 3. Qlik Associative Engine: Filter Current Data Subset ($ Selection State)
  const currentSubset = useMemo(() => {
    return data.filter((row) => {
      const matchStore = selectedStores.length === 0 || selectedStores.includes(row.store);
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(row.department);
      return matchStore && matchCat && matchDept;
    });
  }, [data, selectedStores, selectedCategories, selectedDepartments]);

  // 4. Calculate Possible / Associated Values (White vs Dark Gray)
  // For each field, determine what is possible based on selections in OTHER fields
  const possibleValues = useMemo(() => {
    // When evaluating Stores: check against Category and Dept selections
    const storeSubset = data.filter((row) => {
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(row.department);
      return matchCat && matchDept;
    });
    const possibleStores = new Set(storeSubset.map((r) => r.store));

    // When evaluating Categories: check against Store and Dept selections
    const catSubset = data.filter((row) => {
      const matchStore = selectedStores.length === 0 || selectedStores.includes(row.store);
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(row.department);
      return matchStore && matchDept;
    });
    const possibleCats = new Set(catSubset.map((r) => r.category));

    // When evaluating Departments: check against Store and Category selections
    const deptSubset = data.filter((row) => {
      const matchStore = selectedStores.length === 0 || selectedStores.includes(row.store);
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      return matchStore && matchCat;
    });
    const possibleDepts = new Set(deptSubset.map((r) => r.department));

    return {
      stores: possibleStores,
      categories: possibleCats,
      departments: possibleDepts,
    };
  }, [data, selectedStores, selectedCategories, selectedDepartments]);

  // Toggle selection (QlikView single-click selection behavior)
  const toggleSelection = (
    field: "store" | "category" | "department",
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
    }
  };

  const clearAllSelections = () => {
    setSelectedStores([]);
    setSelectedCategories([]);
    setSelectedDepartments([]);
  };

  // 5. Active Metrics (Set Analysis: Sum($<Current> Revenue) vs Sum({1} Revenue))
  const metrics = useMemo(() => {
    const revenue = currentSubset.reduce((acc, curr) => acc + curr.revenue, 0);
    const units = currentSubset.reduce((acc, curr) => acc + curr.quantity, 0);
    const transactions = currentSubset.length;
    const shareOfTotal = universe.totalRevenue > 0 ? (revenue / universe.totalRevenue) * 100 : 0;
    return { revenue, units, transactions, shareOfTotal };
  }, [currentSubset, universe.totalRevenue]);

  // 6. Cyclic Straight Table Aggregations
  const activeDim = CYCLIC_DIMENSIONS[cyclicIndex];

  const cyclicAggregations = useMemo(() => {
    const map: Record<string, { label: string; revenue: number; units: number; count: number }> = {};

    currentSubset.forEach((item) => {
      const keyVal = item[activeDim.key] || "Unknown";
      if (!map[keyVal]) {
        map[keyVal] = { label: keyVal, revenue: 0, units: 0, count: 0 };
      }
      map[keyVal].revenue += item.revenue;
      map[keyVal].units += item.quantity;
      map[keyVal].count += 1;
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [currentSubset, activeDim]);

  const cycleNextDimension = () => {
    setCyclicIndex((prev) => (prev + 1) % CYCLIC_DIMENSIONS.length);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-5">
      {/* Header & Navigation */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              QlikView Associative Model
            </span>
            <span className="text-xs text-slate-500 font-mono">
              In-Memory Client Engine
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1 flex items-center gap-2.5">
            <span>Associative Sales & Inventory Analyzer</span>
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

      {/* Current Selections Bar (QlikView Selection Bar) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Filter className="w-3 h-3 text-emerald-400" />
            Current Selections:
          </span>

          {selectedStores.length === 0 &&
          selectedCategories.length === 0 &&
          selectedDepartments.length === 0 ? (
            <span className="text-slate-500 italic">No selections active (Full Universe)</span>
          ) : (
            <>
              {selectedStores.map((s) => (
                <span
                  key={s}
                  onClick={() => toggleSelection("store", s)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Click to remove"
                >
                  Store: {s} <X className="w-3 h-3" />
                </span>
              ))}

              {selectedCategories.map((c) => (
                <span
                  key={c}
                  onClick={() => toggleSelection("category", c)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Click to remove"
                >
                  Category: {c} <X className="w-3 h-3" />
                </span>
              ))}

              {selectedDepartments.map((d) => (
                <span
                  key={d}
                  onClick={() => toggleSelection("department", d)}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition"
                  title="Click to remove"
                >
                  Dept: {d} <X className="w-3 h-3" />
                </span>
              ))}
            </>
          )}
        </div>

        {(selectedStores.length > 0 ||
          selectedCategories.length > 0 ||
          selectedDepartments.length > 0) && (
          <button
            onClick={clearAllSelections}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold transition px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* KPI Ribbon (Set Analysis: $ Current vs {1} Total Universe) */}
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

      {/* Main Workspace: 3 QlikView List Boxes + 1 Cyclic Table */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Side: 3 Associative List Boxes */}
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
                  className="text-[10px] text-slate-500 hover:text-rose-400"
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
                          ? "bg-emerald-600 text-white font-bold" // GREEN (Selected)
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800" // WHITE (Possible)
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400" // GRAY (Excluded)
                      }`}
                    >
                      <span className="truncate">{store}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* LIST BOX 2: CATEGORIES */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Category</span>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400"
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
                          ? "bg-emerald-600 text-white font-bold" // GREEN (Selected)
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800" // WHITE (Possible)
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400" // GRAY (Excluded)
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* LIST BOX 3: DEPARTMENTS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Department</span>
              {selectedDepartments.length > 0 && (
                <button
                  onClick={() => setSelectedDepartments([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400"
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
                          ? "bg-emerald-600 text-white font-bold" // GREEN (Selected)
                          : isPossible
                          ? "bg-slate-900 text-slate-200 hover:bg-slate-800" // WHITE (Possible)
                          : "bg-slate-950/80 text-slate-600 hover:text-slate-400" // GRAY (Excluded)
                      }`}
                    >
                      <span className="truncate">{dept}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Side: QlikView Cyclic Straight Table */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {/* Cyclic Header Bar */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={cycleNextDimension}
                  className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                  title="Click to cycle dimension"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Cycle Dimension: {activeDim.label}</span>
                </button>
                <span className="text-[11px] text-slate-500">
                  (Click header to rotate dimension)
                </span>
              </div>

              <span className="text-xs text-slate-400 font-mono">
                {cyclicAggregations.length} rows in current state
              </span>
            </div>

            {/* Straight Table View */}
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 cursor-pointer" onClick={cycleNextDimension}>
                      <span className="text-indigo-400 hover:underline">
                        {activeDim.label} ⟳
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right">Transactions</th>
                    <th className="px-4 py-3 text-right">Units Sold</th>
                    <th className="px-4 py-3 text-right">Total Revenue</th>
                    <th className="px-4 py-3 w-32">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Calculating associative aggregations...
                      </td>
                    </tr>
                  ) : cyclicAggregations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No transactions match the selected active state.
                      </td>
                    </tr>
                  ) : (
                    cyclicAggregations.map((row) => {
                      const share =
                        metrics.revenue > 0 ? (row.revenue / metrics.revenue) * 100 : 0;

                      return (
                        <tr
                          key={row.label}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          onClick={() => {
                            // Interactive Cross-Filtering: clicking row filters that dimension
                            if (activeDim.key === "store") toggleSelection("store", row.label);
                            if (activeDim.key === "category") toggleSelection("category", row.label);
                            if (activeDim.key === "department") toggleSelection("department", row.label);
                          }}
                          title={`Click to select/toggle ${row.label}`}
                        >
                          <td className="px-4 py-3 font-semibold text-white group-hover:text-emerald-400 transition-colors truncate max-w-xs">
                            {row.label}
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
    </div>
  );
}