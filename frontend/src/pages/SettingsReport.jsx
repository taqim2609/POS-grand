import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, Save, Loader2, ShieldAlert, ShoppingCart, TrendingUp } from "lucide-react";

export default function SettingsReport() {
  const [form, setForm] = useState({ whatsapp_enabled: false, whatsapp_time: "22:00", recipients: "", include_ai: true, send_sales: true, send_purchases: false });
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings/report")
      .then((r) => {
        setForm({
          whatsapp_enabled: r.data.whatsapp_enabled,
          whatsapp_time: r.data.whatsapp_time || "22:00",
          recipients: (r.data.recipients || []).join("\n"),
          include_ai: r.data.include_ai,
          send_sales: r.data.send_sales !== false,
          send_purchases: !!r.data.send_purchases,
        });
        setConfigured(!!r.data.whatsapp_configured);
      })
      .catch((e) => toast.error(apiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const recipients = form.recipients.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      await api.put("/settings/report", { ...form, recipients });
      toast.success("Pengaturan laporan tersimpan");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  if (loading) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1"><MessageCircle /> Laporan &amp; WhatsApp</h1>
      <p className="text-sm text-[#52525B] mb-5">Kirim laporan harian otomatis ke WhatsApp lewat wacloud.id, atau kirim manual dari Dashboard.</p>

      {!configured && (
        <div data-testid="wa-not-configured" className="flex items-start gap-3 bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] rounded-2xl px-4 py-3 mb-5 max-w-2xl">
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-extrabold">WhatsApp Gateway belum siap</div>
            Buka menu <b>WhatsApp</b> di sidebar, isi API Key wacloud.id lalu pilih device, agar pengiriman laporan berfungsi.
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border p-6 max-w-2xl space-y-4">
        <label className="flex items-center justify-between">
          <span className="font-bold">Aktifkan laporan harian otomatis</span>
          <input data-testid="wa-enabled" type="checkbox" checked={form.whatsapp_enabled}
            onChange={(e) => setForm({ ...form, whatsapp_enabled: e.target.checked })} className="h-5 w-5" />
        </label>

        <div className="rounded-xl border border-[#E4E4E7] p-3 space-y-3">
          <div className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Isi Laporan yang Dikirim</div>
          <label className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold"><TrendingUp size={16} className="text-[#10B981]" /> Laporan Penjualan harian</span>
            <input data-testid="report-send-sales" type="checkbox" checked={form.send_sales}
              onChange={(e) => setForm({ ...form, send_sales: e.target.checked })} className="h-5 w-5" />
          </label>
          <label className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold"><ShoppingCart size={16} className="text-[#E63946]" /> Laporan Belanja harian</span>
            <input data-testid="report-send-purchases" type="checkbox" checked={form.send_purchases}
              onChange={(e) => setForm({ ...form, send_purchases: e.target.checked })} className="h-5 w-5" />
          </label>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Jam Kirim (WIB)</label>
          <input data-testid="wa-time" type="time" value={form.whatsapp_time}
            onChange={(e) => setForm({ ...form, whatsapp_time: e.target.value })}
            className="w-full h-11 rounded-xl border px-3 mt-1.5 font-num" />
          <span className="text-[11px] text-[#a1a1aa]">Laporan dikirim otomatis di awal jam yang dipilih (mis. 22:00 = sekitar pukul 22.00 WIB).</span>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Nomor WhatsApp Tujuan</label>
          <textarea data-testid="wa-recipients" value={form.recipients}
            onChange={(e) => setForm({ ...form, recipients: e.target.value })} rows={3}
            placeholder="628123456789&#10;628560000000" className="w-full rounded-xl border px-3 py-2 mt-1.5 font-num" />
          <span className="text-[11px] text-[#a1a1aa]">Format 62... Satu nomor per baris atau pisahkan dengan koma.</span>
        </div>
        <label className="flex items-center justify-between">
          <span className="font-bold">Sertakan analisis AI dalam laporan penjualan</span>
          <input data-testid="wa-include-ai" type="checkbox" checked={form.include_ai}
            onChange={(e) => setForm({ ...form, include_ai: e.target.checked })} className="h-5 w-5" />
        </label>
        <button data-testid="save-report-settings-btn" onClick={save} disabled={saving}
          className="tap w-full h-12 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Simpan
        </button>
      </div>
    </div>
  );
}
