import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { rupiah } from "@/lib/format";
import { Users, Plus, Pencil, Trash2, Search, Star, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const empty = { name: "", phone: "", points: 0 };

export default function Members() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/members", { params: { q } }).then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e.response?.data?.detail)));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama wajib");
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), phone: form.phone.trim(), points: Number(form.points || 0) };
      if (editId) await api.put(`/members/${editId}`, payload);
      else await api.post("/members", payload);
      toast.success("Member tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  const del = async (m) => {
    if (!window.confirm(`Hapus member ${m.name}?`)) return;
    try { await api.delete(`/members/${m.id}`); toast.success("Member dihapus"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="members-page">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Users /> Member &amp; Poin</h1>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / no. WA"
              className="h-11 pl-9 pr-3 rounded-xl bg-white border text-sm w-56 max-w-full placeholder:text-[#A1A1AA]" />
          </div>
          <button data-testid="add-member-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}
            className="tap h-11 px-5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2"><Plus size={18} /> Tambah</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
            <tr><th className="text-left p-3">Nama</th><th className="text-left p-3">No. WA</th><th className="text-right p-3">Total Belanja</th><th className="text-right p-3">Poin</th><th className="text-center p-3">Nilai Poin</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t" data-testid={`member-row-${m.id}`}>
                <td className="p-3 font-bold">{m.name}</td>
                <td className="p-3 font-num text-[#52525B]">{m.phone || "-"}</td>
                <td className="p-3 text-right font-num">{rupiah(m.total_spend || 0)}</td>
                <td className="p-3 text-right font-num font-bold text-[#E63946]">{Math.round(m.points || 0).toLocaleString("id-ID")}</td>
                <td className="p-3 text-center text-[#047857] font-bold">Rp{Math.round((m.points || 0) * 100).toLocaleString("id-ID")}</td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <button data-testid={`edit-member-${m.id}`} onClick={() => { setForm({ name: m.name, phone: m.phone || "", points: m.points || 0 }); setEditId(m.id); setOpen(true); }}
                      className="tap h-8 w-8 rounded-lg bg-[#F4F5F7] grid place-items-center"><Pencil size={14} /></button>
                    <button data-testid={`delete-member-${m.id}`} onClick={() => del(m)}
                      className="tap h-8 w-8 rounded-lg bg-[#FEE2E2] text-[#EF4444] grid place-items-center"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-[#a1a1aa]">Belum ada member.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#8b87a8] mt-3 flex items-center gap-1.5"><Star size={13} /> Pelanggan mendapat <b>1 poin per Rp10.000</b> belanja saat transaksi memakai member. Tukar di kasir: <b>1 poin = Rp100</b>.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="member-dialog">
          <DialogHeader><DialogTitle>{editId ? "Edit Member" : "Tambah Member"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Nama</label>
              <input data-testid="member-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full h-11 rounded-xl border px-3" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">No. WA</label>
              <input data-testid="member-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="628xxx" className="mt-1 w-full h-11 rounded-xl border px-3 font-num" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Poin Awal</label>
              <input data-testid="member-points" type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })}
                className="mt-1 w-full h-11 rounded-xl border px-3 font-num" />
            </div>
          </div>
          <DialogFooter>
            <button data-testid="save-member-btn" onClick={save} disabled={saving}
              className="tap h-11 px-6 rounded-xl bg-[#E63946] text-white font-bold disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Simpan"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
