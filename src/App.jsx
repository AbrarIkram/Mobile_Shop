import { useEffect, useMemo, useState } from "react";
import Sidebar from "./Components/Sidebar";
import Settings from "./settings/Settings";
import Staff from "./staffs/Staff";
import Customers from "./customers/Customers";
import Products from "./products/Products";
import Services from "./services/Services";
import RepairJobs from "./repairjobs/RepairJobs";
import Sales from "./sales/Sales";
import Notifications from "./notifications/Notifications";
import Login from "./Components/Login";
import Dashboard from "./dashboards/Dashboard"; // ✅ ADD THIS
import { supabase } from "../supabaseClient";

function TopBar({ title, onToggleSidebar, onOpenNotifications, unreadCount }) {
  return (
    <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNotifications}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            title="Notifications"
          >
            <span className="relative inline-flex items-center">
              🔔
              {unreadCount > 0 ? (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white text-[11px] leading-[18px] text-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </span>
            <span className="text-sm">Notifications</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PageShell({ children }) {
  return (
    <div className="p-4 md:p-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}

function Placeholder({ title, desc }) {
  return (
    <div className="space-y-2">
      <div className="text-xl font-semibold text-gray-900">{title}</div>
      <div className="text-gray-600">{desc}</div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Quick Action</div>
          <div className="mt-1 font-semibold">Create new</div>
          <button className="mt-3 w-full rounded-lg bg-black text-white py-2 hover:opacity-90">
            + Add
          </button>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Stats</div>
          <div className="mt-1 font-semibold">Coming soon</div>
          <div className="mt-3 h-10 rounded-lg bg-gray-100" />
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Recent</div>
          <div className="mt-1 font-semibold">Coming soon</div>
          <div className="mt-3 h-10 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [user, setUser] = useState(() => {
    const id = localStorage.getItem("employee_id");
    const role = localStorage.getItem("role");
    const full_name = localStorage.getItem("full_name");

    const sidebar_keys_raw = localStorage.getItem("sidebar_keys");
    let sidebar_keys = [];
    try {
      sidebar_keys = sidebar_keys_raw ? JSON.parse(sidebar_keys_raw) : [];
    } catch {
      sidebar_keys = [];
    }

    if (id && role) {
      return {
        employee_id: Number(id),
        role,
        full_name: full_name || "",
        sidebar_keys,
      };
    }

    return null;
  });

  const isRepairman = user?.role === "Repairman";

  // ✅ notifications realtime signals
  const [notifPing, setNotifPing] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ toast popup (repairman only)
  const [toast, setToast] = useState(null);
  function showToast(message, jobId) {
    setToast({ message, jobId: jobId || null });
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(null), 5000);
  }

  // ✅ MUST stay above conditional return
  const title = useMemo(() => {
    const map = {
      dashboard: "Dashboard",
      jobs: "Repair Jobs",
      sales: "Sales",
      products: "Products",
      services: "Services",
      customers: "Customers",
      staff: "Users",
      notifications: "Notifications",
      settings: "Settings",
    };
    return map[active] || "Dashboard";
  }, [active]);

  function logout() {
    localStorage.removeItem("employee_id");
    localStorage.removeItem("role");
    localStorage.removeItem("full_name");
    localStorage.removeItem("sidebar_keys");
    setUser(null);
    setActive("dashboard");
  }

  useEffect(() => {
    if (!user?.employee_id) return;

    async function syncAccess() {
      const { data, error } = await supabase
        .from("employees")
        .select("sidebar_keys, role, full_name, is_active")
        .eq("employee_id", user.employee_id)
        .eq("is_deleted", false)
        .maybeSingle();

      if (error || !data) return;

      if (!data.is_active) {
        logout();
        return;
      }

      localStorage.setItem(
        "sidebar_keys",
        JSON.stringify(data.sidebar_keys || []),
      );
      localStorage.setItem("role", data.role);
      localStorage.setItem("full_name", data.full_name);

      setUser((prev) => ({
        ...prev,
        role: data.role,
        full_name: data.full_name,
        sidebar_keys: data.sidebar_keys || [],
      }));
    }

    syncAccess();
  }, [user?.employee_id]);

  // ✅ load unread count + realtime updates
  useEffect(() => {
    if (!user?.employee_id) return;

    async function loadUnread() {
      const employeeId = user.employee_id;

      const { data, error } = await supabase
        .from("notifications")
        .select(
          "notification_id, to_employee_id, job_id, type, message, is_read, created_at",
        )
        .eq("is_deleted", false)
        .eq("is_read", false)
        .eq("to_employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Unread error:", error);
        return;
      }

      // ✅ badge only for repairman
      setUnreadCount(isRepairman ? data?.length || 0 : 0);
    }

    loadUnread();

    const channel = supabase
      .channel(`notif-stream-${user.employee_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new;

          const isMine =
            n.to_employee_id &&
            Number(n.to_employee_id) === Number(user.employee_id);

          if (!isMine) return;

          // ✅ ONLY repairman gets popup + badge count
          if (user?.role === "Repairman") {
            // badge count increase ONLY for unread inserts
            if (!n.is_read && !n.is_deleted) {
              setUnreadCount((c) => c + 1);
            }

            // popup ONLY for job created
            if (n.type === "Job Created") {
              showToast(
                n.message || `New job received (#${n.job_id})`,
                n.job_id,
              );
              setActive("jobs"); // optional auto open jobs page
            }

            setNotifPing((x) => x + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        () => {
          loadUnread();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.employee_id, user?.role, isRepairman]);

  const renderPage = () => {
    switch (active) {
      case "dashboard":
        return <Dashboard />; // ✅ USE REAL DASHBOARD
      case "staff":
        return <Staff />;
      case "customers":
        return <Customers />;
      case "products":
        return <Products />;
      case "services":
        return <Services />;
      case "jobs":
        return <RepairJobs />;
      case "sales":
        return <Sales />;
      case "notifications":
        return (
          <Notifications
            user={user}
            notifPing={notifPing}
            onReadAll={() => setUnreadCount(0)}
          />
        );
      case "settings":
        return (
          <PageShell>
            {user?.role === "Superadmin" || user?.role === "Admin" ? (
              <Settings user={user} />
            ) : (
              <Placeholder
                title="No Access"
                desc="Only Admin/Superadmin can access Settings."
              />
            )}
          </PageShell>
        );
      default:
        return (
          <PageShell>
            <Placeholder title="Not Found" desc="Page not found." />
          </PageShell>
        );
    }
  };

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar
          active={active}
          onChange={(key) => {
            setActive(key);
            setMobileSidebarOpen(false);
          }}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          user={user}
          onLogout={logout}
        />

        <div className="flex-1 min-w-0">
          <TopBar
            title={title}
            onToggleSidebar={() => setMobileSidebarOpen((v) => !v)}
            onOpenNotifications={() => {
              setActive("notifications");
              setMobileSidebarOpen(false);
            }}
            unreadCount={isRepairman ? unreadCount : 0}
          />

          {renderPage()}
        </div>
      </div>

      {/* ✅ Repairman popup toast */}
      {isRepairman && toast ? (
        <div className="fixed bottom-4 right-4 z-[9999]">
          <button
            onClick={() => {
              setActive("jobs");
              setToast(null);
            }}
            className="text-left max-w-sm rounded-2xl bg-black text-white px-4 py-3 shadow-xl hover:opacity-95"
            title="Open Jobs"
          >
            <div className="text-sm font-semibold">New Job</div>
            <div className="text-sm opacity-90 mt-1">{toast.message}</div>
            {toast.jobId ? (
              <div className="text-xs opacity-70 mt-2">
                Click to open Jobs (#{toast.jobId})
              </div>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
