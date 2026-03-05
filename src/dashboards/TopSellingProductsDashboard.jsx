import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

function daysAgoISO(days) { const x=new Date(); x.setDate(x.getDate()-days); x.setHours(0,0,0,0); return x.toISOString(); }
function money(n){const v=Number(n);return Number.isFinite(v)?v.toFixed(2):"0.00";}
function safeNum(n){const v=Number(n);return Number.isFinite(v)?v:0;}

export default function TopSellingProductsDashboard() {
  const [rangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [err, setErr] = useState("");
  const rangeStartISO = useMemo(() => daysAgoISO(rangeDays-1), [rangeDays]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const { data: sales, error: sErr } = await supabase
          .from("sales").select("sale_id").eq("is_deleted", false).gte("created_at", rangeStartISO);
        if (sErr) throw sErr;
        const saleIds = (sales||[]).map(s=>s.sale_id);
        if (!saleIds.length) { setLoading(false); return; }

        const { data: items, error: iErr } = await supabase
          .from("sale_items")
          .select("product_id,quantity,unit_price")
          .eq("is_deleted", false).eq("item_type","Product").in("sale_id", saleIds);
        if (iErr) throw iErr;

        const agg = new Map();
        for (const it of (items||[])) {
          if (!it.product_id) continue;
          const cur = agg.get(it.product_id) || { qty:0, total:0 };
          const qty = safeNum(it.quantity), price = safeNum(it.unit_price);
          cur.qty += qty; cur.total += price*qty;
          agg.set(it.product_id, cur);
        }

        const topIds = Array.from(agg.entries()).sort((a,b)=>b[1].total-a[1].total).slice(0,10).map(([id])=>id);
        if (!topIds.length) { setLoading(false); return; }

        const { data: details, error: dErr } = await supabase
          .from("products").select("product_id,name,model").eq("is_deleted", false).in("product_id", topIds);
        if (dErr) throw dErr;
        const byId = new Map((details||[]).map(p=>[p.product_id, p]));

        const result = topIds.map(pid => {
          const meta = byId.get(pid) || {};
          const stats = agg.get(pid) || { qty:0, total:0 };
          return { product_id: pid, name: meta.name||`#${pid}`, model: meta.model||"", ...stats };
        });

        if (!alive) return;
        setProducts(result);
        setLoading(false);
      } catch(e) {
        if(!alive) return;
        setErr(e?.message || "Failed");
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [rangeStartISO, rangeDays]);

  return (
    <div className="p-3 md:p-4 space-y-3">
      <h1 className="text-lg md:text-xl font-semibold text-gray-900">🛍️ Top Selling Products ({rangeDays}d)</h1>
      {err && <div className="text-red-600 text-xs md:text-sm">{err}</div>}

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-4 text-gray-500 text-sm">Loading…</div>
        ) : products.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">No product sales in this period.</div>
        ) : (
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-gray-50 text-gray-600 text-[10px] md:text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-left font-semibold">Model</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-center font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p, idx) => (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                  <td className="px-3 py-2 text-gray-600">{p.model || "-"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{p.qty}</td>
                  <td className="px-3 py-2 text-right font-semibold">Rs {money(p.total)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center">
                      <div className="w-12 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${Math.min(100, (idx+1)*10)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}