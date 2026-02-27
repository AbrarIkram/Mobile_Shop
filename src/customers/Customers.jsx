import { useEffect, useState } from "react";
import CustomerTable from "./CustomerTable";
import CustomerForm from "./CustomerForm";
import { supabase } from "../../supabaseClient";

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function fetchCustomers() {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("customers")
      .select(
        "customer_id, full_name, mobile_number, address, national_id, created_at"
      )
      .eq("is_deleted", false)
      .order("customer_id", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            Customers
          </h1>
          <p className="text-sm text-gray-500">
            Manage customer details and contact information.
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
          <span className="text-sm font-medium">Add Customer</span>
        </button>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-4">
        <CustomerTable
          rows={rows}
          loading={loading}
          onEdit={(row) => {
            setEditing(row);
            setOpenForm(true);
          }}
          onChanged={fetchCustomers}
        />
      </div>

      {openForm ? (
        <CustomerForm
          initialValue={editing}
          onClose={() => setOpenForm(false)}
          onSaved={async () => {
            setOpenForm(false);
            await fetchCustomers();
          }}
        />
      ) : null}
    </div>
  );
}