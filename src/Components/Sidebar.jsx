import React from "react";

const ALL_NAV = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "jobs", label: "Repair Jobs", icon: "tools" },
  { key: "sales", label: "Sales", icon: "receipt" },
  { key: "products", label: "Products", icon: "box" },
  { key: "services", label: "Services", icon: "service" },
  { key: "customers", label: "Customers", icon: "users" },
  { key: "staff", label: "Users", icon: "staff" },
  { key: "notifications", label: "Notifications", icon: "bell" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export default function Sidebar({
  active,
  onChange,
  mobileOpen,
  onCloseMobile,
  onLogout,
  user,
}) {
  const isAdmin = user?.role === "Superadmin" || user?.role === "Admin";
  const allowedKeys = Array.isArray(user?.sidebar_keys)
    ? user.sidebar_keys
    : [];

  const navToShow = ALL_NAV.filter((item) => {
    // Only Admin/Superadmin can see Settings + Users
    if (item.key === "settings" || item.key === "staff") return isAdmin;

    // Admin sees all other pages
    if (isAdmin) return true;

    // Non-admin sees only what admin enabled
    return allowedKeys.includes(item.key);
  });

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onCloseMobile}
      />

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-50 md:z-auto top-0 left-0 h-full w-[280px] bg-white border-r border-gray-200 shadow-sm md:shadow-none transform transition-transform
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white font-bold">
              MS
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-gray-900">Mobile Shop</div>
              <div className="text-xs text-gray-500">Repair & POS</div>
            </div>
          </div>

          <button
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50"
            onClick={onCloseMobile}
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          {/* User Card */}
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Signed in as</div>

            <div className="mt-1 font-semibold text-gray-900">
              {user?.full_name || "User"} ({user?.role || "Role"})
            </div>

            <div className="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-lg bg-black text-white">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Online
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-4 space-y-1">
            {navToShow.map((item) => {
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onChange(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition
                    ${
                      isActive
                        ? "bg-black text-white"
                        : "hover:bg-gray-100 text-gray-800"
                    }`}
                >
                  <Icon name={item.icon} active={isActive} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}

            {/* Fallback if nothing allowed */}
            {!isAdmin && navToShow.length === 0 ? (
              <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                No menu items enabled for your role. Ask Admin to enable access
                in Settings.
              </div>
            ) : null}
          </div>

          {/* Logout */}
          <div className="mt-6 border-t border-gray-200 pt-4">
            <button
              onClick={() => {
                localStorage.removeItem("employee_id");
                localStorage.removeItem("role");
                localStorage.removeItem("full_name");
                localStorage.removeItem("sidebar_keys");
                onLogout?.();
                onCloseMobile?.();
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 hover:bg-gray-50 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ================= ICON COMPONENT ================= */

function Icon({ name, active }) {
  const base = `w-5 h-5 ${active ? "text-white" : "text-gray-500"}`;

  switch (name) {
    case "dashboard":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM13 3v4h8V3h-8zM3 21v-4h8v4H3z" />
        </svg>
      );

    case "tools":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M14.7 6.3a4 4 0 11-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4z" />
        </svg>
      );

    case "receipt":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M4 4h16v16l-3-2-3 2-3-2-3 2-3-2V4z" />
        </svg>
      );

    case "box":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M3 7l9-4 9 4-9 4-9-4z" />
          <path d="M3 7v10l9 4 9-4V7" />
        </svg>
      );

    case "service":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 8v8M8 12h8" />
        </svg>
      );

    case "users":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M17 21v-2a4 4 0 00-8 0v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );

    case "staff":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="9" cy="7" r="4" />
          <path d="M17 11l2 2-4 4-2-2 4-4z" />
        </svg>
      );

    case "bell":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M15 17h5l-1.5-2A2 2 0 0118 14V9a6 6 0 10-12 0v5a2 2 0 01-.5 1L4 17h5" />
        </svg>
      );

    case "settings":
      return (
        <svg
          className={base}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1 .6 1.65 1.65 0 00-.33 1.82V22a2 2 0 11-4 0v-.06a1.65 1.65 0 00-.33-1.82 1.65 1.65 0 00-1-.6 1.65 1.65 0 00-1 .6 1.65 1.65 0 00-.33 1.82V22a2 2 0 11-4 0v-.06a1.65 1.65 0 00-.33-1.82" />
        </svg>
      );

    default:
      return null;
  }
}
