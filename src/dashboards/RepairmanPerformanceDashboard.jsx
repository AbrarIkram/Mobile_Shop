import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";

function safeNum(n){const v=Number(n);return Number.isFinite(v)?v:0;}

export default function RepairmanPerformanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const { data: jobs, error } = await supabase
          .from("repair_jobs")
          .select("assigned_repairer_id,status")
          .eq("is_deleted", false)
          .in("status", ["Completed", "In Progress"]);
        if (error) throw error;

        const agg = new Map();
        for (const j of (jobs||[])) {
          if (!j.assigned_repairer_id) continue;
          const eid = Number(j.assigned_repairer_id);
          const cur = agg.get(eid) || { completed:0, inProgress:0 };
          if (j.status === "Completed") cur.completed++;
          else if (j.status === "In Progress") cur.inProgress++;
          agg.set(eid, cur);
        }

        const ids = Array.from(agg.keys());
        if (!ids.length) { setLoading(false); return; }

        const { data: emps, error: eErr } = await supabase
          .from("employees")
          .select("employee_id,full_name")
          .eq("is_deleted", false)
          .in("employee_id", ids);
        if (eErr) throw eErr;

        const byId = new Map((emps||[]).map(e=>[e.employee_id, e.full_name]));
        const result = ids.map(eid => ({
          employee_id: eid,
          name: byId.get(eid) || `Employee #${eid}`,
          ...agg.get(eid)
        }))
        .sort((a,b)=>b.completed+b.inProgress - (a.completed+a.inProgress))
        .slice(0,10);

        if (!alive) return;
        setData(result);
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

  const maxJobs = useMemo(() => Math.max(1, ...data.map(d=>safeNum(d.completed)+safeNum(d.inProgress))), [data]);

  return (
    <div className="p-3 md:p-4 space-y-3">
      <h1 className="text-lg md:text-xl font-semibold text-gray-900">👷 Repairman Performance</h1>
      {err && <div className="text-red-600 text-xs md:text-sm">{err}</div>}
      
      <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : data.length === 0 ? (
          <div className="text-gray-500 text-sm">No job data found.</div>
        ) : (
          <div className="space-y-3">
            {data.map((r) => {
              const total = safeNum(r.completed) + safeNum(r.inProgress);
              const completedPct = (safeNum(r.completed)/maxJobs)*100;
              const progressPct = (safeNum(r.inProgress)/maxJobs)*100;
              return (
                <div key={r.employee_id} className="space-y-1">
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="font-medium text-gray-900 truncate">{r.name}</span>
                    <span className="text-gray-600">{r.completed} done • {r.inProgress} active</span>
                  </div>
                  <div className="flex h-2 md:h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="bg-green-500 transition-all" style={{ width: `${completedPct}%` }} title="Completed" />
                    <div className="bg-blue-400 transition-all" style={{ width: `${progressPct}%` }} title="In Progress" />
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