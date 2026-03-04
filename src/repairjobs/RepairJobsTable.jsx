import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const STATUSES = ["Pending", "In Progress", "Completed", "Canceled"];

export default function RepairJobsTable({
  rows,
  loading,
  currentEmployeeId,
  currentRole,
  onChanged,
  onOpenSale,
  onEditJob,
}) {
  const [q, setQ] = useState("");

  const canSeeSaleColumn =
  currentRole === "Admin" ||
  currentRole === "Manager" ||
  currentRole === "Superadmin";

  const [openPhotosJob, setOpenPhotosJob] = useState(null);
  const [editJob, setEditJob] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const cName = (r.customers?.full_name || "").toLowerCase();
      const cMob = (r.customers?.mobile_number || "").toLowerCase();
      const mName = (r.mobile_name || "").toLowerCase();
      const mModel = (r.mobile_model || "").toLowerCase();
      return (
        cName.includes(s) ||
        cMob.includes(s) ||
        mName.includes(s) ||
        mModel.includes(s) ||
        String(r.job_id).includes(s)
      );
    });
  }, [rows, q]);

  // ✅ helper: name display
  function whoName(jobRow, employeeId) {
    const id = Number(employeeId);

    // if claimed repairer matches assigned_to relation
    if (Number(jobRow?.assigned_repairer_id) === id && jobRow?.assigned_to?.full_name) {
      return jobRow.assigned_to.full_name;
    }
    return `Employee #${id}`;
  }

  // ✅ notify all Admin + Manager users (by employee_id)
async function notifyAllEmployees(jobId, type, message, changedByEmployeeId = null) {
  const { data: emps, error } = await supabase
    .from("employees")
    .select("employee_id")
    .eq("is_deleted", false)
    .eq("is_active", true);

  if (error || !emps?.length) return;

  const payload = emps.map((e) => ({
    to_employee_id: e.employee_id,
    job_id: jobId,
    type,
    message,
    changed_by_employee_id: changedByEmployeeId, // ✅ NEW
    is_read: false,
    is_deleted: false,
    updated_at: new Date().toISOString(),
  }));

  const { error: insErr } = await supabase.from("notifications").insert(payload);
  if (insErr) console.warn("notifyAllEmployees insert error:", insErr.message);
}

  async function claimJob(job) {
    if (!currentEmployeeId) {
      alert("No employee_id in localStorage.");
      return;
    }

    // ✅ claim only if still unassigned (race-safe)
    const { data, error } = await supabase
      .from("repair_jobs")
      .update({
        assigned_repairer_id: currentEmployeeId,
        status: "In Progress",
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", job.job_id)
      .is("assigned_repairer_id", null)
      .select("job_id, assigned_repairer_id")
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }
    if (!data) {
      alert("This job was already claimed by someone else.");
      return;
    }

    // ✅ notify admin/manager who claimed (use name if possible)
    const claimedBy = whoName(job, currentEmployeeId);
await notifyAllEmployees(
  job.job_id,
  "Job Claimed",
  `Job #${job.job_id} was claimed.`,
  currentEmployeeId
);

    onChanged?.();
  }
  async function deleteJob(job) {
  if (!confirm(`Delete Job #${job.job_id}?`)) return;

  const { error } = await supabase
    .from("repair_jobs")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("job_id", job.job_id);

  if (error) return alert(error.message);

  onChanged?.();
}

async function saveEdit(updated) {
  try {
    const { error } = await supabase
      .from("repair_jobs")
      .update({
        mobile_name: updated.mobile_name,
        mobile_model: updated.mobile_model || null,
        notes: updated.notes || null,
        status: updated.status,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", updated.job_id);

    if (error) throw error;

    setEditJob(null);
    onChanged?.();
  } catch (e) {
    alert(e.message || "Update failed");
  }
}

  async function updateStatus(job, newStatus) {
  if (!currentEmployeeId) {
    alert("No employee_id in localStorage.");
    return;
  }
  if (!STATUSES.includes(newStatus)) return;

  // Only assigned repairer (or admin/manager)
  const isRepairman = currentRole === "Repairman";
  if (isRepairman && Number(job.assigned_repairer_id) !== Number(currentEmployeeId)) {
    alert("Only the assigned repairer can change the status.");
    return;
  }

  const oldStatus = job.status;

  const { error: upErr } = await supabase
    .from("repair_jobs")
    .update({
      status: newStatus,
      completed_at: newStatus === "Completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", job.job_id);

  if (upErr) {
    alert(upErr.message);
    return;
  }

  // ✅ history insert
  const { error: histErr } = await supabase
    .from("job_status_history")
    .insert({
      job_id: job.job_id,
      changed_by_employee_id: currentEmployeeId,
      old_status: oldStatus,
      new_status: newStatus,
      updated_at: new Date().toISOString(),
    });

  if (histErr) console.warn(histErr.message);

  // ✅ Notify ALL employees
  const changer = whoName(job, currentEmployeeId);

if (newStatus === "Completed") {
  await notifyAllEmployees(
    job.job_id,
    "Job Completed",
    `Job #${job.job_id} completed.`,
    currentEmployeeId // ✅ NEW
  );
} else {
  await notifyAllEmployees(
    job.job_id,
    "Status Changed",
    `Job #${job.job_id} status: ${oldStatus} → ${newStatus}.`,
    currentEmployeeId // ✅ NEW
  );
}

  onChanged?.();
}

  function badge(status) {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs border";
    if (status === "Pending")
      return `${base} border-gray-200 bg-white text-gray-700`;
    if (status === "In Progress")
      return `${base} border-blue-200 bg-blue-50 text-blue-700`;
    if (status === "Completed")
      return `${base} border-green-200 bg-green-50 text-green-700`;
    return `${base} border-red-200 bg-red-50 text-red-700`;
  }

  const canClaim = currentRole === "Repairman";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">Jobs</div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            {loading ? "Loading..." : `${filtered.length} records`}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search job / customer / mobile"
            className="w-full md:w-72 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-600">Loading jobs...</div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-sm text-gray-600">No jobs found.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Customer</Th>
                <Th>Mobile</Th>
                <Th>Password</Th>
                <Th>Photos</Th>
                <Th>Notes</Th>
                <Th>Status</Th>
                <Th>Assigned</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
                {canSeeSaleColumn && <Th>Sale</Th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => {
                const customerPassword = r.customers?.screen_lock || "-";
                const assignedName = r.assigned_to?.full_name || "-";
                const customerName = r.customers?.full_name || "-";
                const customerMobile = r.customers?.mobile_number || "";
                const isUnassigned = !r.assigned_repairer_id;
                const saleId = r.sales?.[0]?.sale_id || null;
                const canMakeSale = r.status === "Completed";

                const canChangeStatus =
                  !!currentEmployeeId &&
                  (currentRole === "Admin" ||
                    currentRole === "Manager" ||
                    (currentRole === "Repairman" &&
                      Number(r.assigned_repairer_id) === Number(currentEmployeeId)));

                return (
                  <tr key={r.job_id} className="hover:bg-gray-50">
                    <Td>
                      <div className="font-medium text-gray-900">{customerName}</div>
                      <div className="text-xs text-gray-500">{customerMobile}</div>
                    </Td>

                    <Td>
                      <div className="font-medium text-gray-900">{r.mobile_name}</div>
                      <div className="text-xs text-gray-500">{r.mobile_model || "-"}</div>
                    </Td>
                    <Td>
                      <div className="text-sm text-gray-900">{r.screen_lock || "-"}</div>
                    </Td>
                    <Td>
                      {r.photos?.length ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={r.photos
                              .slice()
                              .sort((a, b) => (a.photo_index ?? 0) - (b.photo_index ?? 0))[0].photo_url}
                            alt="job"
                            className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              console.log("Image failed:", e.currentTarget.src);
                            }}
                          />
                          <button
                            className="text-xs underline text-gray-700"
                            onClick={() => setOpenPhotosJob(r)}
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </Td>

                    <Td className="max-w-[260px]">
                      <div className="text-sm text-gray-900 truncate" title={r.notes || ""}>
                        {r.notes ? r.notes : <span className="text-gray-400">—</span>}
                      </div>
                    </Td>

                    <Td>
                      <span className={badge(r.status)}>{r.status}</span>
                    </Td>

                    <Td>{assignedName}</Td>

                    <Td className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleString()}
                    </Td>

                    <Td className="text-right">
                      {/* KEEP YOUR ACTIONS SAME */}
                      <div className="inline-flex items-center gap-2">
                        {canClaim && isUnassigned && (r.status === "Pending" || r.status === "In Progress") ? (
                          <button
                            onClick={() => claimJob(r)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-white"
                            disabled={!currentEmployeeId}
                          >
                            Claim
                          </button>
                        ) : null}

                        <select
                          className="rounded-lg border border-gray-200 px-3 py-1.5 bg-white"
                          value={r.status}
                          disabled={!canChangeStatus}
                          onChange={(e) => updateStatus(r, e.target.value)}
                          title={
                            !canChangeStatus
                              ? "Only assigned repairer or Admin/Manager can change status"
                              : ""
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        {(currentRole === "Admin" || currentRole === "Manager" || currentRole === "Superadmin") ? (
                          <>
                            <button
                              onClick={() => onEditJob?.(r)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deleteJob(r)}
                              className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-1.5 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </Td>

                    {canSeeSaleColumn && (
                      <Td>
                        {saleId ? (
                          <span className="text-xs font-semibold text-gray-900">Sale #{saleId}</span>
                        ) : canMakeSale ? (
                          <button
                            onClick={() => onOpenSale?.(r.job_id)}
                            className="rounded-lg bg-black text-white px-3 py-1.5 text-xs hover:opacity-90"
                          >
                            Sale
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {openPhotosJob ? (
            <PhotosModal job={openPhotosJob} onClose={() => setOpenPhotosJob(null)} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-4 py-3 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function PhotosModal({ job, onClose }) {
  const photos = (job.photos || [])
    .slice()
    .sort((a, b) => (a.photo_index ?? 0) - (b.photo_index ?? 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-900">
            Job #{job.job_id} Photos
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        {photos.length === 0 ? (
          <div className="text-sm text-gray-500">No photos for this job.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((p) => (
              <a key={p.photo_id} href={p.photo_url} target="_blank" rel="noreferrer">
                <img
                  src={p.photo_url}
                  alt={`photo ${p.photo_index}`}
                  className="h-40 w-full rounded-xl border border-gray-200 object-cover"
                  onError={(e) => {
                    console.log("Modal image failed:", p.photo_url);
                    e.currentTarget.style.opacity = 0.3;
                  }}
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}