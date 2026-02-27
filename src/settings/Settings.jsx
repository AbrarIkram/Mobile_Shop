import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const TARGET_ROLES = ["Manager", "Cashier", "Repairman"];

// What can be granted to non-admins (don’t include staff/settings)
const PERMISSION_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "jobs", label: "Repair Jobs" },
  { key: "sales", label: "Sales" },
  { key: "products", label: "Products" },
  { key: "services", label: "Services" },
  { key: "customers", label: "Customers" },
  { key: "notifications", label: "Notifications" },
];

export default function Settings({ user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [err, setErr] = useState("");

  const isAdmin = user?.role === "Superadmin" || user?.role === "Admin";

  async function fetchStaffAccess() {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("employees")
      .select("employee_id, full_name, role, email, sidebar_keys, is_active")
      .eq("is_deleted", false)
      .in("role", TARGET_ROLES)
      .order("employee_id", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const normalized = (data || []).map((r) => ({
      ...r,
      sidebar_keys: Array.isArray(r.sidebar_keys) ? r.sidebar_keys : [],
    }));

    setRows(normalized);
    setLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    fetchStaffAccess();
  }, [isAdmin]);

  const perms = useMemo(() => PERMISSION_ITEMS, []);

  function toggleKey(employee_id, key) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.employee_id !== employee_id) return r;
        const has = r.sidebar_keys.includes(key);
        const next = has
          ? r.sidebar_keys.filter((k) => k !== key)
          : [...r.sidebar_keys, key];
        return { ...r, sidebar_keys: next };
      })
    );
  }

  function setAll(employee_id, checked) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.employee_id !== employee_id) return r;
        return { ...r, sidebar_keys: checked ? perms.map((p) => p.key) : [] };
      })
    );
  }

  async function saveRow(r) {
    setSavingId(r.employee_id);
    setErr("");

    const { error } = await supabase
      .from("employees")
      .update({
        sidebar_keys: r.sidebar_keys,
        updated_at: new Date().toISOString(),
      })
      .eq("employee_id", r.employee_id);

    if (error) {
      setErr(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
        Only Admin/Superadmin can access Settings.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold text-gray-900">Settings</div>
        <div className="text-sm text-gray-500">
          Control which sidebar pages each Manager/Cashier/Repairman can see.
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          No Manager/Cashier/Repairman users found.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const allChecked = perms.every((p) => r.sidebar_keys.includes(p.key));
            return (
              <div
                key={r.employee_id}
                className="rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {r.full_name}{" "}
                      <span className="text-xs font-medium text-gray-500">
                        ({r.role})
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => setAll(r.employee_id, e.target.checked)}
                      />
                      Select All
                    </label>

                    <button
                      onClick={() => saveRow(r)}
                      disabled={savingId === r.employee_id}
                      className="rounded-xl bg-black px-4 py-2 text-xs text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {savingId === r.employee_id ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {perms.map((p) => {
                      const checked = r.sidebar_keys.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleKey(r.employee_id, p.key)}
                          />
                          <span className="text-gray-800">{p.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    After saving, the staff member must log out + log in again (or you can also refresh their localStorage).
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}