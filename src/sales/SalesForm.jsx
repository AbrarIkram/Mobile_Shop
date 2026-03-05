import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const PAYMENTS = ["Cash", "Card", "Online"];

export default function SalesForm({ jobId, createdByEmployeeId, onClose, onSaved }) {
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoiceSaleId, setInvoiceSaleId] = useState(null);

  const [jobInfo, setJobInfo] = useState(null);
  const [customerId, setCustomerId] = useState(null);

  // Walk-in customer search
  const [customerSearch, setCustomerSearch] = useState("");

  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Load refs
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoadingRefs(true);
      setErr("");

      const [srvRes, prodRes, custRes] = await Promise.all([
        supabase
          .from("services")
          .select("service_id, name, price")
          .eq("is_deleted", false)
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("products")
          .select("product_id, name, model, cost, price, stock_qty, low_stock_limit")
          .eq("is_deleted", false)
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("customers")
          .select("customer_id, full_name, mobile_number")
          .eq("is_deleted", false)
          .order("customer_id", { ascending: false })
          .limit(200),
      ]);

      if (!alive) return;

      if (srvRes.error) return fail(srvRes.error.message);
      if (prodRes.error) return fail(prodRes.error.message);
      if (custRes.error) return fail(custRes.error.message);

      setServices(srvRes.data || []);
      setProducts(prodRes.data || []);
      setCustomers(custRes.data || []);

      // If sale from job, lock customerId from job
      if (jobId) {
        const { data, error } = await supabase
          .from("repair_jobs")
          .select(`
            job_id,
            customer_id,
            mobile_name,
            mobile_model,
            status,
            customers:customers ( full_name, mobile_number, address )
          `)
          .eq("job_id", jobId)
          .maybeSingle();

        if (error) return fail(error.message);

        setJobInfo(data || null);
        setCustomerId(data?.customer_id || null);
      } else {
        setJobInfo(null);
        setCustomerId(null); // for walk-in user must select if they want
      }

      setLoadingRefs(false);
    }

    function fail(msg) {
      setErr(msg);
      setLoadingRefs(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [jobId]);

  // totals
  const totals = useMemo(() => {
    const serviceTotal = selectedServices.reduce(
      (sum, s) => sum + Number(s.unit_price || 0),
      0
    );

    const productTotal = selectedProducts.reduce((sum, p) => {
      const qty = Number(p.qty || 0);
      const unit = Number(p.unit_price || 0);
      return sum + qty * unit;
    }, 0);

    const subtotal = serviceTotal + productTotal;

    const discN = Number(discount);
    const disc = Number.isFinite(discN) ? discN : NaN;

    const total = Number.isFinite(disc) ? Math.max(0, subtotal - disc) : NaN;

    return { serviceTotal, productTotal, subtotal, disc, total };
  }, [selectedServices, selectedProducts, discount]);

  // ✅ show why button disabled
  const disableReasons = useMemo(() => {
    const reasons = [];

    if (!createdByEmployeeId) reasons.push("No employee_id (login not set).");
    if (!PAYMENTS.includes(paymentMethod)) reasons.push("Invalid payment method.");

    const hasItems = selectedServices.length > 0 || selectedProducts.length > 0;
    if (!hasItems) reasons.push("Add at least 1 service or product.");

    for (const p of selectedProducts) {
      const qty = Number(p.qty);
      if (!Number.isFinite(qty) || qty < 1) reasons.push(`Invalid qty for ${p.name}.`);
      if (Number.isFinite(qty) && qty > Number(p.stock_qty)) reasons.push(`Qty > stock for ${p.name}.`);
    }

    if (!Number.isFinite(totals.disc) || totals.disc < 0) reasons.push("Discount must be a valid number ≥ 0.");
    if (!Number.isFinite(totals.total)) reasons.push("Total is invalid (check discount).");

    return reasons;
  }, [createdByEmployeeId, paymentMethod, selectedServices, selectedProducts, totals.disc, totals.total]);

  const canSave = disableReasons.length === 0 && !saving;

  // customer search filter (walk-in)
  const filteredCustomers = useMemo(() => {
    const s = customerSearch.trim().toLowerCase();
    if (!s) return customers.slice(0, 50);
    return customers
      .filter((c) => {
        const a = (c.full_name || "").toLowerCase();
        const b = (c.mobile_number || "").toLowerCase();
        return a.includes(s) || b.includes(s);
      })
      .slice(0, 50);
  }, [customers, customerSearch]);

  function addService(service_id) {
    const s = services.find((x) => x.service_id === Number(service_id));
    if (!s) return;
    if (selectedServices.some((x) => x.service_id === s.service_id)) return;

    setSelectedServices((prev) => [
      ...prev,
      { service_id: s.service_id, name: s.name, unit_price: Number(s.price) },
    ]);
  }

  function removeService(service_id) {
    setSelectedServices((prev) => prev.filter((x) => x.service_id !== service_id));
  }

  function addProduct(product_id) {
    const p = products.find((x) => x.product_id === Number(product_id));
    if (!p) return;
    if (selectedProducts.some((x) => x.product_id === p.product_id)) return;

    setSelectedProducts((prev) => [
      ...prev,
      {
        product_id: p.product_id,
        name: p.name,
        unit_price: Number(p.price),
        unit_cost: Number(p.cost),
        stock_qty: Number(p.stock_qty ?? 0),
        qty: 1,
      },
    ]);
  }

  function removeProduct(product_id) {
    setSelectedProducts((prev) => prev.filter((x) => x.product_id !== product_id));
  }

  function changeQty(product_id, qtyStr) {
    setSelectedProducts((prev) =>
      prev.map((x) => (x.product_id === product_id ? { ...x, qty: qtyStr } : x))
    );
  }

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0.00";
    return v.toFixed(2);
  }

  async function handleSave() {
    if (!canSave) return;

    setSaving(true);
    setErr("");

    try {
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          job_id: jobId || null,
          customer_id: customerId || null,
          created_by_employee_id: createdByEmployeeId,
          subtotal: totals.subtotal,
          discount: totals.disc,
          total: totals.total,
          payment_method: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .select("sale_id")
        .single();

      if (saleErr) throw saleErr;

      // services items
      if (selectedServices.length > 0) {
        const srvItems = selectedServices.map((s) => ({
          sale_id: sale.sale_id,
          item_type: "Service",
          service_id: s.service_id,
          product_id: null,
          quantity: 1,
          unit_price: Number(s.unit_price),
          unit_cost: null,
          line_total: Number(s.unit_price),
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from("sale_items").insert(srvItems);
        if (error) throw error;
      }

      // product items + stock update
      if (selectedProducts.length > 0) {
        const prodItems = selectedProducts.map((p) => {
          const qty = Number(p.qty);
          return {
            sale_id: sale.sale_id,
            item_type: "Product",
            product_id: p.product_id,
            service_id: null,
            quantity: qty,
            unit_price: Number(p.unit_price),
            unit_cost: Number(p.unit_cost),
            line_total: qty * Number(p.unit_price),
            updated_at: new Date().toISOString(),
          };
        });

        const { error } = await supabase.from("sale_items").insert(prodItems);
        if (error) throw error;

        for (const p of selectedProducts) {
          const qty = Number(p.qty);
          const newStock = Math.max(0, Number(p.stock_qty) - qty);

          const { error: stockErr } = await supabase
            .from("products")
            .update({ stock_qty: newStock, updated_at: new Date().toISOString() })
            .eq("product_id", p.product_id);

          if (stockErr) throw stockErr;
        }
      }

      setSaving(false);
      onSaved?.();
    } catch (e) {
      setSaving(false);
      setErr(e?.message || "Failed to save sale (check RLS / policies / required fields).");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} />

      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-200 relative w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-lg font-semibold text-gray-900">New Sale</div>
            <div className="text-sm text-gray-500">
              {jobInfo ? `From Job #${jobInfo.job_id}` : "Walk-in sale"}
            </div>
          </div>

          <button
            onClick={saving ? undefined : onClose}
            className="h-10 w-10 rounded-xl border border-gray-200 hover:bg-gray-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          {!canSave && disableReasons.length > 0 ? (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              <div className="font-semibold mb-1">Can’t complete sale because:</div>
              <ul className="list-disc pl-5 space-y-1">
                {disableReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {loadingRefs ? (
            <div className="text-sm text-gray-600">Loading services/products/customers...</div>
          ) : (
            <>
              {/* ✅ Customer select for walk-in */}
              {!jobInfo ? (
                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-900">Customer</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Search</div>
                      <input
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search name / mobile"
                      />
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-700">Select Customer (optional)</div>
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={customerId || ""}
                        onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">-- No customer --</option>
                        {filteredCustomers.map((c) => (
                          <option key={c.customer_id} value={c.customer_id}>
                            {c.full_name} {c.mobile_number ? `(${c.mobile_number})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">Job Details</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <Info label="Customer" value={jobInfo.customers?.full_name || "-"} />
                    <Info label="Mobile" value={jobInfo.customers?.mobile_number || "-"} />
                    <Info label="Device" value={`${jobInfo.mobile_name} ${jobInfo.mobile_model || ""}`} />
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Services */}
                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">Services</div>
                    <select
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        addService(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        + Add service
                      </option>
                      {services.map((s) => (
                        <option key={s.service_id} value={s.service_id}>
                          {s.name} — {money(s.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedServices.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-500">No services added.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedServices.map((s) => (
                        <div
                          key={s.service_id}
                          className="flex items-center justify-between rounded-xl border border-gray-200 p-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                            <div className="text-xs text-gray-500">{money(s.unit_price)}</div>
                          </div>
                          <button
                            onClick={() => removeService(s.service_id)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Products */}
                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">Products</div>
                    <select
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        addProduct(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        + Add product
                      </option>
                      {products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.name} {p.model ? `(${p.model})` : ""} — {money(p.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProducts.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-500">No products added.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedProducts.map((p) => (
                        <div key={p.product_id} className="rounded-xl border border-gray-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                              <div className="text-xs text-gray-500">
                                Unit: {money(p.unit_price)} • Stock: {p.stock_qty}
                              </div>
                            </div>
                            <button
                              onClick={() => removeProduct(p.product_id)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mt-3 flex items-center gap-3">
                            <div className="text-sm text-gray-700">Qty</div>
                            <input
                              inputMode="numeric"
                              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                              value={p.qty}
                              onChange={(e) => changeQty(p.product_id, e.target.value)}
                            />
                            <div className="text-sm text-gray-700">
                              Line: {money((Number(p.qty) || 0) * Number(p.unit_price))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Info label="Services Total" value={money(totals.serviceTotal)} />
                  <Info label="Products Total" value={money(totals.productTotal)} />
                  <Info label="Subtotal" value={money(totals.subtotal)} />
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Discount</div>
                    <input
                      inputMode="decimal"
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-700">Payment Method</div>
                    <select
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      {PAYMENTS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {money(totals.total)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={saving ? undefined : onClose}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={handleSave}
                    className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {saving ? "Saving..." : "Complete Sale"}
                  </button>
                </div>
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