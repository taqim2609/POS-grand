import { useEffect, useMemo, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah, wibToday } from "@/lib/format";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Utensils, Coffee, Store, Handshake, FileDown, FileText, Send } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

function weekRange(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const mon = new Date(d); mon.setDate(d.getDate() - day);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = (x) => x.toISOString().slice(0, 10);
  return [f(mon), f(sun)];
}
function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`];
}

export default function Reports() {
  const [period, setPeriod] = useState("day");
  const [day, setDay] = useState(wibToday());
  const [weekDate, setWeekDate] = useState(wibToday());
  const [month, setMonth] = useState(wibToday().slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [start, end] = useMemo(() => {
    if (period === "day") return [day, day];
    if (period === "week") return weekRange(weekDate);
    return monthRange(month);
  }, [period, day, weekDate, month]);

  useEffect(() => {
    setLoading(true);
    api.get("/reports/period", { params: { start, end } })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(apiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [start, end]);

  const download = async (path, filename) => {
    const t = localStorage.getItem("gak_token");
    try {
      const res = await fetch(`${BACKEND}/api${path}?start=${start}&end=${end}`, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Gagal mengunduh file"); }
  };
  const sendVendorWA = async () => {
    setSending(true);
    try { await api.post("/reports/vendors/send-whatsapp", { start, end }); toast.success("Laporan vendor terkirim ke WhatsApp"); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSending(false); }
  };

  const groups = [
    { key: "makanan", label: "Makanan", icon: Utensils, color: "#E63946" },
    { key: "minuman", label: "Minuman", icon: Coffee, color: "#0EA5E9" },
    { key: "retail", label: "Retail", icon: Store, color: "#047857" },
  ];

  return (
    <div className="h-full overflow-y-auto p-8" data-testid="reports-page">
      <h1 className="text-3xl font-extrabold flex items-center gap-2 mb-1"><FileSpreadsheet /> Laporan</h1>
      <p className="text-sm text-[#52525B] mb-5">Rekap penjualan per kategori (Makanan, Minuman, Retail) dan bagi hasil vendor — harian, mingguan, atau bulanan.</p>

      <div className="bg-white rounded-2xl border p-5 mb-5 flex flex-wrap items-end gap-4">
        <div className="flex gap-1">
          <button data-testid="period-day" onClick={() => setPeriod("day")} className={`tap h-10 px-4 rounded-lg text-sm font-bold ${period === "day" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7]"}`}>Harian</button>
          <button data-testid="period-week" onClick={() => setPeriod("week")} className={`tap h-10 px-4 rounded-lg text-sm font-bold ${period === "week" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7]"}`}>Mingguan</button>
          <button data-testid="period-month" onClick={() => setPeriod("month")} className={`tap h-10 px-4 rounded-lg text-sm font-bold ${period === "month" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7]"}`}>Bulanan</button>
        </div>
        {period === "day" && (
          <div><label className="text-xs uppercase font-bold text-[#52525B]">Tanggal</label><input data-testid="rep-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="block h-10 rounded-lg border px-3 font-num mt-1" /></div>
        )}
        {period === "week" && (
          <div><label className="text-xs uppercase font-bold text-[#52525B]">Pilih tanggal dalam minggu</label><input data-testid="rep-week" type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} className="block h-10 rounded-lg border px-3 font-num mt-1" /></div>
        )}
        {period === "month" && (
          <div><label className="text-xs uppercase font-bold text-[#52525B]">Bulan</label><input data-testid="rep-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="block h-10 rounded-lg border px-3 font-num mt-1" /></div>
        )}
        <div className="text-sm font-bold text-[#52525B] ml-auto" data-testid="rep-range-label">Periode: <span className="font-num text-[#0A0A0A]">{start === end ? start : `${start} s/d ${end}`}</span></div>
      </div>

      {loading || !data ? (
        <div className="h-40 grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Total Penjualan" value={rupiah(data.total_sales)} accent />
            <Stat label="Jumlah Order" value={data.order_count} />
            <Stat label="Laba Kotor" value={rupiah(data.gross_profit)} />
            <Stat label="Bagi Hasil Vendor" value={rupiah(data.vendor?.total_vendor_share || 0)} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-5">
            {groups.map((g) => {
              const grp = data.category_report[g.key];
              return (
                <div key={g.key} className="bg-white rounded-2xl border overflow-hidden" data-testid={`report-group-${g.key}`}>
                  <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderTopColor: g.color, borderTopWidth: 3 }}>
                    <span className="font-extrabold flex items-center gap-2" style={{ color: g.color }}><g.icon size={18} /> {g.label}</span>
                    <span className="font-num font-extrabold">{rupiah(grp.total)}</span>
                  </div>
                  <div className="p-4">
                    {grp.categories.length === 0 ? (
                      <div className="text-sm text-[#a1a1aa] py-2">Belum ada penjualan pada periode ini.</div>
                    ) : grp.categories.map((c) => (
                      <div key={c.category_id} data-testid={`report-cat-${c.category_id}`} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                        <span className="text-[#52525B]">{c.name} <span className="text-[#a1a1aa] font-num">×{c.qty}</span></span>
                        <span className="font-num font-bold">{rupiah(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden" data-testid="report-vendor-section">
            <div className="flex items-center justify-between px-5 py-4 border-b flex-wrap gap-3">
              <h3 className="font-extrabold flex items-center gap-2"><Handshake size={18} className="text-[#E63946]" /> Bagi Hasil Vendor</h3>
              <div className="flex gap-2">
                <button data-testid="vendor-excel-btn" onClick={() => download("/reports/vendors/export/excel", "bagi-hasil-vendor.xlsx")} className="tap h-9 px-3 rounded-lg bg-white border font-bold text-xs flex items-center gap-1.5"><FileDown size={14} /> Excel</button>
                <button data-testid="vendor-pdf-btn" onClick={() => download("/reports/vendors/export/pdf", "bagi-hasil-vendor.pdf")} className="tap h-9 px-3 rounded-lg bg-white border font-bold text-xs flex items-center gap-1.5"><FileText size={14} /> PDF</button>
                <button data-testid="vendor-wa-btn" onClick={sendVendorWA} disabled={sending} className="tap h-9 px-3 rounded-lg bg-[#25D366] text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50">{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim WA</button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
                <tr><th className="text-left p-3">Vendor</th><th className="text-right p-3">Qty</th><th className="text-right p-3">Omzet</th><th className="text-right p-3">Bagi Hasil Vendor</th><th className="text-right p-3">Bagian Outlet</th></tr>
              </thead>
              <tbody data-testid="vendor-table-body">
                {(!data.vendor?.rows || data.vendor.rows.length === 0) ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#a1a1aa]">Belum ada penjualan produk vendor pada periode ini.</td></tr>
                ) : data.vendor.rows.map((r) => (
                  <tr key={r.vendor_id} data-testid={`vendor-row-${r.vendor_id}`} className="border-t">
                    <td className="p-3 font-bold">{r.vendor_name}</td>
                    <td className="p-3 text-right font-num">{r.qty}</td>
                    <td className="p-3 text-right font-num">{rupiah(r.gross)}</td>
                    <td className="p-3 text-right font-num font-bold text-[#E63946]">{rupiah(r.vendor_share)}</td>
                    <td className="p-3 text-right font-num text-[#047857]">{rupiah(r.outlet_share)}</td>
                  </tr>
                ))}
              </tbody>
              {data.vendor?.rows?.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-[#FAFAFA] font-extrabold">
                    <td className="p-3">TOTAL</td><td></td>
                    <td className="p-3 text-right font-num">{rupiah(data.vendor.total_gross)}</td>
                    <td className="p-3 text-right font-num text-[#E63946]">{rupiah(data.vendor.total_vendor_share)}</td>
                    <td className="p-3 text-right font-num text-[#047857]">{rupiah(data.vendor.total_outlet_share)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className={`rounded-2xl border p-4 ${accent ? "bg-[#E63946] text-white border-[#E63946]" : "bg-white"}`}>
    <div className={`text-xs uppercase tracking-wider font-bold ${accent ? "text-white/70" : "text-[#52525B]"}`}>{label}</div>
    <div className="text-2xl font-extrabold font-num mt-1">{value}</div>
  </div>
);
