import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

function daysAgoISO(days){const x=new Date();x.setDate(x.getDate()-days);x.setHours(0,0,0,0);return x.toISOString();}
function money(n){const v=Number(n);return Number.isFinite(v)?v.toFixed(2):"0.00";}

export default function RecentSalesDashboard() {
  const [rangeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const rangeStartISO = useMemo(() => daysAgoISO(rangeDays-1), [rangeDays]);
  const totalPages = useMemo(() => Math.ceil(sales.length / perPage), [sales]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const { data, error } = await supabase
          .from("sales")
          .select(`
            sale_id,total,discount,subtotal,payment_method,created_at,job_id,
            customers:customers(full_name,mobile_number)
          `)
          .eq("is_deleted", false)
          .gte("created_at", rangeStartISO)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!alive) return;
        setSales(data || []);
        setLoading(false);
      } catch(e) {
        if(!alive) return;
        setErr(e?.message || "Failed");
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [rangeStartISO]);

  const paginated = useMemo(() => {
    const start = (page-1)*perPage;
    return sales.slice(start, start+perPage);
  }, [sales, page]);

  if (err) return <div className="p-4 text-red-600 text-sm">Error: {err}</div>;

  return (
    <div className="p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-semibold text-gray-900">🧾 Recent Sales ({rangeDays}d)</h1>
        <div className="text-xs md:text-sm text-gray-500">{sales.length} total</div>
      </div>
      
      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-3 md:p-4 text-gray-500 text-sm">Loading…</div>
        ) : paginated.length === 0 ? (
          <div className="p-3 md:p-4 text-gray-500 text-sm">No sales in last {rangeDays} days.</div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {paginated.map((s) => (
                <div key={s.sale_id} className="p-3 md:p-4 hover:bg-gray-50 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate text-sm md:text-base">
                      {s.customers?.full_name || "Walk-in"}
                      {s.customers?.mobile_number && <span className="text-gray-500 text-xs md:text-sm ml-1">({s.customers.mobile_number})</span>}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500 truncate">
                      {new Date(s.created_at).toLocaleString()} • {s.payment_method}
                      {s.job_id && <span> • Job #{s.job_id}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 text-sm md:text-base">Rs {money(s.total)}</div>
                    <div className="text-xs md:text-sm text-gray-500">Disc: {money(s.discount)}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 md:px-4 py-2 border-t border-gray-200 text-xs md:text-sm">
                <button 
                  className="px-2 py-1 rounded border disabled:opacity-50"
                  disabled={page===1}
                  onClick={()=>setPage(p=>Math.max(1,p-1))}
                >
                  ← Prev
                </button>
                <div className="text-gray-600">Page {page} of {totalPages}</div>
                <button 
                  className="px-2 py-1 rounded border disabled:opacity-50"
                  disabled={page===totalPages}
                  onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}