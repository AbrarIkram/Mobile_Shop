import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

function startOfDayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function startOfMonthISO(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function daysAgoISO(days) {
  const x = new Date();
  x.setDate(x.getDate() - days);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : "0.00";
}
function safeNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function dateKeyFromISO(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [rangeDays, setRangeDays] = useState(30);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Base metrics
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [monthSalesTotal, setMonthSalesTotal] = useState(0);
  const [rangeSalesTotal, setRangeSalesTotal] = useState(0);
  const [rangeProfitTotal, setRangeProfitTotal] = useState(0);

  const [jobsPending, setJobsPending] = useState(0);
  const [jobsInProgress, setJobsInProgress] = useState(0);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [jobsToday, setJobsToday] = useState(0);

  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockRows, setLowStockRows] = useState([]);

  const [recentSales, setRecentSales] = useState([]);

  // Trend
  const [trend, setTrend] = useState([]); // [{date:'YYYY-MM-DD', total:number}]

  // Extra blocks
  const [topProducts, setTopProducts] = useState([]); // [{product_id,name,model,qty,total}]
  const [topServices, setTopServices] = useState([]); // [{service_id,name,qty,total}]
  const [repairmanPerf, setRepairmanPerf] = useState([]); // [{employee_id,full_name,completed_count}]
  const [stockValue, setStockValue] = useState(0); // sum(cost * qty)

  const rangeStartISO = useMemo(() => daysAgoISO(rangeDays - 1), [rangeDays]);
  const todayStartISO = useMemo(() => startOfDayISO(new Date()), []);
  const monthStartISO = useMemo(() => startOfMonthISO(new Date()), []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        // ---- A) SALES (today/month/range) + recent ----
        const [todayRes, monthRes, rangeRes, recentRes] = await Promise.all([
          supabase
            .from("sales")
            .select("sale_id,total,created_at")
            .eq("is_deleted", false)
            .gte("created_at", todayStartISO),

          supabase
            .from("sales")
            .select("sale_id,total,created_at")
            .eq("is_deleted", false)
            .gte("created_at", monthStartISO),

          supabase
            .from("sales")
            .select("sale_id,total,created_at,customer_id,job_id")
            .eq("is_deleted", false)
            .gte("created_at", rangeStartISO),

          supabase
            .from("sales")
            .select(
              `
              sale_id,total,discount,subtotal,payment_method,created_at,job_id,
              customers:customers ( full_name, mobile_number )
            `,
            )
            .eq("is_deleted", false)
            .order("sale_id", { ascending: false })
            .limit(10),
        ]);

        if (todayRes.error) throw todayRes.error;
        if (monthRes.error) throw monthRes.error;
        if (rangeRes.error) throw rangeRes.error;
        if (recentRes.error) throw recentRes.error;

        const todayTotal = (todayRes.data || []).reduce(
          (s, r) => s + safeNum(r.total),
          0,
        );
        const monthTotal = (monthRes.data || []).reduce(
          (s, r) => s + safeNum(r.total),
          0,
        );
        const rangeSales = rangeRes.data || [];
        const rangeTotal = rangeSales.reduce((s, r) => s + safeNum(r.total), 0);

        // ---- B) TREND (from range sales) ----
        const trendMap = new Map();
        for (const s of rangeSales) {
          const key = dateKeyFromISO(s.created_at);
          trendMap.set(key, (trendMap.get(key) || 0) + safeNum(s.total));
        }
        const trendArr = [];
        for (let i = rangeDays - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate(),
          ).padStart(2, "0")}`;
          trendArr.push({ date: key, total: trendMap.get(key) || 0 });
        }

        // ---- C) PROFIT (range) + TOP PRODUCTS/SERVICES (range) ----
        const saleIds = rangeSales.map((s) => s.sale_id);

        async function fetchSaleItemsByChunks(ids) {
          const all = [];
          const chunkSize = 200;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { data, error } = await supabase
              .from("sale_items")
              .select(
                `
                sale_id,item_type,product_id,service_id,quantity,unit_price,unit_cost
              `,
              )
              .eq("is_deleted", false)
              .in("sale_id", chunk);
            if (error) throw error;
            all.push(...(data || []));
          }
          return all;
        }

        let profit = 0;
        const productAgg = new Map(); // product_id -> {qty,total}
        const serviceAgg = new Map(); // service_id -> {qty,total}

        if (saleIds.length > 0) {
          const items = await fetchSaleItemsByChunks(saleIds);

          for (const it of items) {
            const qty = safeNum(it.quantity);
            const unitPrice = safeNum(it.unit_price);
            const lineTotal = unitPrice * qty;

            if (it.item_type === "Product") {
              const unitCost = safeNum(it.unit_cost);
              profit += (unitPrice - unitCost) * qty;

              const pid = it.product_id;
              if (pid != null) {
                const cur = productAgg.get(pid) || { qty: 0, total: 0 };
                cur.qty += qty;
                cur.total += lineTotal;
                productAgg.set(pid, cur);
              }
            } else {
              // Service
              profit += unitPrice * qty;

              const sid = it.service_id;
              if (sid != null) {
                const cur = serviceAgg.get(sid) || { qty: 0, total: 0 };
                cur.qty += qty;
                cur.total += lineTotal;
                serviceAgg.set(sid, cur);
              }
            }
          }
        }

        // Fetch product/service names for top lists
        const topProductIds = Array.from(productAgg.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 8)
          .map(([id]) => id);

        const topServiceIds = Array.from(serviceAgg.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 8)
          .map(([id]) => id);

        async function fetchByIds(table, ids, cols) {
          if (!ids.length) return [];
          const out = [];
          const chunkSize = 200;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { data, error } = await supabase
              .from(table)
              .select(cols)
              .eq("is_deleted", false)
              .in(table === "products" ? "product_id" : "service_id", chunk);
            if (error) throw error;
            out.push(...(data || []));
          }
          return out;
        }

        const [prodRows, servRows] = await Promise.all([
          fetchByIds("products", topProductIds, "product_id,name,model"),
          fetchByIds("services", topServiceIds, "service_id,name"),
        ]);

        const prodById = new Map(
          (prodRows || []).map((p) => [p.product_id, p]),
        );
        const servById = new Map(
          (servRows || []).map((s) => [s.service_id, s]),
        );

        const topProductsArr = topProductIds.map((pid) => {
          const meta = prodById.get(pid) || {};
          const agg = productAgg.get(pid) || { qty: 0, total: 0 };
          return {
            product_id: pid,
            name: meta.name || `#${pid}`,
            model: meta.model || "",
            qty: agg.qty,
            total: agg.total,
          };
        });

        const topServicesArr = topServiceIds.map((sid) => {
          const meta = servById.get(sid) || {};
          const agg = serviceAgg.get(sid) || { qty: 0, total: 0 };
          return {
            service_id: sid,
            name: meta.name || `#${sid}`,
            qty: agg.qty,
            total: agg.total,
          };
        });

        // ---- D) JOB counts + repairman performance ----
        const [jobsAllRes, jobsTodayRes] = await Promise.all([
          supabase
            .from("repair_jobs")
            .select("job_id,status,assigned_repairer_id")
            .eq("is_deleted", false),

          supabase
            .from("repair_jobs")
            .select("job_id")
            .eq("is_deleted", false)
            .gte("created_at", todayStartISO),
        ]);

        if (jobsAllRes.error) throw jobsAllRes.error;
        if (jobsTodayRes.error) throw jobsTodayRes.error;

        const jobsAll = jobsAllRes.data || [];
        const pending = jobsAll.filter((j) => j.status === "Pending").length;
        const inprog = jobsAll.filter((j) => j.status === "In Progress").length;
        const done = jobsAll.filter((j) => j.status === "Completed").length;

        // repairman perf: count completed jobs per assigned_repairer_id
        const perfMap = new Map(); // employee_id -> count
        for (const j of jobsAll) {
          if (j.status === "Completed" && j.assigned_repairer_id != null) {
            const eid = Number(j.assigned_repairer_id);
            perfMap.set(eid, (perfMap.get(eid) || 0) + 1);
          }
        }

        const perfIds = Array.from(perfMap.keys());
        let repairmen = [];
        if (perfIds.length) {
          // get names
          const { data, error } = await supabase
            .from("employees")
            .select("employee_id,full_name,role")
            .eq("is_deleted", false)
            .in("employee_id", perfIds);

          if (error) throw error;
          repairmen = data || [];
        }

        const nameById = new Map(
          (repairmen || []).map((e) => [e.employee_id, e.full_name]),
        );

        const perfArr = perfIds
          .map((id) => ({
            employee_id: id,
            full_name: nameById.get(id) || `Employee #${id}`,
            completed_count: perfMap.get(id) || 0,
          }))
          .sort((a, b) => b.completed_count - a.completed_count)
          .slice(0, 8);

        // ---- E) STOCK: low stock + stock value ----
        const { data: products, error: prodErr } = await supabase
          .from("products")
          .select(
            "product_id,name,model,stock_qty,low_stock_limit,is_active,cost",
          )
          .eq("is_deleted", false)
          .eq("is_active", true)
          .order("stock_qty", { ascending: true })
          .limit(1000);

        if (prodErr) throw prodErr;

        const low = (products || []).filter(
          (p) => safeNum(p.stock_qty) <= safeNum(p.low_stock_limit),
        );

        const invValue = (products || []).reduce((sum, p) => {
          return sum + safeNum(p.cost) * safeNum(p.stock_qty);
        }, 0);

        if (!alive) return;

        // set state
        setTodaySalesTotal(todayTotal);
        setMonthSalesTotal(monthTotal);
        setRangeSalesTotal(rangeTotal);
        setRangeProfitTotal(profit);

        setJobsPending(pending);
        setJobsInProgress(inprog);
        setJobsCompleted(done);
        setJobsToday((jobsTodayRes.data || []).length);

        setLowStockCount(low.length);
        setLowStockRows(low.slice(0, 12));

        setRecentSales(recentRes.data || []);
        setTrend(trendArr);

        setTopProducts(topProductsArr);
        setTopServices(topServicesArr);
        setRepairmanPerf(perfArr);
        setStockValue(invValue);

        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load dashboard");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [rangeDays, rangeStartISO, todayStartISO, monthStartISO]);

  const trendMax = useMemo(() => {
    return trend.reduce((m, x) => Math.max(m, safeNum(x.total)), 0) || 1;
  }, [trend]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Sales, profit, jobs, stock, and performance overview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">Range</div>
          <select
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="Today Sales"
          value={`Rs ${money(todaySalesTotal)}`}
          loading={loading}
        />
        <StatCard
          title="This Month Sales"
          value={`Rs ${money(monthSalesTotal)}`}
          loading={loading}
        />
        <StatCard
          title={`Sales (${rangeDays}d)`}
          value={`Rs ${money(rangeSalesTotal)}`}
          loading={loading}
        />
        <StatCard
          title={`Profit (${rangeDays}d)`}
          value={`Rs ${money(rangeProfitTotal)}`}
          loading={loading}
        />
        <StatCard
          title="Stock Value"
          value={`Rs ${money(stockValue)}`}
          loading={loading}
        />
      </div>

      {/* Jobs + Trend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-gray-900">Jobs</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniStat label="Pending" value={jobsPending} loading={loading} />
            <MiniStat
              label="In Progress"
              value={jobsInProgress}
              loading={loading}
            />
            <MiniStat
              label="Completed"
              value={jobsCompleted}
              loading={loading}
            />
            <MiniStat
              label="Today Created"
              value={jobsToday}
              loading={loading}
            />
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              Sales Trend
            </div>
            <div className="text-xs text-gray-500">{rangeDays} days</div>
          </div>

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading trend...</div>
          ) : (
            <div className="mt-4 flex items-end gap-1 h-28">
              {trend.map((t) => (
                <div key={t.date} className="flex-1 min-w-[2px]">
                  <div
                    title={`${t.date} • Rs ${money(t.total)}`}
                    className="w-full rounded-t bg-gray-900/80"
                    style={{
                      height: `${Math.max(2, (safeNum(t.total) / trendMax) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
            <span>{trend[0]?.date || "-"}</span>
            <span>{trend[trend.length - 1]?.date || "-"}</span>
          </div>
        </div>
      </div>

      {/* Top products + Top services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              Top Selling Products ({rangeDays}d)
            </div>
            <div className="text-xs text-gray-500">
              {loading ? "…" : `${topProducts.length} items`}
            </div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-gray-600">
              Loading products...
            </div>
          ) : topProducts.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">No product sales.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-600 bg-gray-50">
                  <tr>
                    <Th>Product</Th>
                    <Th>Model</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topProducts.map((p) => (
                    <tr key={p.product_id} className="hover:bg-gray-50">
                      <Td>
                        <div className="font-medium text-gray-900">
                          {p.name}
                        </div>
                      </Td>
                      <Td className="text-gray-600">{p.model || "-"}</Td>
                      <Td className="text-right font-semibold text-gray-900">
                        {p.qty}
                      </Td>
                      <Td className="text-right font-semibold text-gray-900">
                        Rs {money(p.total)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              Most Used Services ({rangeDays}d)
            </div>
            <div className="text-xs text-gray-500">
              {loading ? "…" : `${topServices.length} items`}
            </div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-gray-600">
              Loading services...
            </div>
          ) : topServices.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">No service sales.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-600 bg-gray-50">
                  <tr>
                    <Th>Service</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topServices.map((s) => (
                    <tr key={s.service_id} className="hover:bg-gray-50">
                      <Td>
                        <div className="font-medium text-gray-900">
                          {s.name}
                        </div>
                      </Td>
                      <Td className="text-right font-semibold text-gray-900">
                        {s.qty}
                      </Td>
                      <Td className="text-right font-semibold text-gray-900">
                        Rs {money(s.total)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Stock + Repairman performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Low Stock</div>
            <div className="text-xs text-gray-500">
              {loading ? "…" : `${lowStockCount} items`}
            </div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-gray-600">Loading stock...</div>
          ) : lowStockRows.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">
              No low stock items.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-600 bg-gray-50">
                  <tr>
                    <Th>Product</Th>
                    <Th>Model</Th>
                    <Th className="text-right">Stock</Th>
                    <Th className="text-right">Limit</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lowStockRows.map((p) => (
                    <tr key={p.product_id} className="hover:bg-gray-50">
                      <Td>
                        <div className="font-medium text-gray-900">
                          {p.name}
                        </div>
                      </Td>
                      <Td className="text-gray-600">{p.model || "-"}</Td>
                      <Td className="text-right font-semibold text-gray-900">
                        {p.stock_qty ?? 0}
                      </Td>
                      <Td className="text-right text-gray-600">
                        {p.low_stock_limit ?? 0}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              Repairman Performance (Completed)
            </div>
            <div className="text-xs text-gray-500">
              {loading ? "…" : `${repairmanPerf.length} repairmen`}
            </div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-gray-600">
              Loading performance...
            </div>
          ) : repairmanPerf.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">
              No completed jobs found.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-600 bg-gray-50">
                  <tr>
                    <Th>Repairman</Th>
                    <Th className="text-right">Completed Jobs</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {repairmanPerf.map((r) => (
                    <tr key={r.employee_id} className="hover:bg-gray-50">
                      <Td>
                        <div className="font-medium text-gray-900">
                          {r.full_name}
                        </div>
                      </Td>
                      <Td className="text-right font-semibold text-gray-900">
                        {r.completed_count}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="text-sm font-semibold text-gray-900">Recent Sales</div>

        {loading ? (
          <div className="mt-3 text-sm text-gray-600">Loading sales...</div>
        ) : recentSales.length === 0 ? (
          <div className="mt-3 text-sm text-gray-600">No sales found.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {recentSales.map((s) => (
              <div
                key={s.sale_id}
                className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {s.customers?.full_name || "Walk-in"}{" "}
                      {s.customers?.mobile_number
                        ? `(${s.customers.mobile_number})`
                        : ""}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(s.created_at).toLocaleString()} •{" "}
                      {s.payment_method || "-"}
                      {s.job_id ? ` • Job #${s.job_id}` : ""}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      Rs {money(s.total)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Disc {money(s.discount)} • Sub {money(s.subtotal)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, loading }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900">
        {loading ? "…" : value}
      </div>
    </div>
  );
}

function MiniStat({ label, value, loading }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">
        {loading ? "…" : value}
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
