import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah, wibToday } from "@/lib/format";
import { toast } from "sonner";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus } from "lucide-react";

const IN_CATS = ["Modal Awal", "Setoran", "Lainnya"];
const OUT_CATS = ["Belanja Operasional", "Bayar Supplier", "Kasbon", "Lainnya"];

export default function Cash() {
  const [type, setType] = useState("in");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Modal Awal");
  const [note, setNote] = useState("");
  const [data, setData] = useState(null);
  const [date, setDate] = useState(wibToday());

  const load = () => api.get("/cash", { params: { date } }).then((r) => setData(r.data));
  useEffect(() => { load(); }, [date]);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Nominal harus > 0");
    try {
      await api.post("/cash", { type, amount: Number(amount), category, note });
      toast.success(type === "in" ? "Kas masuk dicatat" : "Kas keluar dicatat");
      setAmount(""); setNote("");
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Wallet /> Kas Harian</h1>
        <input data-testid="cash-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border px-3 font-num bg-white" />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border-2 border-[#10B981] bg-[#D1FAE5] p-5">
          <ArrowDownCircle size={22} className="text-[#047857]" />
          <div className="text-xs font-bold uppercase tracking-wider mt-2 text-[#047857]">Kas Masuk</div>
          <div className="font-num text-2xl font-extrabold" data-testid="cash-in-total">{rupiah(data?.cash_in || 0)}</div>
        </div>
        <div className="rounded-2xl border-2 border-[#EF4444] bg-[#FEE2E2] p-5">
          <ArrowUpCircle size={22} className="text-[#EF4444]" />
          <div className="text-xs font-bold uppercase tracking-wider mt-2 text-[#EF4444]">Kas Keluar</div>
          <div className="font-num text-2xl font-extrabold" data-testid="cash-out-total">{rupiah(data?.cash_out || 0)}</div>
        </div>
        <div className="rounded-2xl border-2 border-[#0A0A0A] bg-[#0A0A0A] text-white p-5">
          <Wallet size={22} className="text-white/80" />
          <div className="text-xs font-bold uppercase tracking-wider mt-2 text-white/70">Kas Bersih</div>
          <div className="font-num text-2xl font-extrabold" data-testid="cash-net-total">{rupiah(data?.cash_net || 0)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-extrabold mb-4">Catat Kas</h3>
          <div className="flex gap-2 mb-3">
            <button data-testid="cash-type-in" onClick={() => { setType("in"); setCategory(IN_CATS[0]); }} className={`tap flex-1 h-11 rounded-xl font-bold ${type === "in" ? "bg-[#10B981] text-white" : "bg-[#F4F5F7]"}`}>Masuk</button>
            <button data-testid="cash-type-out" onClick={() => { setType("out"); setCategory(OUT_CATS[0]); }} className={`tap flex-1 h-11 rounded-xl font-bold ${type === "out" ? "bg-[#EF4444] text-white" : "bg-[#F4F5F7]"}`}>Keluar</button>
          </div>
          <Field label="Nominal"><input data-testid="cash-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
          <Field label="Kategori" className="mt-3">
            <select data-testid="cash-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-11 rounded-xl border px-3 bg-white">
              {(type === "in" ? IN_CATS : OUT_CATS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Catatan" className="mt-3"><input value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-11 rounded-xl border px-3" placeholder="opsional" /></Field>
          <button data-testid="submit-cash" onClick={submit} className="tap w-full h-12 mt-4 rounded-xl bg-[#E63946] text-white font-bold flex items-center justify-center gap-2"><Plus size={18} /> Simpan</button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-extrabold">Riwayat Kas</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
              <tr><th className="text-left p-3">Waktu</th><th className="text-left p-3">Kategori</th><th className="text-left p-3">Kasir</th><th className="text-right p-3">Nominal</th></tr>
            </thead>
            <tbody>
              {(!data || data.movements.length === 0) && <tr><td colSpan={4} className="p-8 text-center text-[#a1a1aa]">Belum ada transaksi kas</td></tr>}
              {data?.movements.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 text-[#52525B]">{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="p-3">{m.category}{m.note ? ` · ${m.note}` : ""}</td>
                  <td className="p-3">{m.cashier_name}</td>
                  <td className={`p-3 text-right font-num font-bold ${m.type === "in" ? "text-[#047857]" : "text-[#EF4444]"}`}>{m.type === "in" ? "+" : "-"}{rupiah(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children, className = "" }) => (
  <div className={className}><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label><div className="mt-1.5">{children}</div></div>
);
