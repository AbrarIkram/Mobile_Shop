import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function InvoiceModal({ saleId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sale, setSale] = useState(null); // header
  const [items, setItems] = useState([]); // lines

  const printRef = useRef(null);

  async function loadInvoice() {
    setLoading(true);
    setErr("");

    // 1) sale header (customer + created_by)
    const { data: saleData, error: saleErr } = await supabase
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
        customers:customers ( full_name, mobile_number, address, national_id ),
        cashier:employees!sales_created_by_employee_id_fkey ( full_name, role )
      `)
      .eq("sale_id", saleId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (saleErr) {
      setErr(saleErr.message);
      setLoading(false);
      return;
    }
    if (!saleData) {
      setErr("Sale not found.");
      setLoading(false);
      return;
    }

    // 2) sale items (join product/service names)
    const { data: itemsData, error: itemsErr } = await supabase
      .from("sale_items")
      .select(`
        sale_item_id,
        item_type,
        product_id,
        service_id,
        quantity,
        unit_price,
        unit_cost,
        line_total,
        products:products ( name, model ),
        services:services ( name )
      `)
      .eq("sale_id", saleId)
      .eq("is_deleted", false)
      .order("sale_item_id", { ascending: true });

    if (itemsErr) {
      setErr(itemsErr.message);
      setLoading(false);
      return;
    }

    setSale(saleData);
    setItems(itemsData || []);
    setLoading(false);
  }

  useEffect(() => {
    if (saleId) loadInvoice();
  }, [saleId]);

  const shop = useMemo(() => {
    // You can replace these with Settings later
    return {
      name: "Mobile Repair & Accessories",
      phone: "+94 XX XXX XXXX",
      address: "Your shop address here",
    };
  }, []);

  function money(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  }

  function printInvoice() {
    // Simple print using browser
    window.print();
  }

  // PDF download (no library): open print dialog is the simplest.
  // If you want real PDF download, I’ll give you jsPDF version next.
  // For now, print = save as PDF.
  function downloadPDF() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div className="absolute inset-0 bg-black/40 print:hidden" onClick={onClose} />

      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-200 print:border-0 print:shadow-none print:rounded-none">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 print:hidden">
          <div>
            <div className="text-lg font-semibold text-gray-900">Invoice</div>
            <div className="text-sm text-gray-500">Sale #{saleId}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={printInvoice}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
              disabled={loading}
            >
              Print
            </button>
            <button
              onClick={downloadPDF}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90"
              disabled={loading}
            >
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-xl border border-gray-200 hover:bg-gray-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div ref={printRef} className="p-5 md:p-8 print:p-0">
          {/* GOLD/BLACK/WHITE theme */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden print:border-0">
            {/* Header stripe */}
            <div className="bg-black px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-white text-xl font-semibold">
                    {shop.name}
                  </div>
                  <div className="text-white/80 text-sm mt-1">
                    {shop.address}
                  </div>
                  <div className="text-white/80 text-sm">{shop.phone}</div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold border border-yellow-400/60 text-yellow-300">
                    GOLD INVOICE
                  </div>
                  <div className="mt-2 text-white text-sm">
                    Sale #{saleId}
                  </div>
                  <div className="text-white/80 text-xs mt-1">
                    {sale?.created_at ? new Date(sale.created_at).toLocaleString() : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="bg-white px-6 py-5">
              {loading ? (
                <div className="text-sm text-gray-600">Loading invoice...</div>
              ) : err ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {err}
                </div>
              ) : (
                <>
                  {/* Customer + Sale info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InfoCard
                      label="Customer"
                      value={sale?.customers?.full_name || "-"}
                      sub={sale?.customers?.mobile_number || ""}
                    />
                    <InfoCard
                      label="Address"
                      value={sale?.customers?.address || "-"}
                      sub={sale?.customers?.national_id || ""}
                    />
                    <InfoCard
                      label="Payment"
                      value={sale?.payment_method || "-"}
                      sub={sale?.cashier?.full_name ? `Cashier: ${sale.cashier.full_name}` : ""}
                    />
                  </div>

                  {/* Items */}
                  <div className="mt-5">
                    <div className="text-sm font-semibold text-gray-900">
                      Items
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-[900px] w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <Th>#</Th>
                            <Th>Type</Th>
                            <Th>Description</Th>
                            <Th className="text-right">Qty</Th>
                            <Th className="text-right">Unit Price</Th>
                            <Th className="text-right">Line Total</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {items.map((it, idx) => {
                            const desc =
                              it.item_type === "Service"
                                ? it.services?.name || "Service"
                                : `${it.products?.name || "Product"}${
                                    it.products?.model ? ` (${it.products.model})` : ""
                                  }`;

                            return (
                              <tr key={it.sale_item_id}>
                                <Td>{idx + 1}</Td>
                                <Td>
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-gray-200">
                                    {it.item_type}
                                  </span>
                                </Td>
                                <Td className="font-medium text-gray-900">
                                  {desc}
                                </Td>
                                <Td className="text-right">
                                  {it.item_type === "Service" ? 1 : it.quantity}
                                </Td>
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
                  </div>

                  {/* Totals */}
                  <div className="mt-5 flex flex-col md:flex-row md:justify-end gap-4">
                    <div className="w-full md:w-80 rounded-2xl border border-gray-200 p-4">
                      <Row label="Subtotal" value={money(sale.subtotal)} />
                      <Row label="Discount" value={money(sale.discount)} />
                      <div className="my-3 h-px bg-gray-200" />
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900">
                          Total
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {money(sale.total)}
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl bg-black text-white p-3">
                        <div className="text-xs text-yellow-300 font-semibold">
                          THANK YOU
                        </div>
                        <div className="text-xs text-white/80 mt-1">
                          Gold • Black • White invoice layout (responsive)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 text-xs text-gray-500">
                    This is a system generated invoice. Keep it for your records.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:border-0 { border: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
        }

        /* ✅ Mobile invoice table scroll */
        @media (max-width: 640px) {
          table {
            min-width: 700px !important;
          }
        }
      `}</style>
    </div>
  );
}

function InfoCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-gray-600">{label}</div>
      <div className="text-gray-900 font-medium">{value}</div>
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