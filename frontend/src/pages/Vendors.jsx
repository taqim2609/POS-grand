import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Store, Plus, Pencil, Power, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const empty = { name: "", contact: "", note: "", active: true };

export default function Vendors() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/vendors").then((r) => setItems(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama vendor wajib diisi");
    try {
      if (editId) await api.put(`/vendors/${editId}`, form);
      else await api.post("/vendors", form);
      toast.success("Vendor tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (v) => {
    if (!window.confirm(`Hapus vendor ${v.name}?`)) return;
    try { const { data } = await api.delete(`/vendors/${v.id}`); toast.success(data.reason || "Terhapus"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const toggle = async (v) => { try { await api.put(`/vendors/${v.id}`, { ...v, active: !v.active }); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  return (
    <div className="h-full overflow-y-auto p-8" data-testid="vendors-page">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Store /> Vendor</h1>
        <button data-testid="add-vendor-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}
          className="tap h-12 px-5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2">
          <Plus size={18} /> Tambah
        </button>
      </div>
      <p className="text-sm text-[#52525B] mb-6">Vendor adalah pemilik produk titipan (bagi hasil). Produk bertipe <b>Vendor</b> dihubungkan ke salah satu vendor di sini.</p>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center text-[#52525B]">Belum ada vendor. Tambahkan vendor lalu buat produk bertipe "Vendor".</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((v) => (
            <div key={v.id} data-testid={`vendor-${v.id}`} className={`bg-white rounded-xl border p-4 ${!v.active && "opacity-60"}`}>
              <div className="font-bold text-lg">{v.name}</div>
              {v.contact && <div className="text-sm text-[#52525B] font-num">{v.contact}</div>}
              {v.note && <div className="text-xs text-[#a1a1aa] mt-1">{v.note}</div>}
              {!v.active && <span className="text-[11px] font-bold text-[#EF4444]">Nonaktif</span>}
              <div className="flex gap-1 mt-3">
                <button data-testid={`edit-vendor-${v.id}`} onClick={() => { setForm({ ...empty, ...v }); setEditId(v.id); setOpen(true); }} className="tap flex-1 h-9 rounded-lg bg-[#F4F5F7] flex items-center justify-center gap-1 text-sm font-bold"><Pencil size={14} /> Edit</button>
                <button onClick={() => toggle(v)} className="tap h-9 w-9 rounded-lg bg-[#F4F5F7] grid place-items-center"><Power size={15} /></button>
                <button data-testid={`delete-vendor-${v.id}`} onClick={() => del(v)} className="tap h-9 w-9 rounded-lg bg-[#FEE2E2] text-[#EF4444] grid place-items-center"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Tambah"} Vendor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nama Vendor"><input data-testid="vendor-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-11 rounded-xl border px-3" /></Field>
            <Field label="Kontak (No. HP / lainnya)"><input data-testid="vendor-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
            <Field label="Catatan"><textarea data-testid="vendor-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="w-full rounded-xl border px-3 py-2 resize-none" /></Field>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Vendor Aktif</label>
          </div>
          <DialogFooter><button data-testid="save-vendor-btn" onClick={save} className="tap w-full h-12 rounded-xl bg-[#E63946] text-white font-bold">Simpan</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
const Field = ({ label, children }) => (
  <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label><div className="mt-1.5">{children}</div></div>
);
