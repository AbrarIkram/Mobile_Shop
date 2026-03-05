import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

function daysAgoISO(days){const x=new Date();x.setDate(x.getDate()-days);x.setHours(0,0,0,0);return x.toISOString();}
function money(n){const v=Number(n);return Number.isFinite(v)?v.toFixed(2):"0.00";}
function safeNum(n){const v=Number(n);return Number.isFinite(v)?v:0;}

export default function MostUsedServicesDashboard() {
  const [rangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
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
          .select("service_id,quantity,unit_price")
          .eq("is_deleted", false).eq("item_type","Service").in("sale_id", saleIds);
        if (iErr) throw iErr;

        const agg = new Map();
        for (const it of (items||[])) {
          if (!it.service_id) continue;
          const cur = agg.get(it.service_id) || { qty:0, total:0 };
          const qty = safeNum(it.quantity), price = safeNum(it.unit_price);
          cur.qty += qty; cur.total += price*qty;
          agg.set(it.service_id, cur);
        }

        const topIds = Array.from(agg.entries()).sort((a,b)=>b[1].total-a[1].total).slice(0,10).map(([id])=>id);
        if (!topIds.length) { setLoading(false); return; }

        const { data: details, error: dErr } = await supabase
          .from("services").select("service_id,name").eq("is_deleted", false).in("service_id", topIds);
        if (dErr) throw dErr;
        const byId = new Map((details||[]).map(s=>[s.service_id, s]));

        const result = topIds.map(sid => {
          const meta = byId.get(sid) || {};
          const stats = agg.get(sid) || { qty:0, total:0 };
          return { service_id: sid, name: meta.name||`#${sid}`, ...stats };
        });

        if (!alive) return;
        setServices(result);
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

  const maxTotal = useMemo(() => Math.max(1, ...services.map(s=>safeNum(s.total))), [services]);

  return (
    <div className="p-3 md:p-4 space-y-3">
      <h1 className="text-lg md:text-xl font-semibold text-gray-900">⚙️ Most Used Services ({rangeDays}d)</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      
      <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : services.length === 0 ? (
          <div className="text-gray-500 text-sm">No service sales.</div>
        ) : (
          <div className="space-y-3">
            {services.map((s) => {
              const pct = (safeNum(s.total) / maxTotal) * 100;
              return (
                <div key={s.service_id} className="flex items-center gap-2 md:gap-3">
                  {/* Donut-style ring */}
                  <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
                      <circle 
                        cx="18" cy="18" r="15.915" fill="none" stroke="#8b5cf6" strokeWidth="3"
                        strokeDasharray={`${pct} 100`} strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] md:text-[10px] font-bold text-gray-700">
                      {Math.round(pct)}%
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate text-sm md:text-base">{s.name}</div>
                    <div className="text-xs md:text-sm text-gray-500">Qty: {s.qty} • Rs {money(s.total)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}