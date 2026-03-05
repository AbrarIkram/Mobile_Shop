import { useEffect, useMemo, useState } from "react";
import RepairJobsTable from "./RepairJobsTable";
import RepairJobForm from "./RepairJobForm";
import SalesForm from "../sales/SalesForm";
import { supabase } from "../../supabaseClient";

export default function RepairJobs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openJobForm, setOpenJobForm] = useState(false);
  const [saleJobId, setSaleJobId] = useState(null);

  const currentEmployeeId = useMemo(() => {
    const v = localStorage.getItem("employee_id");
    return v ? Number(v) : null;
  }, []);

  const currentRole = useMemo(() => {
    return localStorage.getItem("role") || null;
  }, []);

  const canCreateJob = currentRole === "Admin" || currentRole === "Manager";

  async function fetchJobs() {
    setLoading(true);
    setErr("");

    const userId = Number(localStorage.getItem("employee_id"));
    const role = localStorage.getItem("role");

    let query = supabase
      .from("repair_jobs")
      .select(`
        job_id,
        customer_id,
        screen_lock,
        created_by_employee_id,
        assigned_repairer_id,
        mobile_name,
        mobile_model,
        status,
        notes,
        created_at,
        updated_at,
        completed_at,
        customers:customers(full_name,mobile_number),
        created_by:employees!repair_jobs_created_by_employee_id_fkey(full_name,role),
        assigned_to:employees!repair_jobs_assigned_repairer_id_fkey(full_name,role),
        sales:sales(sale_id,total,created_at),
        photos:repair_job_photos(photo_id,photo_url,photo_index)
      `)
      .eq("is_deleted", false);

    // ✅ Repairman logic
    if (role === "Repairman") {
      query = query.or(`assigned_repairer_id.eq.${userId},status.eq.Pending`);
    }

    // ✅ sorting should be last
    query = query.order("job_id", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setErr(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  // Realtime updates
  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel("realtime-repair-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "repair_jobs" },
        () => fetchJobs()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Repair Jobs</h1>
          <p className="text-sm text-gray-500">
            Create jobs, upload photos, claim jobs, and update status.
          </p>
        </div>

        {canCreateJob && (
          <button
            onClick={() => setOpenJobForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
          >
            <span className="text-lg leading-none">+</span>
            <span className="text-sm font-medium">New Job</span>
          </button>
        )}
      </div>

      {!currentEmployeeId && (
        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          Note: <b>employee_id</b> not found in localStorage. Set it after login.
        </div>
      )}

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="mt-4">
        <RepairJobsTable
          rows={rows}
          loading={loading}
          currentEmployeeId={currentEmployeeId}
          currentRole={currentRole}
          onChanged={fetchJobs}
          onOpenSale={(jobId) => setSaleJobId(jobId)}
        />
      </div>

      {/* Create-only Job Form */}
      {openJobForm && (
        <RepairJobForm
          createdByEmployeeId={currentEmployeeId}
          mode="create"       // ✅ create-only
          onClose={() => setOpenJobForm(false)}
          onSaved={async () => {
            setOpenJobForm(false);
            await fetchJobs();
          }}
        />
      )}

      {/* Sales Form */}
      {saleJobId && (
        <SalesForm
          jobId={saleJobId}
          createdByEmployeeId={currentEmployeeId}
          onClose={() => setSaleJobId(null)}
          onSaved={async () => {
            setSaleJobId(null);
            await fetchJobs();
          }}
        />
      )}
    </div>
  );
}