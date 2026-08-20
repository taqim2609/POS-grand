import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Users, Plus, Power, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const empty = { name: "", email: "", password: "", role: "kasir" };

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () => api.get("/users").then((r) => setItems(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.email || !form.password) return toast.error("Lengkapi data");
    try { await api.post("/users", form); toast.success("Pengguna dibuat"); setOpen(false); setForm(empty); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const toggle = async (u) => { try { await api.patch(`/users/${u.id}/toggle`); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Users /> Pengguna</h1>
        <button data-testid="add-user-btn" onClick={() => { setForm(empty); setOpen(true); }} className="tap h-12 px-5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2"><Plus size={18} /> Tambah</button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((u) => (
          <div key={u.id} data-testid={`user-${u.id}`} className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${!u.active && "opacity-60"}`}>
            <div className="h-11 w-11 rounded-full bg-[#0A0A0A] text-white grid place-items-center font-bold">{u.name[0]?.toUpperCase()}</div>
            <div className="flex-1 overflow-hidden">
              <div className="font-bold truncate">{u.name}</div>
              <div className="text-xs text-[#52525B] truncate">{u.email}</div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 mt-1 ${u.role === "admin" ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#E0E7FF] text-[#4338CA]"}`}>
                {u.role === "admin" && <ShieldCheck size={11} />}{u.role}
              </span>
            </div>
            <button onClick={() => toggle(u)} className="tap h-9 w-9 rounded-lg bg-[#F4F5F7] grid place-items-center"><Power size={15} /></button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Pengguna</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nama"><input data-testid="user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-11 rounded-xl border px-3" /></Field>
            <Field label="Email"><input data-testid="user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-11 rounded-xl border px-3" /></Field>
            <Field label="Password"><input data-testid="user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full h-11 rounded-xl border px-3" /></Field>
            <Field label="Role">
              <select data-testid="user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-11 rounded-xl border px-3 bg-white">
                <option value="kasir">Kasir</option><option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <DialogFooter><button data-testid="save-user-btn" onClick={save} className="tap w-full h-12 rounded-xl bg-[#E63946] text-white font-bold">Simpan</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
const Field = ({ label, children }) => (
  <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label><div className="mt-1.5">{children}</div></div>
);
