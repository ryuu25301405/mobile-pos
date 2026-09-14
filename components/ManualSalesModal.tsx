"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { X, PlusCircle, Search, DollarSign, Store, Hash, CheckCircle2, AlertCircle } from "lucide-react";

interface InventoryItem {
  id: string;
  store: string;
  style_code: string;
  sku: string;
  style_name: string;
  color: string;
  size: string;
  category: string;
  department: string;
  price: number;
}

interface ManualSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ManualSalesModal({ isOpen, onClose, onSuccess }: ManualSalesModalProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [quantity, setQuantity] = useState<number>(1);
  const [overridePrice, setOverridePrice] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch active store inventory items for lookup
  useEffect(() => {
    if (isOpen) {
      fetchInventory();
      setSelectedItem(null);
      setQuantity(1);
      setOverridePrice("");
      setSuccessMsg("");
      setErrorMsg("");
    }
  }, [isOpen]);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scanned_logs") // or your inventory table if separate
      .select("id, store, style_code, sku, style_name, color, size, category, department, price")
      .limit(500);

    if (!error && data) {
      // Deduplicate items based on style_code + color + size + store for clean lookup
      const uniqueMap = new Map();
      data.forEach((item: any) => {
        const key = `${item.store}-${item.style_code}-${item.color}-${item.size}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });
      setInventory(Array.from(uniqueMap.values()));
      if (data.length > 0) setSelectedStore(data[0].store);
    }
    setLoading(false);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return inventory.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return inventory.filter(
      (item) =>
        item.style_code.toLowerCase().includes(q) ||
        item.style_name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [inventory, searchQuery]);

  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setSelectedStore(item.store);
    setOverridePrice(item.price ? item.price.toString() : "0");
    setSearchQuery("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      setErrorMsg("Please select an item from the inventory catalog.");
      return;
    }

    const finalPrice = parseFloat(overridePrice);
    const finalQty = parseInt(String(quantity), 10);

    if (isNaN(finalPrice) || finalPrice < 0) {
      setErrorMsg("Please enter a valid price.");
      return;
    }
    if (isNaN(finalQty) || finalQty < 1) {
      setErrorMsg("Quantity must be at least 1.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    const payload = {
      store: selectedStore || selectedItem.store,
      style_code: selectedItem.style_code,
      sku: selectedItem.sku,
      style_name: selectedItem.style_name,
      description: selectedItem.department || "Manual Sale",
      color: selectedItem.color,
      size: selectedItem.size,
      category: selectedItem.category,
      department: selectedItem.department,
      price: finalPrice,
      quantity: finalQty,
      scanned_at: new Date().toISOString(),
      entry_method: "manual", // Audit flag
    };

    const { error } = await supabase.from("scanned_logs").insert([payload]);

    setSubmitting(false);

    if (error) {
      setErrorMsg(`Failed to save manual sale: ${error.message}`);
    } else {
      setSuccessMsg("Manual sale logged successfully!");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-left text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Fallback Encoding
            </span>
            <h2 className="text-lg font-bold text-white mt-1">Manual Sales Entry</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Step 1: Item Search / Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              1. Search Product Catalog
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type style code, name, or color..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs pl-8 pr-3 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Search Dropdown Results */}
            {searchQuery.trim() && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-900 text-xs shadow-lg">
                {filteredItems.length === 0 ? (
                  <div className="p-3 text-slate-500 text-center italic">No items found matching "{searchQuery}"</div>
                ) : (
                  filteredItems.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectItem(item)}
                      className="p-2.5 hover:bg-slate-900 cursor-pointer transition flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-white">{item.style_name} <span className="text-emerald-400 font-mono text-[10px]">({item.style_code})</span></p>
                        <p className="text-[10px] text-slate-400">{item.store} • Color: {item.color} • Size: {item.size}</p>
                      </div>
                      <span className="font-mono font-bold text-emerald-400">₱{item.price}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Item Card Preview */}
          {selectedItem && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-400">Selected Product</p>
                <p className="font-bold text-white mt-0.5">{selectedItem.style_name} <span className="font-mono text-slate-300">[{selectedItem.style_code}]</span></p>
                <p className="text-[10px] text-slate-400">{selectedItem.color} / {selectedItem.size} • {selectedItem.store}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-[10px] text-rose-400 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>
          )}

          {/* Step 2: Transaction Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" /> Unit Price (₱)
              </label>
              <input
                type="number"
                step="0.01"
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3 text-indigo-400" /> Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Store className="w-3 h-3 text-amber-400" /> Store Branch
            </label>
            <input
              type="text"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedItem}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{submitting ? "Encoding..." : "Log Manual Sale"}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}