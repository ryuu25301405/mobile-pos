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
} from "lucide-react";

// Updated interface based on your database schema
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
  store?: string | null; // Matched to 'store'
  scanned_at: string;     // Matched to 'scanned_at'
}

// Initialized outside component body to avoid re-creation on render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DailySalesReportPage() {
  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedStore, setSelectedStore] = useState<string>("ALL");
  const [stores, setStores] = useState<string[]>([]);

  // State Data
  const [salesData, setSalesData] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ----------------------------------------------------
  // 1. Fetch Store List
  // ----------------------------------------------------
  useEffect(() => {
    async function loadStores() {
      const { data, error } = await supabase
        .from("scanned_logs")
        .select("store")
        .not("store", "is", null);

      if (error) {
        console.error("Error loading stores:", error);
        return;
      }

      if (data) {
        const uniqueStores = Array.from(
          new Set(data.map((item: { store: string | null }) => item.store))
        ).filter(Boolean) as string[];
        setStores(uniqueStores);
      }
    }
    loadStores();
  }, []);

  // ----------------------------------------------------
  // 2. Fetch Daily Sales Logs
  // ----------------------------------------------------
  const fetchDailySales = useCallback(async () => {
    setLoading(true);

    // Calculate local timezone boundaries
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

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching daily sales:", error);
    } else {
      setSalesData(data || []);
    }
    setLoading(false);
  }, [selectedDate, selectedStore]);

  // Initial Fetch & Realtime Subscription
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
  // 3. Computed Aggregations
  // ----------------------------------------------------
  const metrics = useMemo(() => {
    const totalUnits = salesData.reduce(
      (acc, curr) => acc + (curr.quantity || 1),
      0
    );
    const totalRevenue = salesData.reduce(
      (acc, curr) => acc + Number(curr.price || 0) * (curr.quantity || 1),
      0
    );
    const totalTransactions = salesData.length;
    const avgOrderValue =
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return {
      totalUnits,
      totalRevenue,
      totalTransactions,
      avgOrderValue,
    };
  }, [salesData]);

  // Group by Top Selling Products
  const topProducts = useMemo(() => {
    const productMap: Record<
      string,
      { sku: string; name: string; qty: number; revenue: number }
    > = {};

    salesData.forEach((item) => {
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
  }, [salesData]);

  // Group Sales by Hour (00:00 - 23:00)
  const hourlyBreakdown = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      revenue: 0,
      count: 0,
    }));

    salesData.forEach((item) => {
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
  }, [salesData]);

  // Export to CSV Functionality
  const exportToCSV = () => {
    if (salesData.length === 0) return;

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

    const rows = salesData.map((s) => [
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
      {/* Header & Controls */}
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

          {/* Manual Refresh Button */}
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
            disabled={salesData.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
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

        {/* Units Sold */}
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

        {/* Total Scans / Items */}
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

        {/* Average Price Per Item */}
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

      {/* Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Distribution Chart */}
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

        {/* Top Performing Items */}
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

      {/* Itemized Transactions Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-200">
            Itemized Sales Log ({salesData.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">SKU / Style</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Color / Size</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading daily logs...
                  </td>
                </tr>
              ) : salesData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No transactions found for the selected date and store filter.
                  </td>
                </tr>
              ) : (
                salesData.map((log) => (
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
      </div>
    </div>
  );
}