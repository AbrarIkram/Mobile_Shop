import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

function daysAgoISO(days) { const x = new Date(); x.setDate(x.getDate()-days); x.setHours(0,0,0,0); return x.toISOString(); }
function dateKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function money(n) { const v = Number(n); return Number.isFinite(v) ? v.toFixed(2) : "0.00"; }
function safeNum(n) { const v = Number(n); return Number.isFinite(v) ? v : 0; }

export default function SalesTrendDashboard() {
  const [rangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState([]);
  const [err, setErr] = useState("");

  const rangeStartISO = useMemo(() => daysAgoISO(rangeDays-1), [rangeDays]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const { data, error } = await supabase
          .from("sales").select("total,created_at")
          .eq("is_deleted", false).gte("created_at", rangeStartISO);
        if (error) throw error;

        const map = new Map();
        for (const s of (data||[])) {
          const k = dateKey(s.created_at);
          map.set(k, (map.get(k)||0) + safeNum(s.total));
        }

        const arr = [];
        for (let i=rangeDays-1; i>=0; i--) {
          const d = new Date(); d.setDate(d.getDate()-i);
          const k = dateKey(d.toISOString());
          arr.push({ date: k, total: map.get(k)||0 });
        }
        if (!alive) return;
        setTrend(arr);
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

  const maxVal = useMemo(() => Math.max(1, ...trend.map(t=>safeNum(t.total))), [trend]);

  return (
    <div className="p-3 md:p-4 space-y-3">
      <h1 className="text-lg md:text-xl font-semibold text-gray-900">📊 Sales Trend ({rangeDays}d)</h1>
      {err && <div className="text-red-600 text-xs md:text-sm">{err}</div>}
      
      <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4">
        {loading ? (
          <div className="h-32 md:h-40 flex items-center justify-center text-gray-500 text-sm">Loading chart…</div>
        ) : (
          <>
            {/* Bar Chart */}
            <div className="flex items-end gap-0.5 h-32 md:h-40">
              {trend.map((t,i) => {
                const h = (safeNum(t.total)/maxVal)*100;
                return (
                  <div key={t.date} className="flex-1 min-w-[2px] md:min-w-[3px] group relative">
                    <div 
                      className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-indigo-300 transition-all hover:from-indigo-600"
                      style={{ height: `${Math.max(2,h)}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[9px] md:text-xs rounded px-1 py-0.5 whitespace-nowrap z-10">
                      {t.date}<br/>Rs {money(t.total)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 md:mt-2 flex justify-between text-[9px] md:text-[10px] text-gray-500">
              <span>{trend[0]?.date}</span>
              <span>{trend[trend.length-1]?.date}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}