import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { supabase } from "../../supabaseClient";

export default function RepairJobForm({
  createdByEmployeeId,
  onClose,
  onSaved,
  initialJob = null,
  mode = "create",
}) {
  // Customer fields
  const [custName, setCustName] = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custNIC, setCustNIC] = useState("");

  const [customerOptions, setCustomerOptions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Mobile fields
  const [mobileName, setMobileName] = useState("");
  const [mobileModel, setMobileModel] = useState("");
  const [notes, setNotes] = useState("");

  // Photos (max 6)
  const [files, setFiles] = useState([]); // File[]
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const canSave = useMemo(() => {
    if (!custName.trim()) return false;
    if (!custMobile.trim()) return false;
    if (!mobileName.trim()) return false;
    if (files.length > 6) return false;
    return true;
  }, [custName, custMobile, mobileName, files.length]);

  useEffect(() => {
    async function fetchCustomers() {
      setLoadingCustomers(true);

      const { data, error } = await supabase
        .from("customers")
        .select("customer_id, full_name, mobile_number, address, national_id")
        .eq("is_deleted", false)
        .order("full_name", { ascending: true });

      if (!error && data) {
        const mapped = data.map((c) => ({
          value: c.customer_id,
          label: `${c.full_name} (${c.mobile_number || "No Mobile"})`,
          raw: c,
        }));
        setCustomerOptions(mapped);
      }

      setLoadingCustomers(false);
    }

    fetchCustomers();
  }, []);

  // ✅ Autofill when edit
  useEffect(() => {
    if (mode !== "edit" || !initialJob) return;

    const c = initialJob.customers || {};
    setCustName(c.full_name || "");
    setCustMobile(c.mobile_number || "");
    setCustAddress(c.address || ""); // will be empty if not selected in fetch
    setCustNIC(c.national_id || ""); // will be empty if not selected in fetch

    setMobileName(initialJob.mobile_name || "");
    setMobileModel(initialJob.mobile_model || "");
    setNotes(initialJob.notes || "");

    // Set selected customer (so it doesn't create a new one)
    if (initialJob.customer_id) {
      setSelectedCustomer({
        value: initialJob.customer_id,
        label: `${c.full_name || "Customer"} (${c.mobile_number || "No Mobile"})`,
        raw: {
          customer_id: initialJob.customer_id,
          full_name: c.full_name || "",
          mobile_number: c.mobile_number || "",
          address: c.address || "",
          national_id: c.national_id || "",
        },
      });
    }

    // edit mode: clear picked files initially
    setFiles([]);
  }, [mode, initialJob]);

  function onPickFiles(e) {
    const picked = Array.from(e.target.files || []);
    const merged = [...files, ...picked].slice(0, 6);
    setFiles(merged);
    e.target.value = "";
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setErr("");

    try {
      // ✅ 1) Decide customer_id
      let customerId = selectedCustomer?.value || null;

      // ✅ If customer not selected, create new
      if (!customerId) {
        const { data: customer, error: custErr } = await supabase
          .from("customers")
          .insert({
            full_name: custName.trim(),
            mobile_number: custMobile.trim(),
            address: custAddress.trim() || null,
            national_id: custNIC.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .select("customer_id")
          .single();

        if (custErr) throw custErr;
        customerId = customer.customer_id;
      } else {
        // ✅ If editing, optionally update existing customer details
        if (mode === "edit") {
          await supabase
            .from("customers")
            .update({
              full_name: custName.trim(),
              mobile_number: custMobile.trim(),
              address: custAddress.trim() || null,
              national_id: custNIC.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("customer_id", customerId);
        }
      }

      // ✅ 2) Create or Update job
      let jobId = initialJob?.job_id || null;

      if (mode === "edit" && jobId) {
        const { error: upErr } = await supabase
          .from("repair_jobs")
          .update({
            customer_id: customerId,
            mobile_name: mobileName.trim(),
            mobile_model: mobileModel.trim() || null,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobId);

        if (upErr) throw upErr;
      } else {
        const { data: job, error: jobErr } = await supabase
          .from("repair_jobs")
          .insert({
            customer_id: customerId,
            created_by_employee_id: createdByEmployeeId || null,
            mobile_name: mobileName.trim(),
            mobile_model: mobileModel.trim() || null,
            status: "Pending",
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .select("job_id")
          .single();

        if (jobErr) throw jobErr;
        jobId = job.job_id;

        // ✅ Notify only on CREATE
        const { data: emps, error: empErr } = await supabase
          .from("employees")
          .select("employee_id, role")
          .eq("is_deleted", false)
          .eq("is_active", true);

        if (!empErr && emps?.length) {
          const msg = `New job #${jobId} - ${custName.trim()} (${custMobile.trim()}) | ${mobileName.trim()} ${
            mobileModel.trim() || ""
          }`;

          const { error: notifErr } = await supabase.from("notifications").insert(
            emps.map((e) => ({
              to_employee_id: e.employee_id,
              job_id: jobId,
              type: "Job Created",
              message: msg,
              changed_by_employee_id: createdByEmployeeId || null,
              is_read: false,
              is_deleted: false,
              updated_at: new Date().toISOString(),
            }))
          );

          if (notifErr) console.warn("Notification insert failed:", notifErr.message);
        }
      }

      // ✅ 3) Upload photos (optional) — NO Supabase Auth required
      if (files.length > 0 && jobId) {
        const BUCKET = "job-photos"; // hardcode

        const guessContentType = (fileName) => {
          const ext = (fileName.split(".").pop() || "").toLowerCase();
          if (ext === "png") return "image/png";
          if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
          if (ext === "webp") return "image/webp";
          if (ext === "gif") return "image/gif";
          return "application/octet-stream";
        };

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const photoIndex = i + 1;

          const ext = (file.name.split(".").pop() || "png")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

          const safeFileName = `photo_${photoIndex}_${Date.now()}.${ext || "png"}`;
          const path = `jobs/${jobId}/${safeFileName}`;

          const contentType =
            file.type && file.type.includes("/") ? file.type : guessContentType(file.name);

          const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, {
              upsert: true,
              contentType,
              cacheControl: "3600",
            });

          if (uploadErr) throw new Error(uploadErr.message || "Upload failed");

          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const photoUrl = pub?.publicUrl || path;

          const { error: photoErr } = await supabase.from("repair_job_photos").insert({
            job_id: jobId,
            photo_url: photoUrl,
            photo_index: photoIndex,
            updated_at: new Date().toISOString(),
          });

          if (photoErr) throw photoErr;
        }
      }

      setSaving(false);
      onSaved?.();
    } catch (e2) {
      setSaving(false);
      setErr(e2?.message || "Something went wrong");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {mode === "edit" ? `Edit Repair Job #${initialJob?.job_id}` : "New Repair Job"}
            </div>
            <div className="text-sm text-gray-500">
              Enter customer + mobile details and upload up to 6 photos.
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

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
          {err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          {/* Customer Section */}
          <SectionTitle title="Customer Details" />

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Select Customer</div>

              <Select
                options={customerOptions}
                value={selectedCustomer}
                isLoading={loadingCustomers}
                onChange={(option) => {
                  setSelectedCustomer(option || null);

                  if (option?.raw) {
                    setCustName(option.raw.full_name || "");
                    setCustMobile(option.raw.mobile_number || "");
                    setCustAddress(option.raw.address || "");
                    setCustNIC(option.raw.national_id || "");
                  } else {
                    setCustName("");
                    setCustMobile("");
                    setCustAddress("");
                    setCustNIC("");
                  }
                }}
                placeholder="Search customer by name or mobile..."
                className="text-sm"
                classNamePrefix="react-select"
                isClearable
              />
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Customer Name" required>
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                />
              </Field>

              <Field label="Customer Mobile" required>
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  value={custMobile}
                  onChange={(e) => setCustMobile(e.target.value)}
                />
              </Field>

              <Field label="Customer NIC">
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  value={custNIC}
                  onChange={(e) => setCustNIC(e.target.value)}
                />
              </Field>

              <Field label="Customer Address">
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Mobile */}
          <SectionTitle title="Mobile Details" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Mobile Name" required>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={mobileName}
                onChange={(e) => setMobileName(e.target.value)}
                placeholder="Eg: iPhone"
              />
            </Field>

            <Field label="Mobile Model">
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={mobileModel}
                onChange={(e) => setMobileModel(e.target.value)}
                placeholder="Eg: 13 Pro"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 min-h-[90px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Problem description, password, etc..."
            />
          </Field>

          {/* Photos */}
          <SectionTitle title="Mobile Photos (max 6)" />
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              disabled={saving || files.length >= 6}
              className="block w-full text-sm"
            />

            {files.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {idx + 1}. {f.name}
                      </div>
                      <div className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="ml-3 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No photos selected. (You can add up to 6)</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
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
              {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionTitle({ title }) {
  return <div className="text-sm font-semibold text-gray-900">{title}</div>;
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