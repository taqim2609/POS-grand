import { useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Database, AlertTriangle, Trash2, Loader2, ShieldAlert } from "lucide-react";

const SCOPES = {
  transactions: {
    title: "Reset Transaksi",
    desc: "Hapus semua riwayat penjualan, kas, shift, opname & pembelian. Produk, kategori, dan meja TETAP ada.",
    includes: ["Order/transaksi", "Pergerakan kas", "Shift", "Stok opname", "Pembelian", "Nomor order (reset ke 0)"],
  },
  all: {
    title: "Reset Total",
    desc: "Hapus SEMUA data operasional termasuk produk, kategori, dan meja. Kembali bersih seperti awal.",
    includes: ["Semua di Reset Transaksi", "Semua Produk", "Semua Kategori", "Semua Meja"],
  },
};

export default function SettingsData() {
  const [scope, setScope] = useState("transactions");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (confirmText.trim().toUpperCase() !== "RESET") return toast.error('Ketik "RESET" untuk konfirmasi');
    if (!password) return toast.error("Masukkan password admin Anda");
    setLoading(true);
    try {
      const { data } = await api.post("/admin/reset-data", { scope, password });
      const total = Object.values(data.deleted).reduce((a, b) => a + b, 0);
      toast.success(`Data berhasil direset (${total} record dihapus)`);
      setConfirmText(""); setPassword("");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const s = SCOPES[scope];

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-extrabold flex items-center gap-2 mb-2"><Database /> Reset Data</h1>
      <p className="text-sm text-[#52525B] mb-6">Bersihkan data operasional. Akun pengguna, pengaturan AI, dan metode pembayaran tidak akan terhapus.</p>

      <div data-testid="reset-warning" className="flex items-start gap-3 bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] rounded-2xl px-4 py-3 mb-6 max-w-2xl">
        <ShieldAlert size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-extrabold">Tindakan Permanen &amp; Tidak Bisa Dibatalkan</div>
          Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah mencatat/ekspor laporan yang diperlukan sebelum melanjutkan.
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-6 max-w-2xl space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Pilih Cakupan</label>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            {Object.keys(SCOPES).map((k) => (
              <button key={k} data-testid={`scope-${k}`} onClick={() => setScope(k)}
                className={`tap text-left rounded-xl border-2 p-4 transition-colors ${scope === k ? "border-[#E63946] bg-[#FEF2F2]" : "border-[#E4E4E7] hover:border-[#a1a1aa]"}`}>
                <div className="font-extrabold flex items-center gap-2">
                  {k === "all" ? <Trash2 size={16} className="text-[#E63946]" /> : <AlertTriangle size={16} className="text-[#F59E0B]" />}
                  {SCOPES[k].title}
                </div>
                <div className="text-xs text-[#52525B] mt-1">{SCOPES[k].desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#F4F5F7] p-4">
          <div className="text-xs font-bold text-[#52525B] mb-2">Yang akan dihapus:</div>
          <ul className="text-sm space-y-1">
            {s.includes.map((i) => (
              <li key={i} className="flex items-center gap-2"><Trash2 size={13} className="text-[#EF4444]" /> {i}</li>
            ))}
          </ul>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Ketik <span className="text-[#E63946] font-num">RESET</span> untuk konfirmasi</label>
          <input data-testid="reset-confirm-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET" className="w-full h-11 rounded-xl border px-3 mt-1.5 font-num tracking-widest" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Password Admin</label>
          <input data-testid="reset-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password Anda" className="w-full h-11 rounded-xl border px-3 mt-1.5" />
        </div>

        <button data-testid="reset-data-btn" onClick={submit} disabled={loading}
          className="tap w-full h-12 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />} Hapus Data Sekarang
        </button>
      </div>
    </div>
  );
}
