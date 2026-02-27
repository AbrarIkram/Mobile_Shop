import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function CustomerTable({ rows, loading, onEdit, onChanged }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const a = (r.full_name || "").toLowerCase();
      const b = (r.mobile_number || "").toLowerCase();
      const c = (r.national_id || "").toLowerCase();
      return a.includes(s) || b.includes(s) || c.includes(s);
    });
  }, [rows, q]);

  async function softDelete(customer_id) {
    const ok = window.confirm("Delete this customer?");
    if (!ok) return;

    const { error } = await supabase
      .from("customers")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("customer_id", customer_id);

    if (error) {
      alert(error.message);
      return;
    }

    onChanged?.();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">Customer List</div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            {loading ? "Loading..." : `${filtered.length} records`}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / mobile / NIC"
            className="w-full md:w-64 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-600">Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-sm text-gray-600">
          No customers found. Click <b>Add Customer</b> to create one.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Name</Th>
                <Th>Mobile</Th>
                <Th>NIC</Th>
                <Th>Address</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <tr key={r.customer_id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">{r.full_name}</Td>
                  <Td>{r.mobile_number || "-"}</Td>
                  <Td>{r.national_id || "-"}</Td>
                  <Td className="max-w-[380px] truncate" title={r.address || ""}>
                    {r.address || "-"}
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
                        onClick={() => softDelete(r.customer_id)}
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