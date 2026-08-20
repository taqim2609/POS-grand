import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Save, Loader2, ShieldAlert, KeyRound, Link2, Cpu } from "lucide-react";

export default function SettingsAI() {
  const [form, setForm] = useState({ openai_base_url: "", openai_model: "", openai_api_key: "" });
  const [keySet, setKeySet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings/ai")
      .then((r) => {
        setForm({ openai_base_url: r.data.openai_base_url || "", openai_model: r.data.openai_model || "", openai_api_key: "" });
        setKeySet(!!r.data.api_key_set);
      })
      .catch((e) => toast.error(apiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.openai_base_url.trim()) return toast.error("Base URL wajib diisi");
    if (!form.openai_model.trim()) return toast.error("Model wajib diisi");
    setSaving(true);
    try {
      const payload = { openai_base_url: form.openai_base_url.trim(), openai_model: form.openai_model.trim() };
      if (form.openai_api_key.trim()) payload.openai_api_key = form.openai_api_key.trim();
      await api.put("/settings/ai", payload);
      toast.success("Pengaturan AI tersimpan");
      setKeySet(keySet || !!form.openai_api_key.trim());
      setForm((f) => ({ ...f, openai_api_key: "" }));
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  if (loading) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-extrabold flex items-center gap-2 mb-2"><Sparkles /> Pengaturan AI</h1>
      <p className="text-sm text-[#52525B] mb-6">Gunakan penyedia AI OpenAI-compatible milik Anda sendiri untuk deskripsi produk, gambar, dan ringkasan laporan.</p>

      <div data-testid="ai-warning" className="flex items-start gap-3 bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] rounded-2xl px-4 py-3 mb-6 max-w-2xl">
        <ShieldAlert size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-extrabold">Peringatan Keamanan</div>
          API Key disimpan di server (database) aplikasi ini dan dipakai untuk memanggil penyedia AI Anda.
          Jangan bagikan key ke pihak lain, dan gunakan key dengan kuota/biaya yang Anda pahami — setiap
          permintaan AI dapat dikenakan biaya oleh penyedia. Kosongkan kolom API Key jika tidak ingin mengubahnya.
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-6 max-w-2xl space-y-4">
        <Field label="Base URL" icon={Link2}>
          <input data-testid="ai-base-url" value={form.openai_base_url} onChange={(e) => setForm({ ...form, openai_base_url: e.target.value })}
            placeholder="https://api.contoh.com/v1" className="w-full h-11 rounded-xl border px-3 font-num" />
        </Field>
        <Field label="Model" icon={Cpu}>
          <input data-testid="ai-model" value={form.openai_model} onChange={(e) => setForm({ ...form, openai_model: e.target.value })}
            placeholder="claude-sonnet-5" className="w-full h-11 rounded-xl border px-3 font-num" />
        </Field>
        <Field label={`API Key ${keySet ? "(sudah tersimpan — isi untuk ganti)" : ""}`} icon={KeyRound}>
          <input data-testid="ai-api-key" type="password" value={form.openai_api_key} onChange={(e) => setForm({ ...form, openai_api_key: e.target.value })}
            placeholder={keySet ? "••••••••••••••••" : "Masukkan API Key"} className="w-full h-11 rounded-xl border px-3 font-num" />
          {keySet && <span className="text-[11px] text-[#047857] font-bold">Status: API Key aktif</span>}
        </Field>
        <button data-testid="save-ai-settings-btn" onClick={save} disabled={saving}
          className="tap w-full h-12 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Simpan Pengaturan
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
