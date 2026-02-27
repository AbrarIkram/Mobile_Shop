import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const ROLES = ["Superadmin", "Admin", "Manager", "Cashier", "Repairman"];

export default function StaffForm({ initialValue, onClose, onSaved }) {
  const isEdit = !!initialValue?.employee_id;

  const [full_name, setFullName] = useState(initialValue?.full_name || "");
  const [email, setEmail] = useState(initialValue?.email || "");
  const [national_id, setNationalId] = useState(initialValue?.national_id || "");
  const [mobile_number, setMobile] = useState(initialValue?.mobile_number || "");
  const [address, setAddress] = useState(initialValue?.address || "");
  const [role, setRole] = useState(initialValue?.role || "Repairman");
  const [is_active, setIsActive] = useState(
    initialValue?.is_active ?? true
  );

  // password only required on create
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const canSave = useMemo(() => {
    if (!full_name.trim()) return false;
    if (!email.trim()) return false;
    if (!ROLES.includes(role)) return false;
    if (!isEdit && password.trim().length < 3) return false; // simple rule
    return true;
  }, [full_name, email, role, password, isEdit]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setErr("");

    // If you want to store bcrypt hash on server, do it in a secure backend.
    // For now: store raw is unsafe. Better approach:
    // - Use Supabase Auth OR your own Node API to hash.
    // Here we store plain ONLY if you insist. (Not recommended.)
    // To avoid unsafe behavior, we store a placeholder if editing and empty.
    const password_hash =
      isEdit && !password.trim()
        ? undefined
        : password.trim(); // replace with a hashed value via backend in production

    const payload = {
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      national_id: national_id.trim() || null,
      mobile_number: mobile_number.trim() || null,
      address: address.trim() || null,
      role,
      is_active,
      updated_at: new Date().toISOString(),
    };

    // only include password_hash if provided
    if (password_hash !== undefined) payload.password_hash = password_hash;

    let res;
    if (isEdit) {
      res = await supabase
        .from("employees")
        .update(payload)
        .eq("employee_id", initialValue.employee_id)
        .select("employee_id")
        .single();
    } else {
      res = await supabase
        .from("employees")
        .insert({
          ...payload,
          password_hash: payload.password_hash, // required on create
        })
        .select("employee_id")
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={saving ? undefined : onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {isEdit ? "Edit User" : "Add User"}
            </div>
            <div className="text-sm text-gray-500">
              Fill user details and save.
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
                placeholder="Eg: Mohamed Rizwan"
              />
            </Field>

            <Field label="Role" required>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Eg: staff@shop.com"
              />
            </Field>

            <Field label={isEdit ? "New Password (optional)" : "Password"} required={!isEdit}>
              <input
                type="password"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Leave empty to keep same" : "Min 3 chars"}
              />
            </Field>

            <Field label="National ID">
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={national_id}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="NIC"
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
          </div>

          <Field label="Address">
            <textarea
              className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 min-h-[90px]"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address..."
            />
          </Field>

          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={is_active}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>

            <div className="flex items-center gap-2">
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
          </div>

          <div className="text-xs text-gray-500">
            Note: For production, hash passwords via Supabase Auth or your backend API.
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