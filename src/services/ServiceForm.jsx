import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function ServiceForm({ initialValue, onClose, onSaved }) {
  const isEdit = !!initialValue?.service_id;

  const [name, setName] = useState(initialValue?.name || "");
  const [price, setPrice] = useState(
    initialValue?.price !== null && initialValue?.price !== undefined
      ? String(initialValue.price)
      : ""
  );
  const [is_active, setIsActive] = useState(initialValue?.is_active ?? true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const priceNum = useMemo(() => {
    const n = Number(price);
    return Number.isFinite(n) ? n : NaN;
  }, [price]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!Number.isFinite(priceNum) || priceNum < 0) return false;
    return true;
  }, [name, priceNum]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setErr("");

    const payload = {
      name: name.trim(),
      price: priceNum,
      is_active,
      updated_at: new Date().toISOString(),
    };

    let res;
    if (isEdit) {
      res = await supabase
        .from("services")
        .update(payload)
        .eq("service_id", initialValue.service_id)
        .select("service_id")
        .single();
    } else {
      res = await supabase
        .from("services")
        .insert(payload)
        .select("service_id")
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
              {isEdit ? "Edit Service" : "Add Service"}
            </div>
            <div className="text-sm text-gray-500">
              Enter service name and price.
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
            <Field label="Service Name" required>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Eg: Screen Replacement"
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