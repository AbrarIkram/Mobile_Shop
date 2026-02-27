import { supabase } from "../../supabaseClient";

export default function StaffTable({ rows, loading, onEdit, onChanged }) {
  async function softDelete(employee_id) {
    const ok = window.confirm("Delete this staff member?");
    if (!ok) return;

    const { error } = await supabase
      .from("employees")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("employee_id", employee_id);

    if (error) {
      alert(error.message);
      return;
    }

    onChanged?.();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">User List</div>
        <div className="text-xs text-gray-500">
          {loading ? "Loading..." : `${rows.length} records`}
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-600">Loading User...</div>
      ) : rows.length === 0 ? (
        <div className="p-4 text-sm text-gray-600">
          No User found. Click <b>Add User</b> to create one.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Email</Th>
                <Th>Mobile</Th>
                <Th>NIC</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.employee_id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">{r.full_name}</Td>
                  <Td>
                    <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs">
                      {r.role}
                    </span>
                  </Td>
                  <Td>{r.email}</Td>
                  <Td>{r.mobile_number || "-"}</Td>
                  <Td>{r.national_id || "-"}</Td>
                  <Td>
                    {r.is_active ? (
                      <span className="inline-flex items-center gap-2 text-green-700">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        Inactive
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onEdit?.(r)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => softDelete(r.employee_id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
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
  return (
    <th className={`px-4 py-3 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}