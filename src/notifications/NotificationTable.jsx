import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function NotificationTable({ rows, loading, onChanged }) {
  const [q, setQ] = useState("");

  const [empMap, setEmpMap] = useState({});        // employee_id -> full_name
  const [jobMap, setJobMap] = useState({});        // job_id -> { customer_name, mobile_name }

  // ✅ Load employees (to show repairman name)
  useEffect(() => {
    let alive = true;

    async function loadEmployees() {
      const { data, error } = await supabase
        .from("employees")
        .select("employee_id, full_name")
        .eq("is_deleted", false);

      if (!alive) return;
      if (error) return;

      const map = {};
      (data || []).forEach((e) => (map[e.employee_id] = e.full_name));
      setEmpMap(map);
    }

    loadEmployees();
    return () => { alive = false; };
  }, []);

  // ✅ Load job -> customer + mobile_name
  useEffect(() => {
    let alive = true;

    async function loadJobs() {
      const jobIds = rows.map((r) => r.job_id).filter(Boolean);
      if (!jobIds.length) {
        setJobMap({});
        return;
      }

      const { data, error } = await supabase
        .from("repair_jobs")
        .select(`
          job_id,
          mobile_name,
          customers:customers ( full_name )
        `)
        .in("job_id", jobIds);

      if (!alive) return;
      if (error) return;

      const map = {};
      (data || []).forEach((j) => {
        map[j.job_id] = {
          customer_name: j.customers?.full_name || "-",
          mobile_name: j.mobile_name || "-",
        };
      });

      setJobMap(map);
    }

    loadJobs();
    return () => { alive = false; };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const type = (r.type || "").toLowerCase();
      const cust = (jobMap[r.job_id]?.customer_name || "").toLowerCase();
      const mob = (jobMap[r.job_id]?.mobile_name || "").toLowerCase();
      const repairman = (empMap[r.changed_by_employee_id] || "").toLowerCase();

      return (
        type.includes(s) ||
        cust.includes(s) ||
        mob.includes(s) ||
        repairman.includes(s)
      );
    });
  }, [rows, q, jobMap, empMap]);

  async function markRead(notification_id) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("notification_id", notification_id);

    if (error) {
      alert(error.message);
      return;
    }
    onChanged?.();
  }

  function badge(type) {
    const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs border";
    if (type === "Job Created") return `${base} border-blue-200 bg-blue-50 text-blue-700`;
    if (type === "Job Claimed") return `${base} border-yellow-200 bg-yellow-50 text-yellow-800`;
    if (type === "Status Changed") return `${base} border-gray-200 bg-white text-gray-700`;
    if (type === "Job Completed") return `${base} border-green-200 bg-green-50 text-green-700`;
    return `${base} border-gray-200 bg-white text-gray-700`;
  }

  function repairmanName(row) {
    const id = row.changed_by_employee_id;
    if (!id) return "-";
    return empMap[id] || `Employee #${id}`;
  }

  function customerName(row) {
    if (!row.job_id) return "-";
    return jobMap[row.job_id]?.customer_name || "-";
  }

  function mobileName(row) {
    if (!row.job_id) return "-";
    return jobMap[row.job_id]?.mobile_name || "-";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">My Notifications</div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            {loading ? "Loading..." : `${filtered.length} records`}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer / mobile / repairman / type"
            className="w-full md:w-72 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-600">Loading notifications...</div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-sm text-gray-600">No notifications found.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Customer</Th>
                <Th>Mobile</Th>
                <Th>Type</Th>
                <Th>Repairman</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <tr
                  key={r.notification_id}
                  className={r.is_read ? "hover:bg-gray-50" : "bg-yellow-50 hover:bg-yellow-100"}
                >
                  <Td>
                    <div className="font-medium text-gray-900">{customerName(r)}</div>
                  </Td>

                  <Td>
                    <div className="font-medium text-gray-900">{mobileName(r)}</div>
                  </Td>

                  <Td>
                    <span className={badge(r.type)}>{r.type}</span>
                  </Td>

                  <Td className="font-medium text-gray-900">{repairmanName(r)}</Td>

                  <Td className="text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString()}
                  </Td>

                  <Td>
                    {r.is_read ? (
                      <span className="text-xs text-gray-500">Read</span>
                    ) : (
                      <span className="text-xs font-semibold text-yellow-800">Unread</span>
                    )}
                  </Td>

                  <Td className="text-right">
                    {!r.is_read ? (
                      <button
                        onClick={() => markRead(r.notification_id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-white"
                      >
                        Mark read
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 text-left font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}