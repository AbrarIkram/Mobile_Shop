import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function ProductForm({ initialValue, onClose, onSaved }) {
  const isEdit = !!initialValue?.product_id;

  const [name, setName] = useState(initialValue?.name || "");
  const [model, setModel] = useState(initialValue?.model || "");
  const [cost, setCost] = useState(
    initialValue?.cost !== null && initialValue?.cost !== undefined
      ? String(initialValue.cost)
      : ""
  );
  const [price, setPrice] = useState(
    initialValue?.price !== null && initialValue?.price !== undefined
      ? String(initialValue.price)
      : ""
  );
  const [stock_qty, setStockQty] = useState(
    initialValue?.stock_qty !== null && initialValue?.stock_qty !== undefined
      ? String(initialValue.stock_qty)
      : "0"
  );
  const [low_stock_limit, setLowStockLimit] = useState(
    initialValue?.low_stock_limit !== null &&
      initialValue?.low_stock_limit !== undefined
      ? String(initialValue.low_stock_limit)
      : "5"
  );
  const [is_active, setIsActive] = useState(initialValue?.is_active ?? true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const parsed = useMemo(() => {
    const c = Number(cost);
    const p = Number(price);
    const s = Number(stock_qty);
    const l = Number(low_stock_limit);

    return {
      costNum: Number.isFinite(c) ? c : NaN,
      priceNum: Number.isFinite(p) ? p : NaN,
      stockNum: Number.isFinite(s) ? s : NaN,
      limitNum: Number.isFinite(l) ? l : NaN,
    };
  }, [cost, price, stock_qty, low_stock_limit]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!Number.isFinite(parsed.costNum) || parsed.costNum < 0) return false;
    if (!Number.isFinite(parsed.priceNum) || parsed.priceNum < 0) return false;
    if (!Number.isFinite(parsed.stockNum) || parsed.stockNum < 0) return false;
    if (!Number.isFinite(parsed.limitNum) || parsed.limitNum < 0) return false;
    return true;
  }, [name, parsed]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setErr("");

    const payload = {
      name: name.trim(),
      model: model.trim() || null,
      cost: parsed.costNum,
      price: parsed.priceNum,
      stock_qty: Math.floor(parsed.stockNum),
      low_stock_limit: Math.floor(parsed.limitNum),
      is_active,
      updated_at: new Date().toISOString(),
    };

    let res;
    if (isEdit) {
      res = await supabase
        .from("products")
        .update(payload)
        .eq("product_id", initialValue.product_id)
        .select("product_id")
        .single();
    } else {
      res = await supabase
        .from("products")
        .insert(payload)
        .select("product_id")
        .single();
    }

    if (res.error) {
      setErr(res.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={saving ? undefined : onClose}
      />

      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {isEdit ? "Edit Product" : "Add Product"}
            </div>
            <div className="text-sm text-gray-500">
              Enter product info and stock settings.
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

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Product Name" required>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Eg: iPhone Charger"
              />
            </Field>

            <Field label="Model">
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Eg: iPhone 14 / USB-C"
              />
            </Field>

            <Field label="Cost" required>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field label="Price" required>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field label="Stock Qty" required>
              <input
                inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={stock_qty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder="0"
              />
            </Field>

            <Field label="Low Stock Limit" required>
              <input
                inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={low_stock_limit}
                onChange={(e) => setLowStockLimit(e.target.value)}
                placeholder="5"
              />
            </Field>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={is_active}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={saving ? undefined : onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || saving}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-gray-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </div>
      {children}
    </div>
  );
}