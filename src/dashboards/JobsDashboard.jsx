import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function startOfDayISO(d = new Date()) { 
  const x = new Date(d); 
  x.setHours(0,0,0,0); 
  return x.toISOString(); 
}
function safeNum(n) { 
  const v = Number(n); 
  return Number.isFinite(v) ? v : 0; 
}

export default function JobsDashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [jobs, setJobs] = useState({ pending:0, inProgress:0, completed:0, today:0 });

  const todayStartISO = useMemo(() => startOfDayISO(), []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true); setErr("");
      try {
        const [allRes, todayRes] = await Promise.all([
          supabase.from("repair_jobs").select("status").eq("is_deleted", false),
          supabase.from("repair_jobs").select("job_id").eq("is_deleted", false).gte("created_at", todayStartISO),
        ]);

        if (allRes.error) throw allRes.error;
        if (todayRes.error) throw todayRes.error;

        const all = allRes.data || [];
        if (!alive) return;

        setJobs({
          pending: all.filter(j => j.status === "Pending").length,
          inProgress: all.filter(j => j.status === "In Progress").length,
          completed: all.filter(j => j.status === "Completed").length,
          today: (todayRes.data || []).length,
        });

        setLoading(false);
      } catch(e) {
        if(!alive) return;
        setErr(e?.message || "Failed to load jobs");
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [todayStartISO]);

  if (err) return <div className="p-4 text-red-600">Error: {err}</div>;

  const chartData = [
    { status: "Pending", count: jobs.pending },
    { status: "In Progress", count: jobs.inProgress },
    { status: "Completed", count: jobs.completed },
    { status: "Today Created", count: jobs.today },
  ];

  return (
    <div className="p-3 space-y-4 bg-white rounded-xl shadow-sm">
      <h1 className="text-lg md:text-xl font-semibold text-gray-900">🔧 Jobs Dashboard</h1>

      {/* Job Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <JobStat label="Pending" value={jobs.pending} loading={loading} color="bg-yellow-50 border-yellow-300 text-yellow-800" />
        <JobStat label="In Progress" value={jobs.inProgress} loading={loading} color="bg-blue-50 border-blue-300 text-blue-800" />
        <JobStat label="Completed" value={jobs.completed} loading={loading} color="bg-green-50 border-green-300 text-green-800" />
        <JobStat label="Today Created" value={jobs.today} loading={loading} color="bg-purple-50 border-purple-300 text-purple-800" />
      </div>

      {/* Small Responsive Bar Chart */}
      <div className="w-full h-40 sm:h-48 md:h-52 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#4F46E5" radius={[4,4,0,0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function JobStat({ label, value, loading, color }) {
  return (
    <div className={`rounded-xl border ${color} p-2 text-center shadow-sm`}>
      <div className="text-[10px] font-medium uppercase">{label}</div>
      <div className="mt-1 text-xl md:text-2xl font-bold">{loading ? "…" : value}</div>
    </div>
  );
}