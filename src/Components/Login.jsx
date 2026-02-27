import { useState } from "react";
import { supabase } from "../../supabaseClient";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const { data, error } = await supabase
      .from("employees")
      .select("employee_id, full_name, role, password_hash, is_active, sidebar_keys")
      .eq("email", email.trim().toLowerCase())
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

    // ⚠️ For now comparing plain text
    if (data.password_hash !== password.trim()) {
      setErr("Invalid password");
      setLoading(false);
      return;
    }

    // ✅ Store session in localStorage
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
        <div className="text-xl font-semibold text-gray-900">
          Login
        </div>
        <div className="text-sm text-gray-500 mb-4">
          Superadmin / Admin / Manager / Repairman
        </div>

        {err && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700">Email</div>
            <input
              type="email"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-black/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700">Password</div>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black text-white py-2 hover:opacity-90"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}