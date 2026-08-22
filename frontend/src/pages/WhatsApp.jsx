import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, Loader2, Save, Send, RefreshCw, CheckCircle2, KeyRound, Smartphone, ExternalLink } from "lucide-react";

export default function WhatsApp() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState({ configured: false, api_key_set: false, api_key_masked: "", base_url: "", device_id: "", device_name: "" });
  const [apiKey, setApiKey] = useState("");
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [testNo, setTestNo] = useState("");
  const [testing, setTesting] = useState(false);
  const [manualDev, setManualDev] = useState("");

  const load = () => api.get("/whatsapp/config").then((r) => {
    setCfg(r.data);
  }).catch((e) => toast.error(apiError(e.response?.data?.detail))).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const saveKey = async () => {
    if (!apiKey.trim()) { toast.error("Masukkan API Key wacloud.id"); return; }
    setSaving(true);
    try {
      await api.put("/whatsapp/config", { api_key: apiKey.trim() });
      toast.success("API Key tersimpan");
      setApiKey("");
      await load();
      await loadDevices();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const r = await api.get("/whatsapp/devices");
      setDevices(r.data.devices || []);
      if (!(r.data.devices || []).length) toast.info("Belum ada device terhubung di wacloud.id");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoadingDevices(false); }
  };

  const chooseDevice = async (d) => {
    setSaving(true);
    try {
      await api.put("/whatsapp/config", { device_id: d.id, device_name: d.name || d.phone_number || "" });
      toast.success(`Device dipilih: ${d.name || d.id}`);
      await load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const saveManualDevice = async () => {
    if (!manualDev.trim()) { toast.error("Isi Device ID"); return; }
    setSaving(true);
    try {
      await api.put("/whatsapp/config", { device_id: manualDev.trim(), device_name: "Manual" });
      toast.success("Device ID tersimpan");
      setManualDev("");
      await load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testNo.trim()) { toast.error("Isi nomor tujuan tes"); return; }
    setTesting(true);
    try {
      await api.post("/whatsapp/test", { to: testNo.trim() });
      toast.success("Pesan tes terkirim!");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setTesting(false); }
  };

  if (loading) return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E63946]" /></div>;

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="wa-config-page">
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><MessageCircle className="text-[#25D366]" /> WhatsApp Gateway</h1>
          <p className="text-sm text-[#52525B] mt-1">
            Notifikasi WhatsApp via <b>wacloud.id</b> — ringan (tanpa Chromium), cocok untuk Raspberry Pi.
            Butuh internet hanya saat mengirim pesan.
          </p>
        </div>

        {/* STATUS */}
        <div className={`rounded-2xl border-2 p-4 flex items-center gap-3 ${cfg.configured ? "border-[#10B981] bg-[#F0FDF4]" : "border-[#F59E0B] bg-[#FFFBEB]"}`} data-testid="wa-status-box">
          {cfg.configured
            ? <><CheckCircle2 className="text-[#10B981]" /><div><div className="font-extrabold">Siap digunakan</div><div className="text-sm text-[#52525B]">Device: <b>{cfg.device_name || cfg.device_id}</b></div></div></>
            : <><KeyRound className="text-[#F59E0B]" /><div><div className="font-extrabold">Belum siap</div><div className="text-sm text-[#52525B]">Isi API Key lalu pilih device di bawah.</div></div></>}
        </div>

        {/* STEP 1: API KEY */}
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          <div className="font-extrabold flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-[#E63946] text-white grid place-items-center text-xs">1</span> API Key wacloud.id</div>
          <p className="text-sm text-[#52525B]">
            Dapatkan dari dashboard wacloud.id. {cfg.api_key_set && <span className="text-[#10B981] font-bold">Tersimpan: {cfg.api_key_masked}</span>}
          </p>
          <div className="flex gap-2">
            <input data-testid="wa-apikey-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={cfg.api_key_set ? "•••••••• (ganti bila perlu)" : "waha_xxx / API key Anda"}
              className="flex-1 h-11 rounded-xl border px-3 font-mono text-sm outline-none focus:border-[#E63946]" />
            <button data-testid="wa-apikey-save" onClick={saveKey} disabled={saving}
              className="tap h-11 px-4 rounded-xl bg-[#0A0A0A] text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
            </button>
          </div>
          <a href="https://wacloud.id/register" target="_blank" rel="noreferrer" className="text-xs text-[#E63946] font-bold inline-flex items-center gap-1">
            Belum punya akun? Daftar di wacloud.id <ExternalLink size={12} />
          </a>
        </div>

        {/* STEP 2: DEVICE */}
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-extrabold flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-[#E63946] text-white grid place-items-center text-xs">2</span> Pilih Device WhatsApp</div>
            <button data-testid="wa-load-devices" onClick={loadDevices} disabled={loadingDevices || !cfg.api_key_set}
              className="tap h-9 px-3 rounded-lg bg-[#F4F5F7] border font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
              {loadingDevices ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Muat Device
            </button>
          </div>
          <p className="text-sm text-[#52525B]">Nomor WhatsApp yang sudah Anda hubungkan (scan QR) di dashboard wacloud.id.</p>
          {devices.length === 0 ? (
            <div className="text-sm text-[#a1a1aa] border border-dashed rounded-xl p-4 text-center">
              {cfg.api_key_set ? "Klik \"Muat Device\" untuk menampilkan daftar." : "Simpan API Key dulu."}
            </div>
          ) : (
            <div className="space-y-2" data-testid="wa-device-list">
              {devices.map((d) => (
                <button key={d.id} data-testid={`wa-device-${d.id}`} onClick={() => chooseDevice(d)}
                  className={`w-full text-left rounded-xl border-2 p-3 flex items-center gap-3 tap ${cfg.device_id === d.id ? "border-[#10B981] bg-[#F0FDF4]" : "border-[#E4E4E7] hover:border-[#E63946]"}`}>
                  <Smartphone size={18} className={cfg.device_id === d.id ? "text-[#10B981]" : "text-[#52525B]"} />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{d.name || "Device"}</div>
                    <div className="text-xs text-[#a1a1aa]">{d.phone_number || d.id} · {d.status || "?"}</div>
                  </div>
                  {cfg.device_id === d.id && <CheckCircle2 size={18} className="text-[#10B981]" />}
                </button>
              ))}
            </div>
          )}
          <div className="pt-3 border-t mt-3">
            <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Atau isi Device ID manual</label>
            <div className="flex gap-2 mt-1.5">
              <input data-testid="wa-device-manual" value={manualDev} onChange={(e) => setManualDev(e.target.value)}
                placeholder="device id dari dashboard wacloud.id"
                className="flex-1 h-10 rounded-lg border px-3 font-mono text-xs outline-none focus:border-[#E63946]" />
              <button data-testid="wa-device-manual-save" onClick={saveManualDevice} disabled={saving}
                className="tap h-10 px-3 rounded-lg bg-[#0A0A0A] text-white font-bold text-xs disabled:opacity-50">Simpan</button>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-1">Pastikan device berstatus <b>connected</b> (sudah scan QR) di dashboard wacloud.id agar pesan bisa terkirim.</p>
          </div>
        </div>

        {/* STEP 3: TEST */}
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          <div className="font-extrabold flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-[#E63946] text-white grid place-items-center text-xs">3</span> Kirim Pesan Tes</div>
          <div className="flex gap-2">
            <input data-testid="wa-test-input" value={testNo} onChange={(e) => setTestNo(e.target.value)}
              placeholder="628123456789" className="flex-1 h-11 rounded-xl border px-3 font-mono text-sm outline-none focus:border-[#E63946]" />
            <button data-testid="wa-test-send" onClick={sendTest} disabled={testing || !cfg.configured}
              className="tap h-11 px-4 rounded-xl bg-[#25D366] text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim Tes
            </button>
          </div>
          <p className="text-[11px] text-[#a1a1aa]">Atur laporan otomatis (penjualan &amp; belanja harian) di menu <b>Laporan &amp; WhatsApp</b>.</p>
        </div>
      </div>
    </div>
  );
}
