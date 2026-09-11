"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Calendar as CalendarIcon,
  Store,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Download,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  FileText,
  Award,
  Edit2,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface SalesLog {
  id: string;
  sku: string | null;
  style_code: string | null;
  style_name: string | null;
  description: string | null;
  color: string | null;
  size: string | null;
  category: string | null;
  department: string | null;
  price: number | null;
  quantity?: number | null;
  store?: string | null;
  scanned_at: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DailySalesReportPage() {
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedStore, setSelectedStore] = useState<string>("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dropdown Option Lists
  const [stores, setStores] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Core Data & State
  const [salesData, setSalesData] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Inline Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Load Dropdowns
  useEffect(() => {
    async function loadFilterOptions() {
      const { data, error } = await supabase
        .from("scanned_logs")
        .select("store, department, category");

      if (error) {
        console.error("Error loading filter options:", error);
        return;
      }

      if (data) {
        setStores(Array.from(new Set(data.map((item) => item.store))).filter(Boolean) as string[]);
        setDepartments(Array.from(new Set(data.map((item) => item.department))).filter(Boolean) as string[]);
        setCategories(Array.from(new Set(data.map((item) => item.category))).filter(Boolean) as string[]);
      }
    }
    loadFilterOptions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedStore, selectedDepartment, selectedCategory, searchQuery, pageSize]);

  // Fetch Sales Logs
  const fetchDailySales = useCallback(async () => {
    setLoading(true);

    const [year, month, day] = selectedDate.split("-").map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

    let query = supabase
      .from("scanned_logs")
      .select("*")
      .gte("scanned_at", startDate.toISOString())
      .lte("scanned_at", endDate.toISOString())
      .order("scanned_at", { ascending: false });

    if (selectedStore !== "ALL") query = query.eq("store", selectedStore);
    if (selectedDepartment !== "ALL") query = query.eq("department", selectedDepartment);
    if (selectedCategory !== "ALL") query = query.eq("category", selectedCategory);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching daily sales:", error);
    } else {
      setSalesData(data || []);
    }
    setLoading(false);
  }, [selectedDate, selectedStore, selectedDepartment, selectedCategory]);

  useEffect(() => {
    fetchDailySales();

    const channel = supabase
      .channel("daily_sales_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scanned_logs" },
        () => fetchDailySales()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDailySales]);

  // Inline Quantity Edit Handling
  const startEditing = (log: SalesLog) => {
    setEditingId(log.id);
    setEditQty(log.quantity ?? 1);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveQuantity = async (id: string) => {
    if (editQty < 1) return;
    setUpdatingId(id);

    try {
      const { data, error } = await supabase
        .from("scanned_logs")
        .update({ quantity: editQty })
        .eq("id", id)
        .select();

      if (error) {
        console.error("Supabase update error:", error);
        alert(`Failed to save quantity: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.warn("No rows updated. Verify Supabase RLS policies for UPDATE permission.");
        alert("The update was rejected by Supabase. Please ensure your RLS UPDATE policy is configured.");
        return;
      }

      setSalesData((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity: editQty } : item))
      );
      setEditingId(null);
    } catch (err) {
      console.error("Unexpected error saving quantity:", err);
      alert("Unexpected error updating quantity.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Search Filter
  const filteredSalesData = useMemo(() => {
    if (!searchQuery.trim()) return salesData;

    const query = searchQuery.toLowerCase();
    return salesData.filter((item) =>
      [
        item.sku,
        item.style_code,
        item.description,
        item.style_name,
        item.color,
        item.size,
        item.store,
        item.department,
        item.category,
      ]
        .filter(Boolean)
        .some((val) => val!.toLowerCase().includes(query))
    );
  }, [salesData, searchQuery]);

  // Pagination
  const totalItems = filteredSalesData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSalesData.slice(start, start + pageSize);
  }, [filteredSalesData, currentPage, pageSize]);

  // Aggregated Metrics
  const metrics = useMemo(() => {
    const totalUnits = filteredSalesData.reduce((acc, curr) => acc + (curr.quantity ?? 1), 0);
    const totalRevenue = filteredSalesData.reduce(
      (acc, curr) => acc + Number(curr.price || 0) * (curr.quantity ?? 1),
      0
    );
    const totalTransactions = filteredSalesData.length;
    const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return { totalUnits, totalRevenue, totalTransactions, avgOrderValue };
  }, [filteredSalesData]);

  // Store Performance Matrix
  const storeMatrix = useMemo(() => {
    const map: Record<
      string,
      {
        store: string;
        revenue: number;
        units: number;
        transactions: number;
        avgOrderValue: number;
        revenueShare: number;
      }
    > = {};

    filteredSalesData.forEach((item) => {
      const storeName = item.store || "Unassigned Store";
      const qty = item.quantity ?? 1;
      const rev = Number(item.price || 0) * qty;

      if (!map[storeName]) {
        map[storeName] = {
          store: storeName,
          revenue: 0,
          units: 0,
          transactions: 0,
          avgOrderValue: 0,
          revenueShare: 0,
        };
      }

      map[storeName].revenue += rev;
      map[storeName].units += qty;
      map[storeName].transactions += 1;
    });

    const totalRev = metrics.totalRevenue || 1;

    return Object.values(map)
      .map((item) => ({
        ...item,
        avgOrderValue: item.transactions > 0 ? item.revenue / item.transactions : 0,
        revenueShare: Math.min((item.revenue / totalRev) * 100, 100),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSalesData, metrics.totalRevenue]);

  // Top Products
  const topProducts = useMemo(() => {
    const productMap: Record<string, { sku: string; name: string; qty: number; revenue: number }> = {};

    filteredSalesData.forEach((item) => {
      const key = item.sku || item.style_code || "UNKNOWN";
      const qty = item.quantity ?? 1;
      const revenue = Number(item.price || 0) * qty;

      if (!productMap[key]) {
        productMap[key] = {
          sku: key,
          name: item.description || item.style_name || key,
          qty: 0,
          revenue: 0,
        };
      }
      productMap[key].qty += qty;
      productMap[key].revenue += revenue;
    });

    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSalesData]);

  const exportToPDF = () => {
    window.print();
  };

  const exportToCSV = () => {
    if (filteredSalesData.length === 0) return;

    const headers = [
      "Time",
      "SKU",
      "Style Code",
      "Description",
      "Color",
      "Size",
      "Category",
      "Department",
      "Store",
      "Quantity",
      "Unit Price",
      "Total Amount",
    ];

    const rows = filteredSalesData.map((s) => {
      const qty = s.quantity ?? 1;
      const price = Number(s.price || 0);
      return [
        new Date(s.scanned_at).toLocaleTimeString(),
        s.sku || "",
        s.style_code || "",
        `"${s.description || ""}"`,
        s.color || "",
        s.size || "",
        s.category || "",
        s.department || "",
        s.store || "N/A",
        qty,
        price,
        qty * price,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sales_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            display: block !important;
            color: #0f172a !important;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            background-color: #f8fafc !important;
            color: #0f172a !important;
          }
          .print-table th, .print-table td {
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5 no-print">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Daily Sales Report
            </h1>
            <p className="text-sm text-slate-400">
              Real-time daily transaction analytics, adjustments, and performance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm">
              <CalendarIcon className="w-4 h-4 text-indigo-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-100 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm">
              <Store className="w-4 h-4 text-indigo-400" />
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="bg-transparent text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Stores</option>
                {stores.map((s) => (
                  <option key={s} value={s} className="bg-slate-900">{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchDailySales}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>

            <button
              onClick={exportToPDF}
              disabled={filteredSalesData.length === 0}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium px-3.5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Export PDF Report
            </button>

            <button
              onClick={exportToCSV}
              disabled={filteredSalesData.length === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Printable & Screen Report Container */}
        <div ref={reportContainerRef} className="space-y-6 print-container">
          {/* Print Header */}
          <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
            <h1 className="text-xl font-bold text-slate-900">DAILY SALES & PERFORMANCE REPORT</h1>
            <p className="text-xs text-slate-600">
              Date: {selectedDate} | Store Filter: {selectedStore} | Department Filter: {selectedDepartment}
            </p>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 print-card rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 print:text-slate-600">Total Revenue</p>
                <h3 className="text-2xl font-bold text-white print:text-slate-900 mt-1">
                  ₱{metrics.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl no-print">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 print-card rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 print:text-slate-600">Units Sold</p>
                <h3 className="text-2xl font-bold text-white print:text-slate-900 mt-1">{metrics.totalUnits.toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl no-print">
                <ShoppingBag className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 print-card rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 print:text-slate-600">Total Scans</p>
                <h3 className="text-2xl font-bold text-white print:text-slate-900 mt-1">{metrics.totalTransactions.toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl no-print">
                <Receipt className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 print-card rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 print:text-slate-600">Avg Item Price</p>
                <h3 className="text-2xl font-bold text-white print:text-slate-900 mt-1">
                  ₱{metrics.avgOrderValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl no-print">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Store Comparison Matrix & Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 print-card rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400 print:text-indigo-700" />
                  <h2 className="text-base font-semibold text-slate-200 print:text-slate-900">
                    Store Comparison & Performance Matrix
                  </h2>
                </div>
                <span className="text-xs text-slate-500 print:text-slate-600">
                  {storeMatrix.length} {storeMatrix.length === 1 ? "Location" : "Locations"} Reporting
                </span>
              </div>

              {storeMatrix.length === 0 ? (
                <p className="text-sm text-slate-500 py-12 text-center">
                  No sales recorded for the selected date.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 print:bg-slate-100 print:text-slate-700">
                      <tr>
                        <th className="px-3 py-2.5">Rank & Store</th>
                        <th className="px-3 py-2.5 text-right">Units</th>
                        <th className="px-3 py-2.5 text-right">Scans</th>
                        <th className="px-3 py-2.5 text-right">Avg Ticket</th>
                        <th className="px-3 py-2.5 text-right">Revenue</th>
                        <th className="px-3 py-2.5 w-32">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 print:divide-slate-200">
                      {storeMatrix.map((item, idx) => (
                        <tr key={item.store} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {idx === 0 ? (
                                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                              ) : (
                                <span className="w-4 text-[11px] font-mono text-slate-500 text-center">
                                  #{idx + 1}
                                </span>
                              )}
                              <span className="font-semibold text-slate-200 print:text-slate-900 truncate">
                                {item.store}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-slate-300 print:text-slate-800">
                            {item.units.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-400 print:text-slate-600">
                            {item.transactions.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-300 print:text-slate-800">
                            ₱{item.avgOrderValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-400 print:text-emerald-700">
                            ₱{item.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-400 print:text-slate-600">
                                <span>{item.revenueShare.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-slate-800 print:bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${item.revenueShare}%` }}
                                  className="bg-indigo-500 print:bg-indigo-600 h-full rounded-full transition-all duration-300"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 print-card rounded-xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-200 print:text-slate-900">
                Top Performing Items
              </h2>
              <div className="space-y-3">
                {topProducts.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No transactions recorded.</p>
                ) : (
                  topProducts.map((prod, idx) => (
                    <div
                      key={prod.sku}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 print-card"
                    >
                      <div className="space-y-0.5 max-w-[180px]">
                        <p className="text-xs font-semibold text-slate-200 print:text-slate-900 truncate">
                          {idx + 1}. {prod.name}
                        </p>
                        <p className="text-[11px] text-slate-500 print:text-slate-600">
                          SKU: {prod.sku} | Qty: {prod.qty}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-emerald-400 print:text-emerald-700">
                        ₱{prod.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Itemized Table with Separated SKU and Style Code Columns */}
        <div className="bg-slate-900/60 border border-slate-800 print-card rounded-xl overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-200">Itemized Sales Log</h2>
              <span className="text-xs font-medium bg-slate-800 text-indigo-400 px-2.5 py-1 rounded-full border border-slate-700">
                {filteredSalesData.length} {filteredSalesData.length === 1 ? "Item" : "Items"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search SKU, name, color..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept} className="bg-slate-900">{dept}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs print-table">
              <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 print:bg-slate-100 print:text-slate-700">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Style Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Color / Size</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                      Loading daily logs...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                      No transactions matching your search/filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((log) => {
                    const currentQty = log.quantity ?? 1;
                    const unitPrice = Number(log.price || 0);
                    const rowTotal = currentQty * unitPrice;
                    const isEditing = editingId === log.id;
                    const isUpdating = updatingId === log.id;

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-slate-400 print:text-slate-600 whitespace-nowrap">
                          {new Date(log.scanned_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        {/* Separate SKU Column */}
                        <td className="px-4 py-3 font-medium text-slate-200 print:text-slate-900 whitespace-nowrap">
                          {log.sku || "-"}
                        </td>
                        {/* Separate Style Code Column */}
                        <td className="px-4 py-3 font-medium text-slate-300 print:text-slate-800 whitespace-nowrap">
                          {log.style_code || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-300 print:text-slate-800">
                          {log.description || log.style_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 print:text-slate-600 whitespace-nowrap">
                          {log.color || "-"} / {log.size || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 print:text-slate-600">{log.category || "-"}</td>
                        <td className="px-4 py-3 text-slate-400 print:text-slate-600">{log.department || "-"}</td>
                        <td className="px-4 py-3 text-slate-400 print:text-slate-600">{log.store || "N/A"}</td>
                        
                        {/* Qty Column */}
                        <td className="px-4 py-3 text-center font-medium text-slate-200 print:text-slate-900">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={1}
                                disabled={isUpdating}
                                value={editQty}
                                onChange={(e) => setEditQty(Math.max(1, Number(e.target.value)))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveQuantity(log.id);
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                className="w-14 bg-slate-950 border border-indigo-500 rounded px-1.5 py-0.5 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-slate-800 print:bg-slate-100 rounded text-slate-200 print:text-slate-800">
                              {currentQty}
                            </span>
                          )}
                        </td>

                        {/* Unit Price */}
                        <td className="px-4 py-3 text-right text-slate-400 print:text-slate-600 whitespace-nowrap">
                          ₱{unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Row Total */}
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400 print:text-emerald-700 whitespace-nowrap">
                          ₱{rowTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center no-print whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => saveQuantity(log.id)}
                                disabled={isUpdating}
                                className="p-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
                                title="Save Qty"
                              >
                                {isUpdating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={isUpdating}
                                className="p-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 disabled:opacity-50 transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditing(log)}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                              title="Edit Quantity"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 no-print">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-slate-200">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{" "}
                <strong className="text-slate-200">{Math.min(currentPage * pageSize, totalItems)}</strong> of{" "}
                <strong className="text-slate-200">{totalItems}</strong> entries
              </span>

              <div className="flex items-center gap-1">
                <span>| Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded text-slate-200 px-2 py-1 focus:outline-none cursor-pointer"
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
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 bg-slate-800 text-slate-200 rounded-lg border border-slate-700 font-medium">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}