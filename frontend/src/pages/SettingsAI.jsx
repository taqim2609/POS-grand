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
  vision: { label: "Baca Faktur (Vision)", icon: FileText, hint: "Model yang mendukung GAMBAR/vision (mis. claude-sonnet-5, gpt-4o) untuk membaca foto faktur pembelian.", modelPh: "claude-sonnet-5" },
  assistant: { label: "Asisten Admin AI", icon: Sparkles, hint: "Model teks untuk Asisten AI (tanya soal data, usulan aksi terapkan).", modelPh: "claude-sonnet-5" },
};

export default function SettingsAI() {
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gemKeys, setGemKeys] = useState([]);
  const [gemKeysText, setGemKeysText] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);

  const load = () =>
    api.get("/settings/ai")
      .then((r) => setFeatures(r.data.features))
      .catch((e) => toast.error(apiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));

  const loadGemKeys = () =>
    api.get("/settings/ai/gemini-keys").then((r) => {
      setGemKeys(r.data.keys || []);
      // isi textarea hanya dari key yang tersimpan DB (masked tak bisa dipakai ulang — tampilkan jumlah)
      setGemKeysText("");
    }).catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); loadGemKeys(); }, []);

  const saveGemKeys = async () => {
    const lines = gemKeysText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return toast.error("Isi minimal 1 API key Gemini (satu per baris)");
    setSavingKeys(true);
    try {
      await api.put("/settings/ai/gemini-keys", { keys: lines });
      toast.success(`${lines.length} API key Gemini disimpan — rotasi otomatis aktif`);
      setGemKeysText("");
      loadGemKeys();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSavingKeys(false); }
  };

  if (loading || !features) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-extrabold flex items-center gap-2 mb-2"><Sparkles /> Pengaturan AI</h1>
      <p className="text-sm text-[#52525B] mb-6">Atur penyedia AI OpenAI-compatible Anda sendiri, terpisah untuk tiap fungsi: deskripsi, gambar, analisis laporan, dan asisten admin AI.</p>

      <div data-testid="ai-warning" className="flex items-start gap-3 bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] rounded-2xl px-4 py-3 mb-6 max-w-3xl">
        <ShieldAlert size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-extrabold">Peringatan Keamanan &amp; Biaya</div>
          API Key disimpan di server aplikasi ini dan dipakai untuk memanggil penyedia AI Anda. Jangan bagikan key ke pihak lain.
          Setiap permintaan AI dapat mengurangi saldo/kredit di akun penyedia Anda — pantau lewat tombol Cek Sisa Kredit.
          Kosongkan kolom API Key jika tidak ingin mengubah key yang sudah tersimpan.
        </div>
      </div>

      <div className="grid gap-5 max-w-3xl">
        {/* Kartu rotasi API key Gemini */}
        <div className="bg-white rounded-2xl border p-6" data-testid="gemini-keys-card">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="font-extrabold text-lg flex items-center gap-2"><KeyRound size={18} className="text-[#2563EB]" /> Gemini API Keys (Rotasi Otomatis)</h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">{gemKeys.length} key tersimpan</span>
          </div>
          <p className="text-xs text-[#52525B] mb-3">
            Simpan <b>beberapa API key Gemini</b> (satu per baris). Bila satu key kena limit harian (429), aplikasi
            <b> otomatis beralih ke key berikutnya</b>. Buat key di{" "}
            <a href="https://aistudio.google.com/docs/api-key" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] font-bold underline">aistudio.google.com/docs/api-key</a>.
          </p>
          {gemKeys.length > 0 && (
            <div className="mb-2 text-xs text-[#047857] font-mono bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3 py-2">
              {gemKeys.map((k, i) => <div key={i}>#{i + 1}: {k}</div>)}
            </div>
          )}
          <textarea data-testid="gemini-keys-input" value={gemKeysText} onChange={(e) => setGemKeysText(e.target.value)} rows={4}
            placeholder={"AIzaSy...\nAIzaSy...\n(dst, satu per baris)"}
            className="w-full rounded-xl border px-3 py-2.5 text-sm font-mono outline-none focus:border-[#2563EB] resize-y" />
          <button data-testid="save-gemini-keys" onClick={saveGemKeys} disabled={savingKeys || !gemKeysText.trim()}
            className="tap mt-2 h-11 px-5 rounded-xl bg-[#2563EB] text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">
            {savingKeys ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Key &amp; Aktifkan Rotasi
          </button>
        </div>
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
  const [provider, setProvider] = useState(data.provider || "gemini");
  const [form, setForm] = useState({ base_url: data.base_url || "", model: data.model || "", api_key: "" });
  const [saving, setSaving] = useState(false);
  const [credit, setCredit] = useState(null);
  const [checking, setChecking] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const isGemini = provider === "gemini";
  const pickProvider = (p) => {
    setProvider(p);
    if (p === "chenzk" && !form.base_url.trim()) setForm((f) => ({ ...f, base_url: "https://chenzk.top/v1" }));
  };

  const save = async () => {
    if (!isGemini && !form.base_url.trim()) return toast.error("Base URL wajib diisi untuk chenzk");
    setSaving(true);
    try {
      const payload = { feature: featKey, provider, model: form.model.trim() };
      if (!isGemini) payload.base_url = form.base_url.trim();
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

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const { data: d } = await api.get("/settings/ai/models", { params: { feature: featKey } });
      setModels(d.models || []);
      toast.success(`${(d.models || []).length} model dimuat (termurah di atas)`);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoadingModels(false); }
  };

  return (
    <div className="bg-white rounded-2xl border p-6" data-testid={`ai-feature-${featKey}`}>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-extrabold text-lg flex items-center gap-2"><Icon size={18} className="text-[#E63946]" /> {meta.label}</h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${data.api_key_set ? "bg-[#D1FAE5] text-[#047857]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
          {data.api_key_set ? `Key aktif ${data.api_key_last4}` : "Belum ada key"}
        </span>
      </div>
      <p className="text-xs text-[#52525B] mb-3">{meta.hint}</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button type="button" data-testid={`provider-gemini-${featKey}`} onClick={() => pickProvider("gemini")}
          className={`tap h-11 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-colors ${isGemini ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-[#BFDBFE] text-[#2563EB] hover:bg-[#EFF6FF]"}`}>
          <Sparkles size={16} /> Gemini AI
        </button>
        <button type="button" data-testid={`provider-chenzk-${featKey}`} onClick={() => pickProvider("chenzk")}
          className={`tap h-11 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-colors ${!isGemini ? "bg-[#0A0A0A] border-[#0A0A0A] text-white" : "border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA]"}`}>
          <Cpu size={16} /> chenzk
        </button>
      </div>

      <div className="space-y-3">
        {!isGemini && (
          <Field label="Base URL" icon={Link2}>
            <input data-testid={`ai-base-url-${featKey}`} value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://chenzk.top/v1" className="w-full h-11 rounded-xl border px-3 font-num" />
            <button type="button" data-testid={`preset-chenzk-${featKey}`}
              onClick={() => setForm({ ...form, base_url: "https://chenzk.top/v1" })}
              className="mt-1.5 text-[11px] font-bold text-[#E63946] hover:underline">
              + Pakai endpoint chenzk (ezkielyna.store)
            </button>
          </Field>
        )}
        {isGemini && (
          <p className="text-[11px] text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-3 py-2">
            Mode Gemini memakai <b>default otomatis</b> (model &amp; kunci) atau <b>rotasi key</b> dari kartu "Gemini API Keys" di atas — tidak perlu memilih model/API key di sini.
          </p>
        )}
        {!isGemini && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Model" icon={Cpu}>
              <input data-testid={`ai-model-${featKey}`} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                list={`models-${featKey}`} placeholder={meta.modelPh} className="w-full h-11 rounded-xl border px-3 font-num" />
              <datalist id={`models-${featKey}`}>
                {models.map((m) => <option key={m} value={m} />)}
              </datalist>
            </Field>
            <Field label={data.api_key_set ? "API Key (isi untuk ganti)" : "API Key"} icon={KeyRound}>
              <input data-testid={`ai-api-key-${featKey}`} type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder={data.api_key_set ? "••••••••••••" : "Masukkan API Key"} className="w-full h-11 rounded-xl border px-3 font-num" />
            </Field>
          </div>
        )}
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
        {!isGemini && (
          <>
            <button data-testid={`credit-ai-${featKey}`} onClick={checkCredit} disabled={checking}
              className="tap h-12 px-4 rounded-xl bg-[#0A0A0A] hover:bg-[#27272A] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Cek Sisa Kredit
            </button>
            <button data-testid={`load-models-${featKey}`} onClick={loadModels} disabled={loadingModels}
              className="tap h-12 px-4 rounded-xl border-2 border-[#0A0A0A] text-[#0A0A0A] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {loadingModels ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />} Muat Model
            </button>
          </>
        )}
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
