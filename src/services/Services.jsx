import { useEffect, useState } from "react";
import ServiceTable from "./ServiceTable";
import ServiceForm from "./ServiceForm";
import { supabase } from "../../supabaseClient";

export default function Services() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function fetchServices() {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("services")
      .select("service_id, name, price, is_active, created_at")
      .eq("is_deleted", false)
      .order("service_id", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            Services
          </h1>
          <p className="text-sm text-gray-500">
            Add and manage repair services with pricing.
          </p>
        </div>

        <button
          onClick={() => {
            setEditing(null);
            setOpenForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
        >
          <span className="text-lg leading-none">+</span>
          <span className="text-sm font-medium">Add Service</span>
        </button>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-4">
        <ServiceTable
          rows={rows}
          loading={loading}
          onEdit={(row) => {
            setEditing(row);
            setOpenForm(true);
          }}
          onChanged={fetchServices}
        />
      </div>

      {openForm ? (
        <ServiceForm
          initialValue={editing}
          onClose={() => setOpenForm(false)}
          onSaved={async () => {
            setOpenForm(false);
            await fetchServices();
          }}
        />
      ) : null}
    </div>
  );
}