import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Tags, Plus, Pencil, Power, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TYPE_LABEL } from "@/lib/format";

const empty = { name: "", type: "makanan", sort_order: 0, active: true };

export default function Categories() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/categories").then((r) => setItems(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama wajib diisi");
    try {
      if (editId) await api.put(`/categories/${editId}`, form);
      else await api.post("/categories", form);
      toast.success("Kategori tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (c) => {
    if (!window.confirm(`Hapus kategori ${c.name}?`)) return;
    try { const { data } = await api.delete(`/categories/${c.id}`); toast.success(data.reason || "Terhapus"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const toggle = async (c) => { try { await api.put(`/categories/${c.id}`, { ...c, active: !c.active }); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Tags /> Kategori</h1>
        <button data-testid="add-category-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}
          className="tap h-12 px-5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2">
          <Plus size={18} /> Tambah
        </button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((c) => (
          <div key={c.id} data-testid={`category-${c.id}`} className={`bg-white rounded-xl border p-4 ${!c.active && "opacity-60"}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-lg">{c.name}</div>
                <span className={`ot-${c.type === "retail" ? "retail" : c.type === "minuman" ? "take_away" : "dine_in"} text-xs font-bold px-2 py-0.5 rounded border inline-block mt-1`}>
                  {TYPE_LABEL[c.type]}
                </span>
              </div>
              <span className="font-num text-xs text-[#52525B]">#{c.sort_order}</span>
            </div>
            <div className="flex gap-1 mt-3">
              <button data-testid={`edit-category-${c.id}`} onClick={() => { setForm(c); setEditId(c.id); setOpen(true); }} className="tap flex-1 h-9 rounded-lg bg-[#F4F5F7] flex items-center justify-center gap-1 text-sm font-bold"><Pencil size={14} /> Edit</button>
              <button onClick={() => toggle(c)} className="tap h-9 w-9 rounded-lg bg-[#F4F5F7] grid place-items-center"><Power size={15} /></button>
              <button data-testid={`delete-category-${c.id}`} onClick={() => del(c)} className="tap h-9 w-9 rounded-lg bg-[#FEE2E2] text-[#EF4444] grid place-items-center"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Tambah"} Kategori</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nama"><input data-testid="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-11 rounded-xl border px-3" /></Field>
            <Field label="Tipe">
              <select data-testid="cat-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-11 rounded-xl border px-3 bg-white">
                <option value="makanan">Makanan</option><option value="minuman">Minuman</option><option value="retail">Retail</option><option value="vendor">Vendor</option>
              </select>
            </Field>
            <Field label="Urutan Tampil"><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
          </div>
          <DialogFooter><button data-testid="save-category-btn" onClick={save} className="tap w-full h-12 rounded-xl bg-[#E63946] text-white font-bold">Simpan</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
const Field = ({ label, children }) => (
  <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label><div className="mt-1.5">{children}</div></div>
);
