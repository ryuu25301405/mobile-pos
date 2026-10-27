'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const STORES = [
  "Metro Gaisano Ayala Cebu",
  "Metro Gaisano Colon",
  "Metro Gaisano Mandaue",
  "Metro Gaisano Market",
  "Natasha",
  "RML",
  "Landmark Makati",
  "Landmark Nuvali",
  "Landmark Trinoma",
];

interface InventoryItem {
  id: string;
  store: string;
  style_code: string;
  sku: string;
  initial_stock: number;
  current_stock: number;
  safety_stock: number;
  pull_out: number;
  total_sold: number; // Correct column mapping matching Supabase
  last_replenished_at: string;
  products?: {
    style_name?: string;
    description?: string;
    color?: string;
    size?: string;
    price?: number;
  };
}

export default function InventoryPage() {
  const [selectedStore, setSelectedStore] = useState<string>(STORES[1]); // Default to Metro Gaisano Colon
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "low" | "out">("all");

  useEffect(() => {
    fetchInventory();
  }, [selectedStore]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("store_inventory")
        .select("*")
        .eq("store", selectedStore);

      const { data, error } = await query;

      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on search and stock status
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = 
      item.style_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === "low") {
      return matchesSearch && item.current_stock <= (item.safety_stock || 5) && item.current_stock > 0;
    }
    if (filterType === "out") {
      return matchesSearch && item.current_stock <= 0;
    }
    return matchesSearch;
  });

  // Calculate top summary metrics
  const totalDeliveredSum = inventory.reduce((acc, curr) => acc + (Number(curr.initial_stock) || 0), 0);
  const totalSoldSum = inventory.reduce((acc, curr) => acc + (Number(curr.total_sold) || 0), 0);
  const totalPullOutSum = inventory.reduce((acc, curr) => acc + (Number(curr.pull_out) || 0), 0);
  const totalAvailableStock = inventory.reduce((acc, curr) => acc + (Number(curr.current_stock) || 0), 0);
  const lowStockCount = inventory.filter((item) => item.current_stock <= (item.safety_stock || 5) && item.current_stock > 0).length;
  const outOfStockCount = inventory.filter((item) => item.current_stock <= 0).length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 antialiased">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Live Dashboard
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Store Inventory Monitoring
            </h1>
            <p className="text-xs text-slate-400">Real-time multi-store tracking across sales, deliveries, audits, and pull-outs.</p>
          </div>

          <div className="w-full sm:w-72">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Select Store Location
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-emerald-400 font-bold rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer shadow-lg"
            >
              {STORES.map((store) => (
                <option key={store} value={store} className="text-white font-normal">
                  {store}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Delivered</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-white mt-1 block">{totalDeliveredSum}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Sold</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1 block">{totalSoldSum}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Pulled Out</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-1 block">{totalPullOutSum}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Available Stock</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-blue-400 mt-1 block">{totalAvailableStock}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Low Stock Items</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-1 block">{lowStockCount}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Out of Stock</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-red-400 mt-1 block">{outOfStockCount}</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="w-full sm:w-96">
            <input
              type="text"
              placeholder="Search style code, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setFilterType("all")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition ${
                filterType === 'all' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setFilterType("low")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition ${
                filterType === 'low' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setFilterType("out")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition ${
                filterType === 'out' ? 'bg-rose-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="p-4 font-extrabold">Store Location</th>
                  <th className="p-4 font-extrabold">Style Code & SKU</th>
                  <th className="p-4 font-extrabold">Status</th>
                  <th className="p-4 font-extrabold text-right">Delivered / In</th>
                  <th className="p-4 font-extrabold text-right">Total Sold</th>
                  <th className="p-4 font-extrabold text-right">Pulled Out</th>
                  <th className="p-4 font-extrabold text-right">Available Stock</th>
                  <th className="p-4 font-extrabold text-right">Safety Level</th>
                  <th className="p-4 font-extrabold text-right">Last Replenished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 animate-pulse">
                      Loading inventory records...
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      No inventory records found for this store.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const isOut = item.current_stock <= 0;
                    const isLow = item.current_stock <= (item.safety_stock || 5) && !isOut;

                    return (
                      <tr key={item.id} className="hover:bg-slate-850/50 transition">
                        <td className="p-4 font-sans text-slate-300 font-semibold">{item.store}</td>
                        <td className="p-4">
                          <span className="text-emerald-400 font-bold block">{item.style_code}</span>
                          <span className="text-slate-400 text-[11px]">{item.sku || "-"}</span>
                        </td>
                        <td className="p-4 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isOut ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            isLow ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-200">{item.initial_stock || 0}</td>
                        {/* Correctly reading total_sold from database */}
                        <td className="p-4 text-right font-bold text-emerald-400">{item.total_sold || 0}</td>
                        <td className="p-4 text-right font-bold text-rose-400">{item.pull_out || 0}</td>
                        <td className="p-4 text-right font-extrabold text-blue-400">{item.current_stock || 0}</td>
                        <td className="p-4 text-right text-slate-400">{item.safety_stock || 5}</td>
                        <td className="p-4 text-right text-slate-400">
                          {item.last_replenished_at ? new Date(item.last_replenished_at).toLocaleDateString() : "-"}
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
    </main>
  );
}