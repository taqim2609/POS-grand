import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah, wibToday } from "@/lib/format";
import { toast } from "sonner";
import { Store, FileDown, FileText, Send, Loader2 } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function VendorReport() {
  const [mode, setMode] = useState("day");
  const [date, setDate] = useState(wibToday());
  const [start, setStart] = useState(wibToday());
  const [end, setEnd] = useState(wibToday());
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const params = () => (mode === "day" ? { date } : { start, end });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reports/vendors", { params: params() });
      setRep(data);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on mode/date change
  useEffect(() => { load(); }, [mode, date, start, end]);

  const qs = () => new URLSearchParams(params()).toString();

  const download = async (path, filename) => {
    const t = localStorage.getItem("gak_token");
    try {
      const res = await fetch(`${BACKEND}/api${path}?${qs()}`, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Gagal mengunduh file"); }
  };

  const sendWA = async () => {
    setSending(true);
    try {
      await api.post("/reports/vendors/send-whatsapp", params());
      toast.success("Laporan vendor terkirim ke WhatsApp");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSending(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-8" data-testid="vendor-report-page">
      <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1"><Store /> Bagi Hasil Vendor</h1>
      <p className="text-sm text-[#52525B] mb-5">Rekap omzet dan bagi hasil untuk setiap vendor (produk titipan), berdasarkan transaksi lunas.</p>

      <div className="bg-white rounded-2xl border p-5 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          <button data-testid="vr-mode-day" onClick={() => setMode("day")} className={`tap h-10 px-4 rounded-lg text-sm font-bold ${mode === "day" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7]"}`}>Harian</button>
          <button data-testid="vr-mode-range" onClick={() => setMode("range")} className={`tap h-10 px-4 rounded-lg text-sm font-bold ${mode === "range" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7]"}`}>Rentang</button>
        </div>
        {mode === "day" ? (
          <div>
            <label className="text-xs uppercase font-bold text-[#52525B]">Tanggal</label>
            <input data-testid="vr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="block h-10 rounded-lg border px-3 font-num mt-1" />
          </div>
        ) : (
          <>
            <div><label className="text-xs uppercase font-bold text-[#52525B]">Dari</label><input data-testid="vr-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="block h-10 rounded-lg border px-3 font-num mt-1" /></div>
            <div><label className="text-xs uppercase font-bold text-[#52525B]">Sampai</label><input data-testid="vr-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="block h-10 rounded-lg border px-3 font-num mt-1" /></div>
          </>
        )}
        <div className="flex gap-2 ml-auto">
          <button data-testid="vr-excel-btn" onClick={() => download("/reports/vendors/export/excel", `bagi-hasil-vendor.xlsx`)} className="tap h-10 px-4 rounded-lg bg-white border font-bold text-sm flex items-center gap-2"><FileDown size={16} /> Excel</button>
          <button data-testid="vr-pdf-btn" onClick={() => download("/reports/vendors/export/pdf", `bagi-hasil-vendor.pdf`)} className="tap h-10 px-4 rounded-lg bg-white border font-bold text-sm flex items-center gap-2"><FileText size={16} /> PDF</button>
          <button data-testid="vr-wa-btn" onClick={sendWA} disabled={sending} className="tap h-10 px-4 rounded-lg bg-[#25D366] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim WA</button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>
      ) : rep && (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <Stat label="Total Omzet Vendor" value={rupiah(rep.total_gross)} />
            <Stat label="Total Bagi Hasil Vendor" value={rupiah(rep.total_vendor_share)} accent />
            <Stat label="Bagian Outlet" value={rupiah(rep.total_outlet_share)} />
          </div>
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
                <tr><th className="text-left p-3">Vendor</th><th className="text-right p-3">Qty</th><th className="text-right p-3">Omzet</th><th className="text-right p-3">Bagi Hasil Vendor</th><th className="text-right p-3">Bagian Outlet</th></tr>
              </thead>
              <tbody data-testid="vr-table-body">
                {rep.rows.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#a1a1aa]">Belum ada penjualan produk vendor pada periode ini.</td></tr>
                ) : rep.rows.map((r) => (
                  <tr key={r.vendor_id} data-testid={`vr-row-${r.vendor_id}`} className="border-t">
                    <td className="p-3 font-bold">{r.vendor_name}</td>
                    <td className="p-3 text-right font-num">{r.qty}</td>
                    <td className="p-3 text-right font-num">{rupiah(r.gross)}</td>
                    <td className="p-3 text-right font-num font-bold text-[#E63946]">{rupiah(r.vendor_share)}</td>
                    <td className="p-3 text-right font-num text-[#047857]">{rupiah(r.outlet_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className={`rounded-2xl border p-4 ${accent ? "bg-[#FEE2E2] border-[#FCA5A5]" : "bg-white"}`}>
    <div className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</div>
    <div className="text-2xl font-extrabold font-num mt-1">{value}</div>
  </div>
);
