import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Armchair, Plus, Pencil, Trash2, Power } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const empty = { name: "", area: "Umum", capacity: 4, active: true };

export default function Tables() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/tables").then((r) => setItems(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama/kode meja wajib");
    try {
      if (editId) await api.put(`/tables/${editId}`, form);
      else await api.post("/tables", form);
      toast.success("Meja tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (t) => {
    if (!window.confirm(`Hapus meja ${t.name}?`)) return;
    try { const { data } = await api.delete(`/tables/${t.id}`); toast.success(data.reason || "Terhapus"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const toggle = async (t) => { try { await api.put(`/tables/${t.id}`, { ...t, active: !t.active }); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  const areas = [...new Set(items.map((t) => t.area))];

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Armchair /> Manajemen Meja</h1>
        <button data-testid="add-table-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}
          className="tap h-12 px-5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2"><Plus size={18} /> Tambah Meja</button>
      </div>
      {areas.map((area) => (
        <div key={area} className="mb-6">
          <div className="text-xs uppercase tracking-wider font-bold text-[#52525B] mb-2">{area}</div>
          <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-3">
            {items.filter((t) => t.area === area).map((t) => (
              <div key={t.id} data-testid={`table-${t.id}`}
                className={`rounded-xl border-2 p-3 ${!t.active ? "opacity-50 bg-white border-[#E4E4E7]" : t.status === "open_bill" ? "tbl-open_bill" : "tbl-empty"}`}>
                <div className="font-extrabold text-lg">{t.name}</div>
                <div className="text-[11px]">{t.capacity} kursi · {t.status === "open_bill" ? "OPEN BILL" : t.active ? "Kosong" : "Nonaktif"}</div>
                <div className="flex gap-1 mt-2">
                  <button data-testid={`edit-table-${t.id}`} onClick={() => { setForm(t); setEditId(t.id); setOpen(true); }} className="tap flex-1 h-8 rounded-lg bg-white/70 grid place-items-center"><Pencil size={13} /></button>
                  <button onClick={() => toggle(t)} className="tap h-8 w-8 rounded-lg bg-white/70 grid place-items-center"><Power size={13} /></button>
                  <button data-testid={`delete-table-${t.id}`} onClick={() => del(t)} className="tap h-8 w-8 rounded-lg bg-[#FEE2E2] text-[#EF4444] grid place-items-center"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Tambah"} Meja</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nama / Kode Meja"><input data-testid="table-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-11 rounded-xl border px-3" placeholder="Meja 1 / A1" /></Field>
            <Field label="Area"><input data-testid="table-area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="w-full h-11 rounded-xl border px-3" placeholder="Indoor / Outdoor" /></Field>
            <Field label="Kapasitas"><input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
          </div>
          <DialogFooter><button data-testid="save-table-btn" onClick={save} className="tap w-full h-12 rounded-xl bg-[#E63946] text-white font-bold">Simpan</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
const Field = ({ label, children }) => (
  <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label><div className="mt-1.5">{children}</div></div>
);
