import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function InvoiceModal({ saleId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const printRef = useRef(null);

  async function loadInvoice() {
    setLoading(true);
    setErr("");

    const { data: saleData, error: saleErr } = await supabase
      .from("sales")
      .select(`
        sale_id, job_id, customer_id, created_by_employee_id,
        subtotal, discount, total, payment_method, created_at,
        customers:customers ( full_name, mobile_number, address, national_id ),
        cashier:employees!sales_created_by_employee_id_fkey ( full_name, role )
      `)
      .eq("sale_id", saleId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (saleErr || !saleData) {
      setErr(saleErr?.message || "Sale not found.");
      setLoading(false);
      return;
    }

    const { data: itemsData, error: itemsErr } = await supabase
      .from("sale_items")
      .select(`
        sale_item_id, item_type, product_id, service_id,
        quantity, unit_price, unit_cost, line_total,
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

  const shop = useMemo(() => ({
    name: "Mobile Repair & Accessories",
    phone: "+94 XX XXX XXXX",
    address: "Your shop address here",
    email: "info@shop.com",
  }), []);

  const money = (v) => Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "0.00";

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
  };

const handlePrint = () => {
  const content = printRef.current.innerHTML;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html><head><title>Invoice</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; padding: 8px; }
      </style>
    </head><body>${content}</body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

  return (
    <>
      {/* 🖨️ PRINT CSS */}
      <style>{`
@media print {
  body * {
    visibility: hidden !important;
  }

  .modal-wrapper {
    position: static !important; /* allow content to flow normally */
    visibility: visible !important;
  }

  .print-content, .print-content * {
    visibility: visible !important;
  }

  .print-content {
    position: relative !important;
    top: 0 !important;
    left: 0 !important;
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    padding: 12mm 15mm !important;
    background: white !important;
    color: black !important;
    z-index: 9999 !important;
  }

  button, input, select, textarea {
    display: none !important;
  }

  table {
    border-collapse: collapse !important;
    width: 100% !important;
  }

  th, td {
    border: 1px solid #000 !important;
    padding: 8px !important;
  }
}
`}</style>

      {/* 🖥️ MODAL VIEW */}
      <div className="modal-wrapper fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
            <div>
              <div className="text-lg font-semibold text-gray-900">Invoice</div>
              <div className="text-sm text-gray-500">Sale #{saleId}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">
                🖨️ Print
              </button>
              <button onClick={onClose} className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center">✕</button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="p-6">
              
              {/* 🧾 INVOICE - Clean Design (Matches Screenshot) */}
              <div ref={printRef} className="print-content bg-white">
                
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-xl font-bold text-black mb-1">{shop.name}</h1>
                    <p className="text-sm text-gray-600">{shop.address}</p>
                    <p className="text-sm text-gray-600">{shop.phone} • {shop.email}</p>
                  </div>
                  <div className="text-right">
                    <div className="border border-black px-3 py-1 inline-block font-bold text-sm mb-2">
                      INVOICE
                    </div>
                    <div className="text-sm font-bold"># {String(saleId).padStart(6, "0")}</div>
                    <div className="text-xs text-gray-600 mt-1">{formatDate(sale?.created_at)}</div>
                  </div>
                </div>

                {/* Bill To & Payment - Side by Side */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="border border-gray-300 p-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Bill To</div>
                    <div className="font-medium text-black text-base">
                      {sale?.customers?.full_name || "Walk-in Customer"}
                    </div>
                    {sale?.customers?.mobile_number && (
                      <div className="text-sm text-gray-600 mt-1">📱 {sale.customers.mobile_number}</div>
                    )}
                    {sale?.customers?.address && (
                      <div className="text-sm text-gray-600">{sale.customers.address}</div>
                    )}
                  </div>
                  <div className="border border-gray-300 p-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment</div>
                    <div className="text-sm">
                      <div className="mb-1">Method: <span className="font-medium capitalize">{sale?.payment_method || "Cash"}</span></div>
                      <div>Cashier: <span className="font-medium">{sale?.cashier?.full_name || "-"}</span></div>
                    </div>
                  </div>
                </div>

                {/* Items Table - Black Header */}
                <div className="mb-6">
                  <table className="w-full border-collapse">
                    <thead className="bg-black text-white">
                      <tr>
                        <th className="text-left px-3 py-2 text-sm font-semibold border border-gray-300">#</th>
                        <th className="text-left px-3 py-2 text-sm font-semibold border border-gray-300">Item</th>
                        <th className="text-right px-3 py-2 text-sm font-semibold border border-gray-300">Qty</th>
                        <th className="text-right px-3 py-2 text-sm font-semibold border border-gray-300">Price</th>
                        <th className="text-right px-3 py-2 text-sm font-semibold border border-gray-300">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const desc = it.item_type === "Service"
                          ? it.services?.name || "Service"
                          : `${it.products?.name || "Product"}${it.products?.model ? ` (${it.products.model})` : ""}`;
                        const qty = it.item_type === "Service" ? 1 : it.quantity;
                        return (
                          <tr key={it.sale_item_id} className="border-b border-gray-200">
                            <td className="px-3 py-3 text-sm border-l border-gray-300">{idx + 1}</td>
                            <td className="px-3 py-3 border-l border-gray-300">
                              <div className="font-medium text-black text-sm">{desc}</div>
                              <div className="text-xs text-gray-500">{it.item_type}</div>
                            </td>
                            <td className="px-3 py-3 text-right text-sm border-l border-gray-300">{qty}</td>
                            <td className="px-3 py-3 text-right text-sm border-l border-gray-300">Rs. {money(it.unit_price)}</td>
                            <td className="px-3 py-3 text-right font-semibold text-sm border-l border-r border-gray-300">Rs. {money(it.line_total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals Box */}
                <div className="flex justify-end mb-6">
                  <div className="w-48 border-2 border-black p-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">Subtotal</span>
                      <span className="text-right">Rs. {money(sale?.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-700">Discount</span>
                      <span className="text-right">- Rs. {money(sale?.discount || 0)}</span>
                    </div>
                    <div className="border-t-2 border-black pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-bold text-base">TOTAL</span>
                        <span className="font-bold text-lg">Rs. {money(sale?.total || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms Section */}
                <div className="border border-gray-300 p-4 mb-8">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Terms</div>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                    <li>Goods sold not returnable</li>
                    <li>Check items before leaving</li>
                    <li>Warranty per manufacturer</li>
                  </ul>
                </div>

                {/* Signature Lines */}
                <div className="grid grid-cols-2 gap-8 mt-12">
                  <div className="text-center">
                    <div className="border-t border-dashed border-gray-400 pt-2">
                      <div className="text-xs text-gray-500 mt-1">Customer</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-dashed border-gray-400 pt-2">
                      <div className="text-xs text-gray-500 mt-1">Authorized</div>
                      <div className="text-xs font-medium mt-1">{sale?.cashier?.full_name || ""}</div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500 mt-12">
                  Thank you! • {new Date().toLocaleString("en-LK")}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}