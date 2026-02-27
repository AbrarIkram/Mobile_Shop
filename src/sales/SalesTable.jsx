import { useMemo, useState } from "react";

export default function SalesTable({ rows, loading, onRowClick }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const name = (r.customers?.full_name || "").toLowerCase();
      const mob = (r.customers?.mobile_number || "").toLowerCase();
      const total = String(r.total ?? "");
      return name.includes(s) || mob.includes(s) || total.includes(s);
    });
  }, [rows, q]);

  function money(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">Sales List</div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            {loading ? "Loading..." : `${filtered.length} records`}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer / mobile / total"
            className="w-full md:w-72 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-600">Loading sales...</div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-sm text-gray-600">
          No sales found. Click <b>New Sale</b> to create one.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Customer</Th>
                <Th>Subtotal</Th>
                <Th>Discount</Th>
                <Th>Total</Th>
                <Th>Payment</Th>
                <Th>Date</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <tr
                  key={r.sale_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onRowClick?.(r)}
                  title="Click to view details"
                >
                  <Td>
                    <div className="font-medium text-gray-900">
                      {r.customers?.full_name || "-"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.customers?.mobile_number || ""}
                    </div>
                  </Td>
                  <Td>{money(r.subtotal)}</Td>
                  <Td>{money(r.discount)}</Td>
                  <Td className="font-semibold text-gray-900">{money(r.total)}</Td>
                  <Td>{r.payment_method || "-"}</Td>
                  <Td className="text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString()}
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