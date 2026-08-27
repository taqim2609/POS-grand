import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { rupiah } from "@/lib/format";
import { Tag, Plus, Pencil, Trash2, Loader2, Clock, Package, Percent, Banknote, Gift } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const TYPE_META = {
  percent: { label: "Diskon Persen (seluruh transaksi)", icon: Percent },
  happy_hour: { label: "Happy Hour (persen per jam)", icon: Clock },
  min_spend: { label: "Diskon Min. Belanja (potongan tetap)", icon: Banknote },
  package: { label: "Paket (bundel produk)", icon: Package },
  bogo: { label: "Beli N Gratis 1 (produk sama)", icon: Gift },
};
const empty = { name: "", type: "percent", value: 0, bonus: 0, start_time: "17:00", end_time: "22:00", days: [], package_items: "", active: true };

export default function Promos() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/promos").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e.response?.data?.detail)));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama promo wajib");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), type: form.type, value: Number(form.value || 0), bonus: Number(form.bonus || 0),
        start_time: form.start_time, end_time: form.end_time, days: form.days,
        package_items: form.package_items.trim() ? form.package_items.split(",").map((s) => s.trim()).filter(Boolean).map((s) => ({ product_name: s, qty: 1 })) : [],
        active: form.active,
      };
      if (editId) await api.put(`/promos/${editId}`, payload);
      else await api.post("/promos", payload);
      toast.success("Promo tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  const del = async (p) => {
    if (!window.confirm(`Hapus promo "${p.name}"?`)) return;
    try { await api.delete(`/promos/${p.id}`); toast.success("Promo dihapus"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const toggle = async (p) => {
    try { await api.put(`/promos/${p.id}`, { ...p, active: !p.active }); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="promos-page">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Tag /> Promo Otomatis</h1>
        <button data-testid="add-promo-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}
          className="tap h-11 px-5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2"><Plus size={18} /> Tambah Promo</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => {
          const Icon = TYPE_META[p.type]?.icon || Tag;
          return (
            <div key={p.id} className={`rounded-2xl border p-5 bg-white ${p.active ? "" : "opacity-55"}`} data-testid={`promo-${p.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-extrabold"><Icon size={18} className="text-[#E63946]" /> {p.name}</div>
                <button onClick={() => toggle(p)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.active ? "bg-[#D1FAE5] text-[#047857]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
                  {p.active ? "AKTIF" : "MATI"}
                </button>
              </div>
              <div className="text-sm text-[#52525B] mt-2 space-y-0.5">
                <div>{TYPE_META[p.type]?.label || p.type}</div>
                {p.type === "percent" && <div className="font-bold text-[#E63946]">{p.value}% off</div>}
                {p.type === "happy_hour" && <div className="font-bold text-[#E63946]">{p.value}% · {p.start_time}–{p.end_time}</div>}
                {p.type === "min_spend" && <div className="font-bold text-[#E63946]">Min. {rupiah(p.value)} → potong {rupiah(p.bonus)}</div>}
                {p.type === "package" && <div className="font-num text-xs">Paket {rupiah(p.value)}</div>}
                {p.type === "bogo" && <div className="font-bold text-[#E63946]">Beli {p.value} gratis 1</div>}
                {p.days?.length > 0 && <div className="text-xs text-[#8b87a8]">Hari: {["Min","Sen","Sel","Rab","Kam","Jum","Sab"].filter((_, i) => p.days.includes(i)).join(", ")}</div>}
              </div>
              <div className="flex gap-1.5 mt-3">
                <button data-testid={`edit-promo-${p.id}`} onClick={() => { setForm({ name: p.name, type: p.type, value: p.value, bonus: p.bonus, start_time: p.start_time, end_time: p.end_time, days: p.days || [], package_items: (p.package_items || []).map((x) => x.product_name).join(", "), active: p.active }); setEditId(p.id); setOpen(true); }}
                  className="tap h-8 px-3 rounded-lg bg-[#F4F5F7] text-sm font-bold flex items-center gap-1"><Pencil size={13} /> Edit</button>
                <button data-testid={`delete-promo-${p.id}`} onClick={() => del(p)} className="tap h-8 px-3 rounded-lg bg-[#FEE2E2] text-[#EF4444] text-sm font-bold flex items-center gap-1"><Trash2 size={13} /> Hapus</button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border p-10 text-center text-[#a1a1aa]">Belum ada promo. Tambahkan untuk diskon otomatis saat transaksi.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="promo-dialog" className="max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Promo" : "Tambah Promo"}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Nama</label>
              <input data-testid="promo-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Jenis</label>
              <select data-testid="promo-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3 bg-white">
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {(form.type === "percent" || form.type === "happy_hour") && (
              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Persen (%)</label>
                <input data-testid="promo-value" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3 font-num" />
              </div>
            )}
            {form.type === "happy_hour" && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Mulai</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3" /></div>
                <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Selesai</label>
                  <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3" /></div>
              </div>
            )}
            {form.type === "min_spend" && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Min. Belanja (Rp)</label>
                  <input data-testid="promo-value" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3 font-num" /></div>
                <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Potongan (Rp)</label>
                  <input data-testid="promo-bonus" type="number" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3 font-num" /></div>
              </div>
            )}
            {form.type === "package" && (
              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Harga Paket (Rp)</label>
                <input data-testid="promo-value" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3 font-num" />
                <label className="mt-2 block text-xs uppercase tracking-wider font-bold text-[#52525B]">Produk (pisahkan koma, cocokkan nama produk)</label>
                <input data-testid="promo-package-items" value={form.package_items} onChange={(e) => setForm({ ...form, package_items: e.target.value })}
                  placeholder="Nasi Goreng, Es Teh" className="mt-1 w-full h-11 rounded-xl border px-3" />
              </div>
            )}
            {form.type === "bogo" && (
              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Beli berapa (gratis 1 produk sama)</label>
                <input data-testid="promo-value" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 w-full h-11 rounded-xl border px-3 font-num" />
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Hari aktif (kosong = semua hari)</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map((d, i) => (
                  <button key={d} type="button" onClick={() => setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i] })}
                    className={`tap h-9 w-11 rounded-lg text-sm font-bold ${form.days.includes(i) ? "bg-[#E63946] text-white" : "bg-[#F4F5F7] text-[#52525B]"}`}>{d}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktif</label>
          </div>
          <DialogFooter>
            <button data-testid="save-promo-btn" onClick={save} disabled={saving}
              className="tap h-11 px-6 rounded-xl bg-[#E63946] text-white font-bold disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Simpan"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
