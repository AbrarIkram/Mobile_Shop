import { useEffect, useState } from "react";
import StaffTable from "./StaffTable";
import StaffForm from "./StaffForm";
import { supabase } from "../../supabaseClient";

export default function Staff() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null); // optional edit support

  async function fetchStaff() {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("employees")
      .select(
        "employee_id, full_name, national_id, mobile_number, address, role, email, is_active, created_at"
      )
      .eq("is_deleted", false)
      .order("employee_id", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            User
          </h1>
          <p className="text-sm text-gray-500">
            Manage users (Superadmin/Admin/Manager/Cashier/Repairman)
          </p>
        </div>

        <button
          onClick={() => {
            setEditing(null);
            setOpenForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
        >
          <span className="text-lg leading-none">+</span>
          <span className="text-sm font-medium">Add User</span>
        </button>
      </div>

      {/* Error */}
      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* Table */}
      <div className="mt-4">
        <StaffTable
          rows={rows}
          loading={loading}
          onEdit={(row) => {
            setEditing(row);
            setOpenForm(true);
          }}
          onChanged={fetchStaff}
        />
      </div>

      {/* Modal Form */}
      {openForm ? (
        <StaffForm
          initialValue={editing}
          onClose={() => setOpenForm(false)}
          onSaved={async () => {
            setOpenForm(false);
            await fetchStaff();
          }}
        />
      ) : null}
    </div>
  );
}