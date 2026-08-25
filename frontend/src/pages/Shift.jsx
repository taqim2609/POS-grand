import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { toast } from "sonner";
import { Clock, Play, Square, Loader2 } from "lucide-react";

export default function Shift() {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [report, setReport] = useState(null);

  const load = () =>
    api.get("/shifts/current").then((r) => setShift(r.data)).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const open = async () => {
    try {
      const { data } = await api.post("/shifts/open", { opening_cash: Number(opening || 0) });
      setShift(data); setReport(null); toast.success("Shift dibuka");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const close = async () => {
    try {
      const { data } = await api.post("/shifts/close", { closing_cash: Number(closing || 0) });
      setReport(data.report); setShift(null); toast.success("Shift ditutup");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  if (loading) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-extrabold flex items-center gap-2"><Clock /> Manajemen Shift</h1>
      <p className="text-[#52525B] mt-1 mb-8">Buka shift sebelum mulai transaksi, tutup shift saat selesai.</p>

      {shift ? (
        <div className="max-w-md bg-white rounded-2xl border p-6">
          <div className="inline-flex items-center gap-2 bg-[#D1FAE5] text-[#047857] font-bold px-3 py-1 rounded-full text-sm mb-4">
            <span className="h-2 w-2 rounded-full bg-[#047857] animate-pulse" /> Shift Aktif
          </div>
          <div className="text-sm text-[#52525B]">Dibuka: {new Date(shift.opened_at).toLocaleString("id-ID")}</div>
          <div className="text-sm text-[#52525B]">Kas Awal: <span className="font-num font-bold text-[#0A0A0A]">{rupiah(shift.opening_cash)}</span></div>
          <div className="mt-6">
            <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Kas Akhir (hitung fisik)</label>
            <input data-testid="closing-cash" type="number" value={closing} onChange={(e) => setClosing(e.target.value)}
              className="w-full h-12 rounded-xl border px-3 mt-1.5 font-num" placeholder="0" />
          </div>
          <button data-testid="close-shift-btn" onClick={close} className="tap w-full h-13 py-3 mt-4 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center justify-center gap-2">
            <Square size={16} /> Tutup Shift
          </button>
        </div>
      ) : (
        <div className="max-w-md bg-white rounded-2xl border p-6">
          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Kas Awal</label>
          <input data-testid="opening-cash" type="number" value={opening} onChange={(e) => setOpening(e.target.value)}
            className="w-full h-12 rounded-xl border px-3 mt-1.5 font-num" placeholder="0" />
          <button data-testid="open-shift-btn" onClick={open} className="tap w-full h-13 py-3 mt-4 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center justify-center gap-2">
            <Play size={16} /> Buka Shift
          </button>
        </div>
      )}

      {report && (
        <div className="max-w-md bg-white rounded-2xl border p-6 mt-6" data-testid="shift-report">
          <h3 className="font-extrabold text-lg mb-3">Laporan Shift</h3>
          <Row l="Total Order" v={report.order_count} />
          <Row l="Total Penjualan" v={rupiah(report.total_sales)} />
          <Row l="Dine-In" v={rupiah(report.by_type.dine_in)} />
          <Row l="Take Away" v={rupiah(report.by_type.take_away)} />
          <Row l="Retail" v={rupiah(report.by_type.retail)} />
          <Row l="Perkiraan Kas" v={rupiah(report.expected_cash)} />
        </div>
      )}
    </div>
  );
}
const Row = ({ l, v }) => (
  <div className="flex justify-between py-1.5 border-b last:border-0 text-sm">
    <span className="text-[#52525B]">{l}</span><span className="font-num font-bold">{v}</span>
  </div>
);
