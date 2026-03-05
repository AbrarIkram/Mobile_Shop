import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

function safeNum(n){const v=Number(n);return Number.isFinite(v)?v:0;}

export default function StockDashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const { data, error } = await supabase
          .from("products")
          .select("product_id,name,model,stock_qty,low_stock_limit,is_active")
          .eq("is_deleted", false)
          .order("stock_qty", { ascending: true });
        if (error) throw error;
        if (!alive) return;
        setProducts(data || []);
        setLoading(false);
      } catch(e) {
        if(!alive) return;
        setErr(e?.message || "Failed");
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  function getStatus(p) {
    const stock = safeNum(p.stock_qty), limit = safeNum(p.low_stock_limit);
    if (!p.is_active) return { label: "Inactive", color: "bg-gray-100 text-gray-500 border-gray-200" };
    if (stock === 0) return { label: "Out of Stock", color: "bg-red-50 text-red-800 border-red-300" };
    if (stock <= limit) return { label: "Low Stock", color: "bg-orange-100 text-orange-800 border-orange-300" };
    return { label: "In Stock", color: "bg-green-50 text-green-800 border-green-300" };
  }

  return (
    <div className="p-3 md:p-4 space-y-3">
      <h1 className="text-lg md:text-xl font-semibold text-gray-900">📦 Stock Dashboard</h1>
      {err && <div className="text-red-600 text-xs md:text-sm">{err}</div>}
      
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-4 text-gray-500 text-sm">Loading…</div>
        ) : products.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">No products found.</div>
        ) : (
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-gray-50 text-gray-600 text-[10px] md:text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-left font-semibold">Model</th>
                <th className="px-3 py-2 text-right font-semibold">Stock</th>
                <th className="px-3 py-2 text-right font-semibold">Limit</th>
                <th className="px-3 py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => {
                const status = getStatus(p);
                return (
                  <tr key={p.product_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                    <td className="px-3 py-2 text-gray-600">{p.model || "-"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{p.stock_qty ?? 0}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{p.low_stock_limit ?? 0}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] md:text-xs font-medium border ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}