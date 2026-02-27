import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function ProductTable({ rows, loading, onEdit, onChanged }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const a = (r.name || "").toLowerCase();
      const b = (r.model || "").toLowerCase();
      return a.includes(s) || b.includes(s);
    });
  }, [rows, q]);

  async function softDelete(product_id) {
    const ok = window.confirm("Delete this product?");
    if (!ok) return;

    const { error } = await supabase
      .from("products")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("product_id", product_id);

    if (error) {
      alert(error.message);
      return;
    }

    onChanged?.();
  }

  function money(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(2);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">Product List</div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            {loading ? "Loading..." : `${filtered.length} records`}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / model"
            className="w-full md:w-64 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-600">Loading products...</div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-sm text-gray-600">
          No products found. Click <b>Add Product</b> to create one.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Name</Th>
                <Th>Model</Th>
                <Th>Cost</Th>
                <Th>Price</Th>
                <Th>Stock</Th>
                <Th>Low Limit</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => {
                const low =
                  Number(r.stock_qty) <= Number(r.low_stock_limit || 0);

                return (
                  <tr
                    key={r.product_id}
                    className={low ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}
                  >
                    <Td className="font-medium text-gray-900">{r.name}</Td>
                    <Td>{r.model || "-"}</Td>
                    <Td>{money(r.cost)}</Td>
                    <Td>{money(r.price)}</Td>

                    <Td>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
                          low
                            ? "border-yellow-300 bg-yellow-100 text-yellow-800"
                            : "border-gray-200 bg-white text-gray-700"
                        }`}
                      >
                        {r.stock_qty}
                        {low ? " (Low)" : ""}
                      </span>
                    </Td>

                    <Td>{r.low_stock_limit ?? "-"}</Td>

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
                          onClick={() => softDelete(r.product_id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
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