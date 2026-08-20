import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah, ORDER_TYPE_LABEL, wibToday } from "@/lib/format";
import { toast } from "sonner";
import {
  LayoutDashboard, TrendingUp, Utensils, ShoppingBag, Store,
  Sparkles, Loader2, Receipt, Percent, AlertTriangle, PackageX, Coins, Wallet,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LineChart, Line, CartesianGrid } from "recharts";

function TrendChart() {
  const [period, setPeriod] = useState("week");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const days = period === "week" ? 7 : 30;
    const end = wibToday();
    const start = new Date(Date.now() + 7 * 3600 * 1000 - (days - 1) * 86400000).toISOString().slice(0, 10);
    setLoading(true);
    api.get("/reports/range", { params: { start, end } })
      .then((r) => {
        const map = {};
        (r.data.daily || []).forEach((d) => { map[d.date] = d; });
        const out = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(Date.now() + 7 * 3600 * 1000 - i * 86400000).toISOString().slice(0, 10);
          const rec = map[d] || { total: 0, count: 0 };
          out.push({ date: d, label: d.slice(5), total: rec.total, count: rec.count });
        }
        setRows(out);
      })
      .catch((e) => toast.error(apiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [period]);

  const totalPeriod = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="bg-white rounded-2xl border p-5 mt-4" data-testid="trend-chart">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-extrabold">Tren Penjualan</h3>
          <div className="text-xs text-[#52525B] font-bold">Total periode: <span className="font-num text-[#0A0A0A]">{rupiah(totalPeriod)}</span></div>
        </div>
        <div className="flex gap-2">
          <button data-testid="trend-week-btn" onClick={() => setPeriod("week")} className={`tap h-9 px-4 rounded-lg text-sm font-bold ${period === "week" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7] border"}`}>Mingguan</button>
          <button data-testid="trend-month-btn" onClick={() => setPeriod("month")} className={`tap h-9 px-4 rounded-lg text-sm font-bold ${period === "month" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7] border"}`}>Bulanan</button>
        </div>
      </div>
      {loading ? <div className="h-[240px] grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div> : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows} margin={{ left: 10, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F4" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === "week" ? 0 : "preserveStartEnd"} padding={{ right: 12 }} />
            <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => "Rp" + (v >= 1000 ? (v / 1000) + "k" : v)} />
            <Tooltip formatter={(v) => rupiah(v)} labelFormatter={(l) => `Tanggal ${l}`} />
            <Line type="monotone" dataKey="total" stroke="#E63946" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Penjualan" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function CategoryReport({ data }) {
  const cr = data.category_report;
  if (!cr) return null;
  const groups = [
    { key: "makanan", label: "Makanan", color: "#E63946" },
    { key: "minuman", label: "Minuman", color: "#0EA5E9" },
  ];
  return (
    <div className="bg-white rounded-2xl border p-5 mt-4" data-testid="category-report">
      <h3 className="font-extrabold mb-4">Laporan per Kategori</h3>
      <div className="grid md:grid-cols-3 gap-4">
        {groups.map((g) => (
          <div key={g.key} className="rounded-xl border p-4" data-testid={`catgroup-${g.key}`}>
            <div className="flex items-center justify-between">
              <span className="font-extrabold" style={{ color: g.color }}>{g.label}</span>
              <span className="font-num font-extrabold">{rupiah(cr[g.key].total)}</span>
            </div>
            <div className="mt-3 space-y-1">
              {cr[g.key].categories.length === 0 && <div className="text-xs text-[#a1a1aa]">Belum ada penjualan.</div>}
              {cr[g.key].categories.map((c) => (
                <div key={c.category_id} data-testid={`catrow-${c.category_id}`} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
                  <span className="text-[#52525B]">{c.name} <span className="text-[#a1a1aa] font-num">×{c.qty}</span></span>
                  <span className="font-num font-bold">{rupiah(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="rounded-xl border p-4 bg-[#FAFAFA]" data-testid="catgroup-retail">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[#047857]">Retail (gabungan)</span>
            <span className="font-num font-extrabold">{rupiah(cr.retail.total)}</span>
          </div>
          <div className="text-xs text-[#a1a1aa] mt-3">Semua penjualan retail digabung menjadi satu.</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [date, setDate] = useState(wibToday());
  const [data, setData] = useState(null);
  const [ai, setAi] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(
    () => api.get("/reports/summary", { params: { date } }).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e.response?.data?.detail))),
    [date]
  );
  useEffect(() => { load(); setAi(""); }, [load]);

  const genAi = async () => {
    setAiLoading(true);
    try { const { data } = await api.post("/reports/ai-summary", { date }); setAi(data.summary); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setAiLoading(false); }
  };

  if (!data) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  const typeCards = [
    { key: "dine_in", icon: Utensils, cls: "ot-dine_in" },
    { key: "take_away", icon: ShoppingBag, cls: "ot-take_away" },
    { key: "retail", icon: Store, cls: "ot-retail" },
  ];
  const chartData = data.top_products.map((p) => ({ name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name, total: p.total }));
  const lowStock = data.low_stock || [];

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><LayoutDashboard /> Dashboard</h1>
        <input data-testid="report-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border px-3 font-num bg-white" />
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <Stat icon={TrendingUp} label="Total Penjualan" value={rupiah(data.total_sales)} accent />
        <Stat icon={Receipt} label="Jumlah Order" value={data.order_count} />
        <Stat icon={Percent} label="Total Diskon" value={rupiah(data.total_discount)} />
        <Stat icon={Store} label="F&B vs Retail" value={`${rupiah(data.fnb_total)} / ${rupiah(data.retail_total)}`} small />
      </div>

      {lowStock.length > 0 && (
        <div data-testid="low-stock-banner" className="flex items-center gap-3 bg-[#FEF3C7] border border-[#F59E0B] text-[#B45309] rounded-xl px-4 py-3 mb-4 font-bold text-sm">
          <AlertTriangle size={18} /> {lowStock.length} produk retail stoknya menipis (di bawah ambang per-produk). Segera restock.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {typeCards.map((t) => (
          <div key={t.key} data-testid={`report-type-${t.key}`} className={`rounded-2xl border-2 p-5 ${t.cls}`}>
            <div className="flex items-center justify-between">
              <t.icon size={22} />
              <span className="text-xs font-bold uppercase tracking-wider">{ORDER_TYPE_LABEL[t.key]}</span>
            </div>
            <div className="font-num text-2xl font-extrabold mt-3">{rupiah(data.by_type[t.key].total)}</div>
            <div className="text-xs font-bold mt-1">{data.by_type[t.key].count} order</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="rounded-2xl border-2 border-[#10B981] bg-[#ECFDF5] p-5" data-testid="stat-gross-profit">
          <Coins size={20} className="text-[#047857]" />
          <div className="text-xs font-bold uppercase tracking-wider mt-3 text-[#047857]">Laba Kotor</div>
          <div className="font-num text-2xl font-extrabold mt-1">{rupiah(data.gross_profit || 0)}</div>
          <div className="text-[11px] text-[#52525B] mt-1">HPP terjual: {rupiah(data.total_cost || 0)}</div>
        </div>
        <div className="rounded-2xl border-2 border-[#E63946] bg-[#FEF2F2] p-5" data-testid="stat-avg-order">
          <TrendingUp size={20} className="text-[#E63946]" />
          <div className="text-xs font-bold uppercase tracking-wider mt-3 text-[#B91C1C]">Rata-rata per Order</div>
          <div className="font-num text-2xl font-extrabold mt-1">{rupiah(data.order_count ? data.total_sales / data.order_count : 0)}</div>
          <div className="text-[11px] text-[#52525B] mt-1">{data.order_count} order · omzet {rupiah(data.total_sales)}</div>
        </div>
        <div className="rounded-2xl border-2 border-[#0A0A0A] bg-[#0A0A0A] text-white p-5" data-testid="stat-cash-net">
          <Wallet size={20} className="text-white/80" />
          <div className="text-xs font-bold uppercase tracking-wider mt-3 text-white/70">Kas Bersih Harian</div>
          <div className="font-num text-2xl font-extrabold mt-1">{rupiah(data.cash_net || 0)}</div>
          <div className="text-[11px] text-white/50 mt-1">Masuk {rupiah(data.cash_in || 0)} · Keluar {rupiah(data.cash_out || 0)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border p-5">
          <h3 className="font-extrabold mb-4">Produk Terlaris & Margin</h3>
          {data.top_products.length === 0 ? <p className="text-sm text-[#a1a1aa]">Belum ada penjualan hari ini.</p> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => rupiah(v)} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry) => <Cell key={entry.name} fill="#E63946" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 border rounded-xl overflow-hidden" data-testid="margin-table">
                <table className="w-full text-sm">
                  <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
                    <tr><th className="text-left p-2.5">Produk</th><th className="text-right p-2.5">Qty</th><th className="text-right p-2.5">Omzet</th><th className="text-right p-2.5">Laba</th><th className="text-right p-2.5">Margin</th></tr>
                  </thead>
                  <tbody>
                    {data.top_products.map((p) => (
                      <tr key={p.name} data-testid={`margin-row-${p.name}`} className="border-t">
                        <td className="p-2.5 font-bold truncate max-w-[160px]">{p.name}</td>
                        <td className="p-2.5 text-right font-num">{p.qty}</td>
                        <td className="p-2.5 text-right font-num">{rupiah(p.total)}</td>
                        <td className="p-2.5 text-right font-num font-bold text-[#047857]">{rupiah(p.profit || 0)}</td>
                        <td className="p-2.5 text-right">
                          <span className={`font-num font-bold px-2 py-0.5 rounded ${(p.margin || 0) >= 40 ? "bg-[#D1FAE5] text-[#047857]" : (p.margin || 0) >= 15 ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
                            {(p.margin || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="bg-[#0A0A0A] text-white rounded-2xl p-5 flex flex-col">
          <h3 className="font-extrabold flex items-center gap-2 mb-2"><Sparkles size={18} className="text-[#E63946]" /> Ringkasan AI</h3>
          <p className="text-xs text-white/50 mb-4">Analisis penjualan harian oleh Gemini</p>
          <div className="flex-1 text-sm whitespace-pre-wrap overflow-y-auto no-scrollbar min-h-[120px]">
            {ai || <span className="text-white/40">Klik tombol untuk membuat ringkasan analitik.</span>}
          </div>
          <button data-testid="ai-summary-btn" onClick={genAi} disabled={aiLoading} className="tap mt-4 h-11 rounded-xl bg-[#E63946] hover:bg-[#BE123C] font-bold flex items-center justify-center gap-2">
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Buat Ringkasan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-5 mt-4">
        <h3 className="font-extrabold mb-3">Penjualan per Metode Bayar</h3>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(data.by_payment).length === 0 ? <span className="text-sm text-[#a1a1aa]">Belum ada data</span> :
            Object.entries(data.by_payment).map(([k, v]) => (
              <div key={k} className="px-4 py-3 rounded-xl bg-[#F4F5F7]">
                <div className="text-xs text-[#52525B] font-bold uppercase">{k}</div>
                <div className="font-num font-extrabold text-lg">{rupiah(v)}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-5 mt-4" data-testid="low-stock-panel">
        <h3 className="font-extrabold mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-[#B45309]" /> Stok Retail Menipis
          <span className="text-xs font-bold text-[#52525B]">(ambang per-produk)</span>
        </h3>
        {lowStock.length === 0 ? (
          <p className="text-sm text-[#047857] font-bold">Semua stok retail aman.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStock.map((p) => (
              <div key={p.sku} data-testid={`low-stock-${p.sku}`} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${p.stock <= 0 ? "bg-[#FEE2E2] border-[#EF4444]" : "bg-[#FEF9C3] border-[#F59E0B]"}`}>
                <div className="overflow-hidden">
                  <div className="font-bold text-sm truncate">{p.name}</div>
                  <div className="font-num text-xs text-[#52525B]">{p.sku} · ambang {p.min_stock}</div>
                </div>
                <div className={`font-num font-extrabold flex items-center gap-1 ${p.stock <= 0 ? "text-[#EF4444]" : "text-[#B45309]"}`}>
                  {p.stock <= 0 && <PackageX size={15} />}{p.stock}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CategoryReport data={data} />
      <TrendChart />
    </div>
  );
}

const Stat = ({ icon: Icon, label, value, accent, small }) => (
  <div className={`rounded-2xl border p-5 ${accent ? "bg-[#E63946] text-white border-[#E63946]" : "bg-white"}`}>
    <Icon size={20} className={accent ? "text-white/80" : "text-[#E63946]"} />
    <div className={`text-xs font-bold uppercase tracking-wider mt-3 ${accent ? "text-white/70" : "text-[#52525B]"}`}>{label}</div>
    <div className={`font-num font-extrabold mt-1 ${small ? "text-sm" : "text-2xl"}`}>{value}</div>
  </div>
);
