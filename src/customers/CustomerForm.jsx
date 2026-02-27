import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function CustomerForm({ initialValue, onClose, onSaved }) {
  const isEdit = !!initialValue?.customer_id;

  const [full_name, setFullName] = useState(initialValue?.full_name || "");
  const [mobile_number, setMobile] = useState(initialValue?.mobile_number || "");
  const [national_id, setNationalId] = useState(initialValue?.national_id || "");
  const [address, setAddress] = useState(initialValue?.address || "");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const canSave = useMemo(() => {
    if (!full_name.trim()) return false;
    // mobile is optional in your table, but usually useful:
    // keep optional to match DB
    return true;
  }, [full_name]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setErr("");

    const payload = {
      full_name: full_name.trim(),
      mobile_number: mobile_number.trim() || null,
      national_id: national_id.trim() || null,
      address: address.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let res;
    if (isEdit) {
      res = await supabase
        .from("customers")
        .update(payload)
        .eq("customer_id", initialValue.customer_id)
        .select("customer_id")
        .single();
    } else {
      res = await supabase
        .from("customers")
        .insert(payload)
        .select("customer_id")
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
              {isEdit ? "Edit Customer" : "Add Customer"}
            </div>
            <div className="text-sm text-gray-500">
              Save customer details for repairs and sales.
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
            <Field label="Full Name" required>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={full_name}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Customer name"
              />
            </Field>

            <Field label="Mobile Number">
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={mobile_number}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+94..."
              />
            </Field>

            <Field label="National ID">
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={national_id}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="NIC (optional)"
              />
            </Field>
          </div>

          <Field label="Address">
            <textarea
              className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 min-h-[90px]"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address (optional)"
            />
          </Field>

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