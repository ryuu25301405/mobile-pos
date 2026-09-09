'use client';

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { supabase } from "@/lib/supabase";

// Disable server-side rendering for the camera component
const Scanner = dynamicImport(() => import("@/components/Scanner"), {
  ssr: false,
});

export const dynamic = 'force-dynamic';


export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState({ name: "", price: 0, stock: 0 });

  const handleScan = async (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setScanning(false);
    setLoading(true);

    // Query Supabase for matching barcode
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", scannedBarcode)
      .single();

    setLoading(false);

    if (error || !data) {
      alert(`Barcode "${scannedBarcode}" not found in database.`);
      setProduct({ name: "", price: 0, stock: 0 });
    } else {
      setProduct({ name: data.name, price: data.price, stock: data.stock });
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center">Mobile POS System</h1>

      <button
        onClick={() => setScanning(!scanning)}
        className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg shadow"
      >
        {scanning ? "Close Camera" : "📷 Scan Barcode / QR"}
      </button>

      {scanning && <Scanner onScan={handleScan} />}

      {loading && <p className="text-center text-gray-500">Fetching item...</p>}

      <form className="bg-white p-4 rounded-xl shadow space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500">Barcode ID</label>
          <input type="text" value={barcode} readOnly className="w-full p-2 border rounded bg-gray-50" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500">Product Name</label>
          <input type="text" value={product.name} readOnly className="w-full p-2 border rounded bg-gray-50" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500">Price ($)</label>
          <input type="number" value={product.price} readOnly className="w-full p-2 border rounded bg-gray-50" />
        </div>
      </form>
    </main>
  );
}