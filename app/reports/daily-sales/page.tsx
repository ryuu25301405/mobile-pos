"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

  // Core Data & UI States
  const [salesData, setSalesData] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // ----------------------------------------------------
  // 1. Fetch Dynamic Filter Dropdowns (Stores, Departments, Categories)
  // ----------------------------------------------------
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
        const uniqueStores = Array.from(
          new Set(data.map((item) => item.store))
        ).filter(Boolean) as string[];

        const uniqueDepts = Array.from(
          new Set(data.map((item) => item.department))
        ).filter(Boolean) as string[];

        const uniqueCats = Array.from(
          new Set(data.map((item) => item.category))
        ).filter(Boolean) as string[];

        setStores(uniqueStores);
        setDepartments(uniqueDepts);
        setCategories(uniqueCats);
      }
    }
    loadFilterOptions();
  }, []);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedStore, selectedDepartment, selectedCategory, searchQuery, pageSize]);

  // ----------------------------------------------------
  // 2. Fetch Daily Sales Logs from Supabase
  // ----------------------------------------------------
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

    if (selectedStore !== "ALL") {
      query = query.eq("store", selectedStore);
    }
    if (selectedDepartment !== "ALL") {
      query = query.eq("department", selectedDepartment);
    }
    if (selectedCategory !== "ALL") {
      query = query.eq("category", selectedCategory);
    }

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
        () => {
          fetchDailySales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDailySales]);

  // ----------------------------------------------------
  // 3. Client-Side Global Search Filtering
  // ----------------------------------------------------
  const filteredSalesData = useMemo(() => {
    if (!searchQuery.trim()) return salesData;

    const query = searchQuery.toLowerCase();
    return salesData.filter((item) => {
      return (
        item.sku?.toLowerCase().includes(query) ||
        item.style_code?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.style_name?.toLowerCase().includes(query) ||
        item.color?.toLowerCase().includes(query) ||
        item.size?.toLowerCase().includes(query) ||
        item.store?.toLowerCase().includes(query) ||
        item.department?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    });
  }, [salesData, searchQuery]);

  // ----------------------------------------------------
  // 4. Pagination Calculation
  // ----------------------------------------------------
  const totalItems = filteredSalesData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSalesData.slice(start, start + pageSize);
  }, [filteredSalesData, currentPage, pageSize]);

  // ----------------------------------------------------
  // 5. Aggregations (Computed on Filtered Data)
  // ----------------------------------------------------
  const metrics = useMemo(() => {
    const totalUnits = filteredSalesData.reduce(
      (acc, curr) => acc + (curr.quantity || 1),
      0
    );
    const totalRevenue = filteredSalesData.reduce(
      (acc, curr) => acc + Number(curr.price || 0) * (curr.quantity || 1),
      0
    );
    const totalTransactions = filteredSalesData.length;
    const avgOrderValue =
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return { totalUnits, totalRevenue, totalTransactions, avgOrderValue };
  }, [filteredSalesData]);

  const topProducts = useMemo(() => {
    const productMap: Record<
      string,
      { sku: string; name: string; qty: number; revenue: number }
    > = {};

    filteredSalesData.forEach((item) => {
      const key = item.sku || item.style_code || "UNKNOWN";
      const qty = item.quantity || 1;
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

  const hourlyBreakdown = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      revenue: 0,
      count: 0,
    }));

    filteredSalesData.forEach((item) => {
      const date = new Date(item.scanned_at);
      const hourIndex = date.getHours();
      const qty = item.quantity || 1;
      hours[hourIndex].revenue += Number(item.price || 0) * qty;
      hours[hourIndex].count += qty;
    });

    const maxRevenue = Math.max(...hours.map((h) => h.revenue), 1);

    return hours.map((h) => ({
      ...h,
      percentage: Math.min((h.revenue / maxRevenue) * 100, 100),
    }));
  }, [filteredSalesData]);

  // Export to CSV
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
      "Price",
      "Store",
    ];

    const rows = filteredSalesData.map((s) => [
      new Date(s.scanned_at).toLocaleTimeString(),
      s.sku || "",
      s.style_code || "",
      `"${s.description || ""}"`,
      s.color || "",
      s.size || "",
      s.category || "",
      s.department || "",
      s.price || 0,
      s.store || "N/A",
    ]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Daily Sales Report
          </h1>
          <p className="text-sm text-slate-400">
            Real-time daily transaction analytics and product breakdowns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm">
            <CalendarIcon className="w-4 h-4 text-indigo-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-100 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Store Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm">
            <Store className="w-4 h-4 text-indigo-400" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-transparent text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-100">
                All Stores
              </option>
              {stores.map((store) => (
                <option
                  key={store}
                  value={store}
                  className="bg-slate-900 text-slate-100"
                >
                  {store}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDailySales}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`}
            />
          </button>

          {/* CSV Export */}
          <button
            onClick={exportToCSV}
            disabled={filteredSalesData.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Total Revenue
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">
              ₱{metrics.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Units Sold
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {metrics.totalUnits.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Total Scans / Items
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {metrics.totalTransactions.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Avg Item Price
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">
              ₱{metrics.avgOrderValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Hourly & Top Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-200">
            Hourly Sales Volume
          </h2>
          <div className="h-48 flex items-end gap-1.5 pt-6 pb-2 px-2 overflow-x-auto">
            {hourlyBreakdown.map((item) => (
              <div
                key={item.hour}
                className="flex-1 flex flex-col items-center h-full justify-end group min-w-[20px]"
              >
                <div className="relative w-full flex justify-center">
                  <div className="absolute -top-8 hidden group-hover:flex bg-slate-800 text-slate-200 text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10 border border-slate-700">
                    ₱{item.revenue.toLocaleString()} ({item.count} items)
                  </div>
                  <div
                    style={{ height: `${item.percentage}%` }}
                    className={`w-full max-w-[18px] rounded-t transition-all duration-300 ${
                      item.revenue > 0
                        ? "bg-indigo-500 group-hover:bg-indigo-400"
                        : "bg-slate-800/50"
                    }`}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-2 rotate-45 md:rotate-0">
                  {item.hour.split(":")[0]}h
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-200">
            Top Performing Items
          </h2>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                No sales recorded for this date.
              </p>
            ) : (
              topProducts.map((prod, idx) => (
                <div
                  key={prod.sku}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800"
                >
                  <div className="space-y-0.5 max-w-[180px]">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {idx + 1}. {prod.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      SKU: {prod.sku} | Qty: {prod.qty}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-emerald-400">
                    ₱{prod.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Itemized Table Container */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden space-y-4">
        
        {/* Table Filter Control Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-200">
              Itemized Sales Log
            </h2>
            <span className="text-xs font-medium bg-slate-800 text-indigo-400 px-2.5 py-1 rounded-full border border-slate-700">
              {filteredSalesData.length} {filteredSalesData.length === 1 ? "Item" : "Items"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Global Search Input */}
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

            {/* Department Filter Dropdown */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">
                  All Departments
                </option>
                {departments.map((dept) => (
                  <option key={dept} value={dept} className="bg-slate-900">
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter Dropdown */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">
                  All Categories
                </option>
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">SKU / Style</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Color / Size</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading daily logs...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No transactions matching your search/filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(log.scanned_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {log.sku || log.style_code || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {log.description || log.style_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {log.color || "-"} / {log.size || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {log.category || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {log.department || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {log.store || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                      ₱{Number(log.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="text-slate-200">
                {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-200">
                {Math.min(currentPage * pageSize, totalItems)}
              </strong>{" "}
              of <strong className="text-slate-200">{totalItems}</strong> entries
            </span>

            {/* Rows Per Page Dropdown */}
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
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-slate-800 text-slate-200 rounded-lg border border-slate-700 font-medium">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}