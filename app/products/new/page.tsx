'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Boxes, ArrowLeft, PlusCircle, CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function CreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Form State matching your products table schema
  const [formData, setFormData] = useState({
    style_code: "",
    style_name: "",
    description: "",
    color: "",
    category: "",
    department: "",
    size: "",
    sku: "",
    price: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      // Validate required fields
      if (!formData.style_code || !formData.style_name || !formData.sku || !formData.price) {
        throw new Error("Please fill in all required fields (Style Code, Style Name, SKU, and Price).");
      }

      const { error } = await supabase.from("products").insert([
        {
          style_code: formData.style_code.trim(),
          style_name: formData.style_name.trim(),
          description: formData.description.trim(),
          color: formData.color.trim() || "-",
          category: formData.category.trim() || "-",
          department: formData.department.trim() || "-",
          size: formData.size.trim() || "-",
          sku: formData.sku.trim(),
          price: parseFloat(formData.price) || 0,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setSuccessMessage("Product successfully created and saved to the database!");
      
      // Reset form
      setFormData({
        style_code: "",
        style_name: "",
        description: "",
        color: "",
        category: "",
        department: "",
        size: "",
        sku: "",
        price: "",
      });

      // Optional: Redirect back to inventory/products after a brief moment
      setTimeout(() => {
        router.push("/inventory");
      }, 1500);

    } catch (err: any) {
      console.error("Error creating product:", err);
      setErrorMessage(err.message || "Failed to create product. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-4xl mx-auto antialiased space-y-6">
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/inventory"
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 p-2 rounded-xl border border-slate-800 transition cursor-pointer flex items-center justify-center"
            title="Back to Inventory"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Catalog Management
            </span>
            <h1 className="text-2xl font-black text-white mt-1">Create New Product</h1>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl flex items-center space-x-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-2xl flex items-center space-x-3 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="text-xs font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* Product Form Card */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Style Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Style Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="style_code"
              required
              placeholder="e.g. 030767641673"
              value={formData.style_code}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
            />
          </div>

          {/* SKU */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              SKU <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="sku"
              required
              placeholder="e.g. 764167"
              value={formData.sku}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
            />
          </div>

          {/* Style Name */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Style Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="style_name"
              required
              placeholder="e.g. 3076 COMBO2 BRF1SO"
              value={formData.style_name}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-medium"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
            <textarea
              name="description"
              rows={2}
              placeholder="Enter product description or specifications..."
              value={formData.description}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Category</label>
            <input
              type="text"
              name="category"
              placeholder="e.g. Underwear / Apparel"
              value={formData.category}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Department</label>
            <input
              type="text"
              name="department"
              placeholder="e.g. Menswear"
              value={formData.department}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Color</label>
            <input
              type="text"
              name="color"
              placeholder="e.g. Black / Grey"
              value={formData.color}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Size</label>
            <input
              type="text"
              name="size"
              placeholder="e.g. Free Size / L / XL"
              value={formData.size}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Price (₱) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-emerald-400">₱</span>
              <input
                type="number"
                step="0.01"
                required
                name="price"
                placeholder="0.00"
                value={formData.price}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <Link
            href="/inventory"
            className="bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-800 cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            <span>Save Product</span>
          </button>
        </div>
      </form>
    </main>
  );
}