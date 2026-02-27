import { useCallback, useEffect, useMemo, useState } from "react";
import NotificationTable from "./NotificationTable";
import { supabase } from "../../supabaseClient";

const TABLE = "notifications";
const ID_COL = "notification_id";

export default function Notifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const currentEmployeeId = useMemo(() => {
    const v = localStorage.getItem("employee_id");
    return v ? Number(v) : null;
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!currentEmployeeId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const res = await supabase
        .from(TABLE)
        .select(
          `
          ${ID_COL},
          to_employee_id,
          job_id,
          type,
          message,
          changed_by_employee_id,
          is_read,
          created_at,
          is_deleted
        `
        )
        .eq("is_deleted", false)
        .eq("to_employee_id", currentEmployeeId)
        .order(ID_COL, { ascending: false });

      if (res.error) throw res.error;
      setRows(res.data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load notifications");
      setRows([]);
    }

    setLoading(false);
  }, [currentEmployeeId]);

  useEffect(() => {
    fetchNotifications();
    if (!currentEmployeeId) return;

    const ch = supabase
      .channel(`notif-emp-${currentEmployeeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLE,
          filter: `to_employee_id=eq.${currentEmployeeId}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [currentEmployeeId, fetchNotifications]);

  async function markAllRead() {
    if (!currentEmployeeId) return;

    try {
      const res = await supabase
        .from(TABLE)
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("is_deleted", false)
        .eq("is_read", false)
        .eq("to_employee_id", currentEmployeeId);

      if (res.error) throw res.error;
      await fetchNotifications();
    } catch (e) {
      alert(e?.message || "Failed to mark all read");
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            Notifications
          </h1>
          <p className="text-sm text-gray-500">
            Job created/claimed/status change updates.
          </p>
        </div>

        <button
          onClick={markAllRead}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          disabled={!currentEmployeeId}
        >
          Mark all read
        </button>
      </div>

      {!currentEmployeeId ? (
        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          Login to see notifications.
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-4">
        <NotificationTable rows={rows} loading={loading} onChanged={fetchNotifications} />
      </div>
    </div>
  );
}