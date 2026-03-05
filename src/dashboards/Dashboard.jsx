import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

import JobsDashboard from "./JobsDashboard";
import SalesTrendDashboard from "./SalesTrendDashboard";
import TopSellingProductsDashboard from "./TopSellingProductsDashboard";
import MostUsedServicesDashboard from "./MostUsedServicesDashboard";
import StockDashboard from "./StockDashboard";
import RepairmanPerformanceDashboard from "./RepairmanPerformanceDashboard";
import RecentSalesDashboard from "./RecentSalesDashboard";

// Helper functions
function startOfDayISO(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString(); }
function startOfMonthISO(d = new Date()) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x.toISOString(); }
function daysAgoISO(days) { const x = new Date(); x.setDate(x.getDate() - days); x.setHours(0,0,0,0); return x.toISOString(); }
function money(n) { const v = Number(n); return Number.isFinite(v) ? Number(v).toFixed(2) : "0.00"; }
function safeNum(n) { const v = Number(n); return Number.isFinite(v) ? v : 0; }

export default function Dashboard() {
  const [rangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [monthSalesTotal, setMonthSalesTotal] = useState(0);
  const [rangeSalesTotal, setRangeSalesTotal] = useState(0);
  const [rangeProfitTotal, setRangeProfitTotal] = useState(0);
  const [stockValue, setStockValue] = useState(0);

  const rangeStartISO = useMemo(() => daysAgoISO(rangeDays - 1), [rangeDays]);
  const todayStartISO = useMemo(() => startOfDayISO(), []);
  const monthStartISO = useMemo(() => startOfMonthISO(), []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true); setErr("");
      try {
        const [todayRes, monthRes, rangeRes] = await Promise.all([
          supabase.from("sales").select("total").eq("is_deleted", false).gte("created_at", todayStartISO),
          supabase.from("sales").select("total").eq("is_deleted", false).gte("created_at", monthStartISO),
          supabase.from("sales").select("sale_id,total").eq("is_deleted", false).gte("created_at", rangeStartISO),
        ]);

        if (todayRes.error) throw todayRes.error;
        if (monthRes.error) throw monthRes.error;
        if (rangeRes.error) throw rangeRes.error;

        const todayTotal = (todayRes.data || []).reduce((s,r)=>s+safeNum(r.total),0);
        const monthTotal = (monthRes.data || []).reduce((s,r)=>s+safeNum(r.total),0);
        const rangeTotal = (rangeRes.data || []).reduce((s,r)=>s+safeNum(r.total),0);

        const saleIds = (rangeRes.data || []).map(s=>s.sale_id);
        let profit = 0;
        if (saleIds.length) {
          const { data: items, error: itemErr } = await supabase
            .from("sale_items")
            .select("item_type,unit_price,unit_cost,quantity")
            .eq("is_deleted", false)
            .in("sale_id", saleIds);
          if (itemErr) throw itemErr;
          for (const it of (items || [])) {
            const qty = safeNum(it.quantity), price = safeNum(it.unit_price), cost = safeNum(it.unit_cost);
            profit += it.item_type === "Product" ? (price - cost) * qty : price * qty;
          }
        }

        const { data: products, error: prodErr } = await supabase
          .from("products")
          .select("cost,stock_qty")
          .eq("is_deleted", false).eq("is_active", true);
        if (prodErr) throw prodErr;
        const invValue = (products || []).reduce((sum,p)=>sum + safeNum(p.cost)*safeNum(p.stock_qty), 0);

        if (!alive) return;
        setTodaySalesTotal(todayTotal);
        setMonthSalesTotal(monthTotal);
        setRangeSalesTotal(rangeTotal);
        setRangeProfitTotal(profit);
        setStockValue(invValue);
        setLoading(false);

      } catch(e) {
        if(!alive) return;
        setErr(e?.message || "Failed to load");
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [rangeStartISO, todayStartISO, monthStartISO]);

  if (err) return <div className="p-4 text-red-600">Error: {err}</div>;

  return (
    <div className="p-4 md:p-5 space-y-5">
      {/* ===== TOP 5 STAT CARDS ===== */}
      <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">📊 Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Today Sales" value={`Rs ${money(todaySalesTotal)}`} loading={loading} color="bg-blue-50 border-blue-200" />
        <StatCard title="This Month Sales" value={`Rs ${money(monthSalesTotal)}`} loading={loading} color="bg-indigo-50 border-indigo-200" />
        <StatCard title={`Sales (${rangeDays}d)`} value={`Rs ${money(rangeSalesTotal)}`} loading={loading} color="bg-emerald-50 border-emerald-200" />
        <StatCard title={`Profit (${rangeDays}d)`} value={`Rs ${money(rangeProfitTotal)}`} loading={loading} color="bg-amber-50 border-amber-200" />
        <StatCard title="Stock Value" value={`Rs ${money(stockValue)}`} loading={loading} color="bg-purple-50 border-purple-200" />
      </div>

      {/* ===== SUB-DASHBOARDS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1"><JobsDashboard /></div>
        <div className="lg:col-span-2"><SalesTrendDashboard /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopSellingProductsDashboard />
        <MostUsedServicesDashboard />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StockDashboard />
        <RepairmanPerformanceDashboard />
      </div>

      <div className="mt-4"><RecentSalesDashboard /></div>
    </div>
  );
}

function StatCard({ title, value, loading, color = "bg-white border-gray-200" }) {
  return (
    <div className={`rounded-xl border ${color} p-3 shadow-sm hover:shadow-md transition`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{title}</div>
      <div className="mt-1 text-lg md:text-xl font-bold text-gray-900">{loading ? "…" : value}</div>
    </div>
  );
}