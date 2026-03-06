import { useState } from "react";
import { supabase } from "../../supabaseClient";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState(""); // ← changed from email
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    // 🔍 Search by username (case-insensitive)
    const { data, error } = await supabase
      .from("employees")
      .select("employee_id, full_name, role, password_hash, is_active, sidebar_keys")
      .eq("username", username.trim().toLowerCase()) // ← lookup by username
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setErr("User not found");
      setLoading(false);
      return;
    }

    if (!data.is_active) {
      setErr("User is inactive");
      setLoading(false);
      return;
    }

    // ⚠️ WARNING: Plain text comparison is unsafe!
    // Use bcrypt/argon2 via Edge Function or Supabase Auth in production
    if (data.password_hash !== password.trim()) {
      setErr("Invalid password");
      setLoading(false);
      return;
    }

    // ✅ Store session
    localStorage.setItem("employee_id", data.employee_id);
    localStorage.setItem("role", data.role);
    localStorage.setItem("full_name", data.full_name);
    localStorage.setItem("sidebar_keys", JSON.stringify(data.sidebar_keys || []));

    setLoading(false);
    onLogin?.(data);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 p-6">
        <div className="text-xl font-semibold text-gray-900">Login</div>
        <div className="text-sm text-gray-500 mb-4">
          Superadmin / Admin / Manager / Cashier / Repairman
        </div>

        {err && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* 👤 Username Field */}
          <div>
            <div className="text-sm font-medium text-gray-700">Username</div>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-black/10"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., rizwan_admin"
              required
              autoComplete="username"
            />
          </div>

          {/* 🔐 Password Field */}
          <div>
            <div className="text-sm font-medium text-gray-700">Password</div>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black text-white py-2 hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}