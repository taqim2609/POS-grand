import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah, ORDER_TYPE_LABEL } from "@/lib/format";
import { toast } from "sonner";
import {
  LayoutDashboard, TrendingUp, Utensils, ShoppingBag, Store,
  Sparkles, Loader2, Receipt, Percent, AlertTriangle, PackageX,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export default function Dashboard() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [ai, setAi] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = () => api.get("/reports/summary", { params: { date } }).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e.response?.data?.detail)));
  useEffect(() => { load(); setAi(""); }, [date]);

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
          <AlertTriangle size={18} /> {lowStock.length} produk retail stoknya menipis (≤ {data.low_stock_threshold}). Segera restock.
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

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border p-5">
          <h3 className="font-extrabold mb-4">Produk Terlaris</h3>
          {chartData.length === 0 ? <p className="text-sm text-[#a1a1aa]">Belum ada penjualan hari ini.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => rupiah(v)} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill="#E63946" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
          <span className="text-xs font-bold text-[#52525B]">(ambang ≤ {data.low_stock_threshold})</span>
        </h3>
        {lowStock.length === 0 ? (
          <p className="text-sm text-[#047857] font-bold">Semua stok retail aman.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStock.map((p) => (
              <div key={p.sku} data-testid={`low-stock-${p.sku}`} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${p.stock <= 0 ? "bg-[#FEE2E2] border-[#EF4444]" : "bg-[#FEF9C3] border-[#F59E0B]"}`}>
                <div className="overflow-hidden">
                  <div className="font-bold text-sm truncate">{p.name}</div>
                  <div className="font-num text-xs text-[#52525B]">{p.sku}</div>
                </div>
                <div className={`font-num font-extrabold flex items-center gap-1 ${p.stock <= 0 ? "text-[#EF4444]" : "text-[#B45309]"}`}>
                  {p.stock <= 0 && <PackageX size={15} />}{p.stock}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
