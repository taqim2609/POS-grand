import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { toast } from "sonner";
import { Clock, Play, Square, Loader2, Wallet, Users } from "lucide-react";

export default function Shift() {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [report, setReport] = useState(null);
  const [vendorPreview, setVendorPreview] = useState([]);
  const [cashDay, setCashDay] = useState(null);
  // paid[row.vendor_id] = berapa yang diberikan ke vendor
  const [paid, setPaid] = useState({});

  const load = async () => {
    try {
      const r = await api.get("/shifts/current");
      setShift(r.data);
      if (r.data) {
        // preview bagian vendor + kas harian (digabung ke shift)
        try { const v = await api.get("/shifts/current/vendor"); setVendorPreview(v.data.vendors || []); } catch (_) {}
        try { const c = await api.get("/cash"); setCashDay(c.data); } catch (_) {}
      } else {
        setVendorPreview([]); setCashDay(null);
      }
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on mount
  useEffect(() => { load(); }, []);

  const open = async () => {
    try {
      const { data } = await api.post("/shifts/open", { opening_cash: Number(opening || 0) });
      setShift(data); setReport(null); setPaid({}); toast.success("Shift dibuka");
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const close = async () => {
    try {
      const vendor_payments = vendorPreview.map((v) => ({ vendor_id: v.vendor_id, paid: Number(paid[v.vendor_id] || 0) }));
      const { data } = await api.post("/shifts/close", { closing_cash: Number(closing || 0), vendor_payments });
      setReport(data.report); setShift(null); toast.success("Shift ditutup");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  if (loading) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <h1 className="text-3xl font-extrabold flex items-center gap-2"><Clock /> Manajemen Shift</h1>
      <p className="text-[#52525B] mt-1 mb-6">Buka shift sebelum mulai transaksi; tutup shift menampilkan kas harian + bagi hasil vendor & uang bersih.</p>

      {shift ? (
        <div className="max-w-lg bg-white rounded-2xl border p-6 space-y-5">
          <div className="inline-flex items-center gap-2 bg-[#D1FAE5] text-[#047857] font-bold px-3 py-1 rounded-full text-sm">
            <span className="h-2 w-2 rounded-full bg-[#047857] animate-pulse" /> Shift Aktif
          </div>
          <div className="text-sm text-[#52525B]">
            Dibuka: <b>{new Date(shift.opened_at).toLocaleString("id-ID")}</b>
            <br />Kas Awal: <b className="font-num">{rupiah(shift.opening_cash)}</b>
          </div>

          {/* Kas harian (digabung) */}
          {cashDay && (
            <div className="rounded-xl border border-[#E4E4E7] p-3">
              <div className="flex items-center gap-2 font-extrabold text-sm mb-2"><Wallet size={15} className="text-[#E63946]" /> Kas Harian</div>
              <Row l="Uang Masuk (setoran)" v={rupiah(cashDay.cash_in)} />
              <Row l="Uang Keluar (pengambilan)" v={rupiah(cashDay.cash_out)} />
              <Row l="Selisih Kas" v={rupiah(cashDay.cash_net)} />
            </div>
          )}

          {/* Bagi hasil vendor (preview) */}
          {vendorPreview.length > 0 && (
            <div className="rounded-xl border border-[#E4E4E7] p-3">
              <div className="flex items-center gap-2 font-extrabold text-sm mb-2"><Users size={15} className="text-[#E63946]" /> Bagi Hasil Vendor</div>
              {vendorPreview.map((v) => (
                <div key={v.vendor_id} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{v.vendor_name}</div>
                    <div className="text-[11px] text-[#52525B]">Bagian vendor: <b className="font-num">{rupiah(v.share)}</b> · Omzet {rupiah(v.gross)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#52525B] font-bold uppercase">Diberikan</div>
                    <input data-testid={`vendor-paid-${v.vendor_id}`} type="number" min="0" value={paid[v.vendor_id] ?? 0}
                      onChange={(e) => setPaid((p) => ({ ...p, [v.vendor_id]: e.target.value }))}
                      className="w-28 h-9 rounded-lg border px-2 font-num text-sm" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Kas Akhir (hitung fisik)</label>
            <input data-testid="closing-cash" type="number" value={closing} onChange={(e) => setClosing(e.target.value)}
              className="w-full h-12 rounded-xl border px-3 mt-1.5 font-num" placeholder="0" />
          </div>
          <button data-testid="close-shift-btn" onClick={close} className="tap w-full h-13 py-3 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center justify-center gap-2">
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
        <div className="max-w-lg bg-white rounded-2xl border p-6 mt-6" data-testid="shift-report">
          <h3 className="font-extrabold text-lg mb-3">Laporan Shift</h3>
          <Row l="Total Order" v={report.order_count} />
          <Row l="Total Penjualan" v={rupiah(report.total_sales)} />
          <Row l="Dine-In" v={rupiah(report.by_type.dine_in)} />
          <Row l="Take Away" v={rupiah(report.by_type.take_away)} />
          <Row l="Retail" v={rupiah(report.by_type.retail)} />
          <div className="pt-2"><div className="text-xs font-extrabold text-[#52525B] uppercase tracking-wider mb-1">Kas Harian</div></div>
          <Row l="Uang Masuk (setoran)" v={rupiah(report.cash_in)} />
          <Row l="Uang Keluar (pengambilan)" v={rupiah(report.cash_out)} />
          <Row l="Selisih Kas" v={rupiah(report.cash_net)} />
          <div className="pt-2"><div className="text-xs font-extrabold text-[#52525B] uppercase tracking-wider mb-1">Perkiraan Kas</div></div>
          <Row l="Perkiraan Kas" v={rupiah(report.expected_cash)} />
          {(report.vendor_share || []).length > 0 && (
            <>
              <div className="pt-2"><div className="text-xs font-extrabold text-[#52525B] uppercase tracking-wider mb-1">Bagi Hasil Vendor</div></div>
              {(report.vendor_share || []).map((v) => (
                <div key={v.vendor_id} className="rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] px-3 py-2 my-1.5">
                  <div className="font-bold text-sm">{v.vendor_name}</div>
                  <Row l="Bagian vendor (seharusnya)" v={rupiah(v.share)} />
                  <Row l="Diberikan" v={rupiah(v.paid)} />
                  <Row l="Selisih" v={`${v.difference >= 0 ? "" : "-"}${rupiah(Math.abs(v.difference))}`} warn={v.difference !== 0} />
                </div>
              ))}
              <Row l="Total Bagian Vendor" v={rupiah(report.vendor_total_share)} />
              <Row l="Total Diberikan" v={rupiah(report.vendor_total_paid)} />
              <Row l="Total Selisih" v={`${report.vendor_total_difference >= 0 ? "" : "-"}${rupiah(Math.abs(report.vendor_total_difference))}`} warn={report.vendor_total_difference !== 0} />
            </>
          )}
          <div className="pt-3 mt-1 border-t-2 border-dashed">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-base">Uang Bersih (setelah bagi hasil vendor)</span>
              <span className="font-num font-extrabold text-lg text-[#047857]">{rupiah(report.net_cash)}</span>
            </div>
            <div className="text-[11px] text-[#52525B] mt-1">Perkiraan kas {rupiah(report.expected_cash)} − diberikan ke vendor {rupiah(report.vendor_total_paid)} − uang keluar kas {rupiah(report.cash_out)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
const Row = ({ l, v, warn }) => (
  <div className="flex justify-between py-1 border-b last:border-0 text-sm">
    <span className="text-[#52525B]">{l}</span>
    <span className={`font-num font-bold ${warn ? "text-[#B45309]" : ""}`}>{v}</span>
  </div>
);
