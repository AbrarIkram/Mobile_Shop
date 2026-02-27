import { useEffect, useMemo, useState } from "react";
import SalesTable from "./SalesTable";
import SalesForm from "./SalesForm";
import { supabase } from "../../supabaseClient";

export default function Sales() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openForm, setOpenForm] = useState(false);

  const [jobIdForSale, setJobIdForSale] = useState(null);

  // ✅ popup state
  const [openSaleId, setOpenSaleId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const currentEmployeeId = useMemo(() => {
    const v = localStorage.getItem("employee_id");
    return v ? Number(v) : null;
  }, []);

  async function fetchSales() {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("sales")
      .select(`
        sale_id,
        job_id,
        customer_id,
        created_by_employee_id,
        subtotal,
        discount,
        total,
        payment_method,
        created_at,
        customers:customers ( full_name, mobile_number )
      `)
      .eq("is_deleted", false)
      .order("sale_id", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  async function openSalePopup(saleRow) {
    const saleId = saleRow.sale_id;
    setOpenSaleId(saleId);
    setDetail(null);
    setDetailItems([]);
    setDetailErr("");
    setDetailLoading(true);

    try {
      // ✅ Sale details + job assigned repairman (if job exists)
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .select(`
          sale_id,
          job_id,
          customer_id,
          subtotal,
          discount,
          total,
          payment_method,
          created_at,
          customers:customers ( full_name, mobile_number ),
          job:repair_jobs (
            job_id,
            assigned_repairer_id,
            assigned_to:employees!repair_jobs_assigned_repairer_id_fkey ( full_name, role )
          )
        `)
        .eq("sale_id", saleId)
        .maybeSingle();

      if (saleErr) throw saleErr;

      // ✅ Items
      const { data: items, error: itemsErr } = await supabase
        .from("sale_items")
        .select(`
          sale_item_id,
          item_type,
          quantity,
          unit_price,
          line_total,
          product:products ( name, model ),
          service:services ( name )
        `)
        .eq("sale_id", saleId)
        .eq("is_deleted", false)
        .order("sale_item_id", { ascending: true });

      if (itemsErr) throw itemsErr;

      setDetail(sale || null);
      setDetailItems(items || []);
    } catch (e) {
      setDetailErr(e?.message || "Failed to load sale details");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    fetchSales();
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">
            Create walk-in sales or sales from completed repair jobs.
          </p>
        </div>

        <button
          onClick={() => {
            setJobIdForSale(null);
            setOpenForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
        >
          <span className="text-lg leading-none">+</span>
          <span className="text-sm font-medium">New Sale</span>
        </button>
      </div>

      {!currentEmployeeId ? (
        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          Note: <b>employee_id</b> not found in localStorage. Set it after login to save sales.
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-4">
        <SalesTable rows={rows} loading={loading} onRowClick={openSalePopup} />
      </div>

      {openForm ? (
        <SalesForm
          jobId={jobIdForSale}
          createdByEmployeeId={currentEmployeeId}
          onClose={() => setOpenForm(false)}
          onSaved={async () => {
            setOpenForm(false);
            setJobIdForSale(null);
            await fetchSales();
          }}
        />
      ) : null}

      {/* ✅ Popup */}
      {openSaleId ? (
        <SaleDetailsModal
          sale={detail}
          items={detailItems}
          loading={detailLoading}
          err={detailErr}
          onClose={() => setOpenSaleId(null)}
        />
      ) : null}
    </div>
  );
}

function SaleDetailsModal({ sale, items, loading, err, onClose }) {
  function money(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  }

  const assignedRepairman = sale?.job?.assigned_to?.full_name || "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-lg font-semibold text-gray-900">Sale Details</div>
            <div className="text-sm text-gray-500">
              {sale?.created_at ? new Date(sale.created_at).toLocaleString() : ""}
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-gray-200 hover:bg-gray-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading sale details...</div>
          ) : err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : !sale ? (
            <div className="text-sm text-gray-600">Sale not found.</div>
          ) : (
            <>
              {/* Top info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info label="Customer" value={sale.customers?.full_name || "-"} />
                <Info label="Mobile" value={sale.customers?.mobile_number || "-"} />
                <Info label="Assigned Repairman" value={assignedRepairman} />
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Info label="Subtotal" value={money(sale.subtotal)} />
                <Info label="Discount" value={money(sale.discount)} />
                <Info label="Total" value={money(sale.total)} />
                <Info label="Payment" value={sale.payment_method || "-"} />
              </div>

              {/* Items */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-900">
                  Items
                </div>

                {items.length === 0 ? (
                  <div className="p-4 text-sm text-gray-600">No items.</div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-[800px] w-full text-sm">
                      <thead className="bg-white text-gray-600">
                        <tr className="border-b border-gray-200">
                          <Th>Type</Th>
                          <Th>Name</Th>
                          <Th className="text-right">Qty</Th>
                          <Th className="text-right">Unit</Th>
                          <Th className="text-right">Line Total</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {items.map((it) => {
                          const name =
                            it.item_type === "Product"
                              ? `${it.product?.name || "-"}${it.product?.model ? ` (${it.product.model})` : ""}`
                              : it.service?.name || "-";

                          return (
                            <tr key={it.sale_item_id}>
                              <Td>{it.item_type}</Td>
                              <Td className="font-medium text-gray-900">{name}</Td>
                              <Td className="text-right">{Number(it.quantity || 0)}</Td>
                              <Td className="text-right">{money(it.unit_price)}</Td>
                              <Td className="text-right font-semibold text-gray-900">
                                {money(it.line_total)}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 text-left font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}