import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { rupiah } from "@/lib/format";
import {
  Sparkles, Save, Loader2, ShieldAlert, KeyRound, Link2, Cpu,
  FileText, ImageIcon, BarChart3, Wallet, RefreshCw,
} from "lucide-react";

const FEATURE_META = {
  description: { label: "Deskripsi Produk", icon: FileText, hint: "Model teks (chat) untuk menulis deskripsi produk.", modelPh: "claude-sonnet-5" },
  image: { label: "Gambar Produk", icon: ImageIcon, hint: "Model gambar (image generation, mis. dall-e-3). Kosongkan bila ingin pakai Gemini/bawaan.", modelPh: "dall-e-3" },
  summary: { label: "Analisis Laporan", icon: BarChart3, hint: "Model teks (chat) untuk ringkasan & analisis penjualan.", modelPh: "claude-sonnet-5" },
};

export default function SettingsAI() {
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.get("/settings/ai")
      .then((r) => setFeatures(r.data.features))
      .catch((e) => toast.error(apiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  if (loading || !features) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-extrabold flex items-center gap-2 mb-2"><Sparkles /> Pengaturan AI</h1>
      <p className="text-sm text-[#52525B] mb-6">Atur penyedia AI OpenAI-compatible Anda sendiri, terpisah untuk tiap fungsi: deskripsi, gambar, dan analisis laporan.</p>

      <div data-testid="ai-warning" className="flex items-start gap-3 bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] rounded-2xl px-4 py-3 mb-6 max-w-3xl">
        <ShieldAlert size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-extrabold">Peringatan Keamanan &amp; Biaya</div>
          API Key disimpan di server aplikasi ini dan dipakai untuk memanggil penyedia AI Anda. Jangan bagikan key ke pihak lain.
          Setiap permintaan AI dapat mengurangi saldo/kredit di akun penyedia Anda — pantau lewat tombol "Cek Sisa Kredit".
          Kosongkan kolom API Key jika tidak ingin mengubah key yang sudah tersimpan.
        </div>
      </div>

      <div className="grid gap-5 max-w-3xl">
        {Object.keys(FEATURE_META).map((key) => (
          <FeatureCard key={key} featKey={key} data={features[key]} onSaved={load} />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ featKey, data, onSaved }) {
  const meta = FEATURE_META[featKey];
  const Icon = meta.icon;
  const [form, setForm] = useState({ base_url: data.base_url || "", model: data.model || "", api_key: "" });
  const [saving, setSaving] = useState(false);
  const [credit, setCredit] = useState(null);
  const [checking, setChecking] = useState(false);

  const save = async () => {
    if (!form.base_url.trim()) return toast.error("Base URL wajib diisi");
    setSaving(true);
    try {
      const payload = { feature: featKey, base_url: form.base_url.trim(), model: form.model.trim() };
      if (form.api_key.trim()) payload.api_key = form.api_key.trim();
      await api.put("/settings/ai", payload);
      toast.success(`Pengaturan "${meta.label}" tersimpan`);
      setForm((f) => ({ ...f, api_key: "" }));
      onSaved();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const checkCredit = async () => {
    setChecking(true); setCredit(null);
    try {
      const { data: c } = await api.get("/settings/ai/credit", { params: { feature: featKey } });
      setCredit(c);
      if (!c.available) toast.message(c.message || "Info kredit tidak tersedia");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setChecking(false); }
  };

  return (
    <div className="bg-white rounded-2xl border p-6" data-testid={`ai-feature-${featKey}`}>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-extrabold text-lg flex items-center gap-2"><Icon size={18} className="text-[#E63946]" /> {meta.label}</h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${data.api_key_set ? "bg-[#D1FAE5] text-[#047857]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
          {data.api_key_set ? `Key aktif ${data.api_key_last4}` : "Belum ada key"}
        </span>
      </div>
      <p className="text-xs text-[#52525B] mb-4">{meta.hint}</p>

      <div className="space-y-3">
        <Field label="Base URL" icon={Link2}>
          <input data-testid={`ai-base-url-${featKey}`} value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            placeholder="https://api.contoh.com/v1" className="w-full h-11 rounded-xl border px-3 font-num" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Model" icon={Cpu}>
            <input data-testid={`ai-model-${featKey}`} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder={meta.modelPh} className="w-full h-11 rounded-xl border px-3 font-num" />
          </Field>
          <Field label={data.api_key_set ? "API Key (isi untuk ganti)" : "API Key"} icon={KeyRound}>
            <input data-testid={`ai-api-key-${featKey}`} type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder={data.api_key_set ? "••••••••••••" : "Masukkan API Key"} className="w-full h-11 rounded-xl border px-3 font-num" />
          </Field>
        </div>
      </div>

      {credit && credit.available && (
        <div data-testid={`ai-credit-${featKey}`} className="mt-4 flex items-center gap-3 bg-[#ECFDF5] border border-[#10B981] rounded-xl px-4 py-3">
          <Wallet size={18} className="text-[#047857]" />
          <div className="text-sm">
            <span className="font-extrabold text-[#047857] font-num">${credit.remaining}</span>
            <span className="text-[#52525B]"> sisa · terpakai ${credit.used} dari ${credit.total} ({credit.currency})</span>
          </div>
        </div>
      )}
      {credit && !credit.available && (
        <div data-testid={`ai-credit-${featKey}`} className="mt-4 text-xs text-[#B45309] bg-[#FEF3C7] border border-[#F59E0B] rounded-xl px-4 py-2.5 font-bold">
          {credit.message || "Info kredit tidak tersedia untuk penyedia ini."}
        </div>
      )}

      <div className="flex gap-2 mt-4 flex-wrap">
        <button data-testid={`save-ai-${featKey}`} onClick={save} disabled={saving}
          className="tap flex-1 min-w-[140px] h-12 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Simpan
        </button>
        <button data-testid={`credit-ai-${featKey}`} onClick={checkCredit} disabled={checking}
          className="tap h-12 px-4 rounded-xl bg-[#0A0A0A] hover:bg-[#27272A] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Cek Sisa Kredit
        </button>
      </div>
    </div>
  );
}

const Field = ({ label, icon: Icon, children }) => (
  <div>
    <label className="text-xs uppercase tracking-wider font-bold text-[#52525B] flex items-center gap-1.5">
      {Icon && <Icon size={13} />} {label}
    </label>
    <div className="mt-1.5">{children}</div>
  </div>
);
