import { useEffect, useRef, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { collectVersions } from "@/lib/versions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Bot, Send, Loader2, Sparkles, User, Cpu, CheckCircle2, X, Wand2, Settings as SettingsIcon,
  History, Plus, Trash2, MessageSquare, Lightbulb, ShoppingCart,
} from "lucide-react";

const SUGGESTIONS = [
  "Berapa total penjualan hari ini?",
  "Apa produk terlaris hari ini?",
  "Bandingkan penjualan hari ini dengan kemarin",
  "Berapa total belanja hari ini?",
  "Buat kategori baru 'Kopi' untuk minuman",
  "Tambah banyak produk: Kopi Susu 18000, Teh Tarik 15000, Roti Bakar 12000",
  "Nonaktifkan produk Es Teh Manis",
  "Hapus kategori Kopi",
  "Ubah harga produk Nasi Goreng jadi 22000",
];

const ACTION_LABEL = {
  create_category: "Buat Kategori",
  create_vendor: "Buat Vendor",
  create_payment_method: "Buat Metode Pembayaran",
  create_product: "Buat Produk",
  create_products_bulk: "Buat Banyak Produk",
  update_product: "Ubah Produk",
  deactivate_product: "Nonaktifkan Produk",
  delete_product: "Hapus Produk",
  deactivate_category: "Nonaktifkan Kategori",
  delete_category: "Hapus Kategori",
};

const DESTRUCTIVE = new Set(["delete_product", "delete_category"]);

const FIELD_LABEL = {
  name: "Nama", kind: "Tipe", contact: "Kontak", note: "Catatan", pm_type: "Jenis",
  price: "Harga", cost: "HPP", stock: "Stok", sku: "SKU", description: "Deskripsi",
  category_name: "Kategori", vendor_name: "Vendor", sold_out: "Habis", active: "Aktif",
};

function ActionCard({ action, state, result, onApply, canApply }) {
  const danger = DESTRUCTIVE.has(action.type);
  const isBulk = action.type === "create_products_bulk";
  const items = isBulk ? (Array.isArray(action.items) ? action.items : []) : [];
  const rows = Object.entries(action).filter(([k]) => k !== "type" && k !== "items");
  const border = danger ? "border-[#DC2626] bg-[#FEF2F2]" : "border-[#2563EB] bg-[#EFF6FF]";
  const titleColor = danger ? "text-[#B91C1C]" : "text-[#1D4ED8]";
  return (
    <div className={`mt-3 rounded-xl border-2 ${border} p-3.5`} data-testid="assistant-action-card">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 size={16} className={titleColor} />
        <span className={`font-extrabold text-sm ${titleColor}`}>{ACTION_LABEL[action.type] || action.type}</span>
        {isBulk && <span className="text-xs font-bold text-[#2563EB] bg-white border border-[#BFDBFE] rounded-full px-2 py-0.5">{items.length} produk</span>}
      </div>

      {isBulk ? (
        <div className="rounded-lg bg-white border border-[#BFDBFE] max-h-56 overflow-y-auto text-sm" data-testid="assistant-bulk-list">
          {items.map((it, idx) => (
            <div key={idx} className="flex justify-between gap-3 px-3 py-1.5 border-b last:border-0">
              <span className="font-semibold truncate">{it.name || "(tanpa nama)"} <span className="text-[#a1a1aa] font-normal">· {it.category_name || it.kind || "retail"}</span></span>
              <span className="font-bold shrink-0">Rp {Number(it.price || 0).toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-white border divide-y text-sm" style={{ borderColor: danger ? "#FECACA" : "#BFDBFE" }}>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 px-3 py-1.5">
              <span className="text-[#52525B]">{FIELD_LABEL[k] || k}</span>
              <span className="font-bold text-right break-all">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {state === "applied" ? (
        <div className="mt-2.5">
          <div className="flex items-center gap-1.5 text-[#047857] font-bold text-sm"><CheckCircle2 size={16} /> Sudah diterapkan</div>
          {result?.results && (
            <div className="mt-1.5 text-xs text-[#52525B]">
              <span className="font-bold text-[#047857]">{result.results.created?.length || 0} berhasil</span>
              {result.results.errors?.length > 0 && <span className="font-bold text-[#B91C1C]"> · {result.results.errors.length} gagal</span>}
              {result.results.errors?.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-[#B91C1C]">
                  {result.results.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : state === "cancelled" ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-[#71717A] font-bold text-sm"><X size={16} /> Dibatalkan</div>
      ) : (
        <div className="mt-2.5 flex gap-2">
          {canApply ? (
            <>
              <button data-testid="assistant-apply-btn" onClick={() => onApply("apply")} disabled={state === "applying"}
                className={`tap flex-1 h-10 rounded-lg text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 ${danger ? "bg-[#DC2626]" : "bg-[#2563EB]"}`}>
                {state === "applying" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Terapkan
              </button>
              <button data-testid="assistant-cancel-btn" onClick={() => onApply("cancel")} disabled={state === "applying"}
                className="tap h-10 px-4 rounded-lg border-2 border-[#71717A] text-[#52525B] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                <X size={15} /> Batal
              </button>
            </>
          ) : (
            <div className="text-xs font-bold text-[#71717A] flex items-center gap-1.5"><X size={14} /> Penerapan aksi hanya untuk admin</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AssistantAI() {
  const { user } = useAuth();
  const [sid, setSid] = useState(null);
  const [messages, setMessages] = useState([]); // {role, text, error?, action?, actionState?}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [featOpen, setFeatOpen] = useState(false);
  const [featText, setFeatText] = useState("");
  const [featSending, setFeatSending] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [recData, setRecData] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  const loadRec = async () => {
    setRecLoading(true); setRecData(null); setRecOpen(true);
    try {
      const { data } = await api.post("/ai/purchase-recommendation");
      setRecData(data);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); setRecOpen(false); }
    finally { setRecLoading(false); }
  };

  const sendFeature = async () => {
    const msg = featText.trim();
    if (!msg) return toast.error("Tulis permintaan fitur dulu");
    setFeatSending(true);
    const t = toast.loading("Mengirim permintaan fitur ke VibeCoder...");
    try {
      let context = "";
      try {
        const v = await collectVersions();
        context = `Platform: ${v.native ? `APK v${v.apk}` : "Web"} | Bundle: ${v.bundle} | Server: ${v.serverVersion || "-"} | OTA: ${v.otaInstalled || "-"}`;
      } catch (_) {}
      await api.post("/feature-request/send", { message: msg, context });
      toast.success("Permintaan fitur terkirim ke VibeCoder — sebutkan di chat bahwa Anda sudah mengirimnya", { id: t, duration: 8000 });
      setFeatOpen(false); setFeatText("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal mengirim (periksa internet server)", { id: t, duration: 10000 });
    } finally {
      setFeatSending(false);
    }
  };
  const [keySet, setKeySet] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const loadCfg = () =>
    api.get("/settings/ai").then((r) => {
      const a = r.data.features?.assistant || {};
      setProvider(a.provider || "gemini");
      setKeySet(!!a.api_key_set);
    }).catch(() => {});
  const loadSessions = () =>
    api.get("/ai/assistant/sessions").then((r) => setSessions(r.data.sessions || [])).catch(() => {});
  useEffect(() => { loadCfg(); loadSessions(); }, []);

  const newChat = () => { setSid(null); setMessages([]); setShowHistory(false); };

  const openSession = async (id) => {
    setShowHistory(false);
    setLoading(true);
    try {
      const r = await api.get(`/ai/assistant/sessions/${id}`);
      setSid(id);
      setMessages((r.data.messages || []).map((m) => ({ role: m.role, text: m.text })));
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai/assistant/sessions/${id}`);
      setSessions((s) => s.filter((x) => x.id !== id));
      if (id === sid) newChat();
      toast.success("Percakapan dihapus");
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
  };

  const pickProvider = async (p) => {
    if (p === provider) return;
    setSavingProvider(true);
    try {
      await api.put("/settings/ai", { feature: "assistant", provider: p });
      setProvider(p);
      await loadCfg();
      toast.success(`Provider asisten: ${p === "gemini" ? "Gemini AI" : "chenzk"}`);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSavingProvider(false); }
  };

  const ask = async (q) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const r = await api.post("/ai/assistant/chat", { session_id: sid, message: question });
      if (r.data.session_id) setSid(r.data.session_id);
      setMessages((m) => [...m, {
        role: "assistant", text: r.data.reply,
        action: r.data.action || null, actionState: r.data.action ? "pending" : null,
      }]);
      loadSessions();
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${apiError(e.response?.data?.detail)}`, error: true }]);
    } finally { setLoading(false); }
  };

  const handleAction = async (idx, mode) => {
    if (mode === "cancel") {
      setMessages((m) => m.map((msg, i) => i === idx ? { ...msg, actionState: "cancelled" } : msg));
      return;
    }
    setMessages((m) => m.map((msg, i) => i === idx ? { ...msg, actionState: "applying" } : msg));
    try {
      const r = await api.post("/ai/assistant/apply", { action: messages[idx].action });
      setMessages((m) => m.map((msg, i) => i === idx ? { ...msg, actionState: "applied", actionResult: r.data } : msg));
      toast.success(r.data.message || "Berhasil diterapkan");
    } catch (e) {
      setMessages((m) => m.map((msg, i) => i === idx ? { ...msg, actionState: "pending" } : msg));
      toast.error(apiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]" data-testid="assistant-ai-page">
      {/* header + provider selector */}
      <div className="border-b bg-white px-4 lg:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-extrabold flex items-center gap-2"><Sparkles className="text-[#E63946]" size={20} /> AI</h1>
          <button data-testid="assistant-new-chat" onClick={newChat}
            className="tap h-9 px-3 rounded-lg border-2 border-[#E63946] text-[#E63946] font-bold text-sm flex items-center gap-1.5 hover:bg-[#E63946] hover:text-white transition-colors">
            <Plus size={15} /> Baru
          </button>
          <button data-testid="assistant-feature-btn" onClick={() => setFeatOpen(true)}
            className="tap h-9 px-3 rounded-lg border-2 border-[#4F46E5] text-[#4F46E5] font-bold text-sm flex items-center gap-1.5 hover:bg-[#4F46E5] hover:text-white transition-colors">
            <Lightbulb size={15} /> Usulkan Fitur
          </button>
          <button data-testid="assistant-rec-btn" onClick={loadRec}
            className="tap h-9 px-3 rounded-lg border-2 border-[#047857] text-[#047857] font-bold text-sm flex items-center gap-1.5 hover:bg-[#047857] hover:text-white transition-colors">
            <ShoppingCart size={15} /> Rekomendasi Stok
          </button>
          <button data-testid="assistant-history-toggle" onClick={() => { setShowHistory((v) => !v); loadSessions(); }}
            className={`tap h-9 px-3 rounded-lg border-2 font-bold text-sm flex items-center gap-1.5 transition-colors ${showHistory ? "bg-[#0A0A0A] border-[#0A0A0A] text-white" : "border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA]"}`}>
            <History size={15} /> Riwayat
          </button>
        </div>
        {user.role === "admin" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#71717A] hidden sm:block">Provider:</span>
            <button data-testid="assistant-provider-gemini" onClick={() => pickProvider("gemini")} disabled={savingProvider}
              className={`tap h-9 px-3 rounded-lg border-2 font-bold text-sm flex items-center gap-1.5 ${provider === "gemini" ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-[#BFDBFE] text-[#2563EB]"}`}>
              <Sparkles size={14} /> Gemini AI
            </button>
            <button data-testid="assistant-provider-chenzk" onClick={() => pickProvider("chenzk")} disabled={savingProvider}
              className={`tap h-9 px-3 rounded-lg border-2 font-bold text-sm flex items-center gap-1.5 ${provider === "chenzk" ? "bg-[#0A0A0A] border-[#0A0A0A] text-white" : "border-[#D4D4D8] text-[#0A0A0A]"}`}>
              <Cpu size={14} /> chenzk
            </button>
          </div>
        )}
      </div>

      {provider === "chenzk" && !keySet && (
        <div className="bg-[#FEF3C7] border-b border-[#F59E0B] text-[#92400E] text-sm px-4 lg:px-6 py-2.5 flex items-center gap-2" data-testid="assistant-key-warning">
          <SettingsIcon size={16} className="shrink-0" />
          Provider chenzk belum ada API Key/model. Atur di{" "}
          <Link to="/settings-ai" className="font-extrabold underline">Pengaturan AI</Link>.
        </div>
      )}

      {showHistory && (
        <div className="border-b bg-[#FAFAFA] max-h-64 overflow-y-auto" data-testid="assistant-history-panel">
          <div className="px-4 lg:px-6 py-2 text-xs font-bold text-[#71717A] uppercase tracking-wider">Riwayat Percakapan</div>
          {sessions.length === 0 && <div className="px-4 lg:px-6 pb-3 text-sm text-[#a1a1aa]">Belum ada percakapan tersimpan.</div>}
          {sessions.map((s) => (
            <div key={s.id} data-testid={`assistant-session-${s.id}`} onClick={() => openSession(s.id)}
              className={`px-4 lg:px-6 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-white border-t ${s.id === sid ? "bg-white" : ""}`}>
              <MessageSquare size={16} className="text-[#E63946] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{s.title}</div>
                <div className="text-[11px] text-[#a1a1aa]">{s.count} pesan · {s.updated_at ? new Date(s.updated_at).toLocaleString("id-ID") : ""}</div>
              </div>
              <button data-testid={`assistant-session-del-${s.id}`} onClick={(e) => deleteSession(s.id, e)}
                className="tap p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#DC2626] hover:bg-[#FEF2F2]">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center pt-8" data-testid="assistant-empty">
            <div className="h-14 w-14 rounded-2xl bg-[#E63946] grid place-items-center mx-auto mb-4">
              <Bot className="text-white" size={26} />
            </div>
            <h2 className="text-xl font-extrabold">Asisten Admin</h2>
            <p className="text-sm text-[#52525B] mt-1 mb-6">Minta bantuan kelola produk, kategori, vendor, harga, diskon & metode pembayaran. Setiap perubahan data akan minta konfirmasi <b>Terapkan</b>. Contoh:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} data-testid={`assistant-suggest-${s.slice(0, 6)}`} onClick={() => ask(s)}
                  className="tap text-sm font-semibold bg-white border rounded-full px-4 py-2 hover:border-[#E63946] hover:text-[#E63946] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 max-w-2xl ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`} data-testid={`assistant-msg-${m.role}-${i}`}>
            <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${m.role === "user" ? "bg-[#0A0A0A]" : "bg-[#E63946]"}`}>
              {m.role === "user" ? <User size={15} className="text-white" /> : <Sparkles size={15} className="text-white" />}
            </div>
            <div className="max-w-full">
              <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-[#0A0A0A] text-white" : m.error ? "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]" : "bg-white border"}`}>
                {m.text}
              </div>
              {m.action && (
                <ActionCard action={m.action} state={m.actionState} result={m.actionResult} canApply={user.role === "admin"} onApply={(mode) => handleAction(i, mode)} />
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 max-w-2xl mr-auto" data-testid="assistant-thinking">
            <div className="h-8 w-8 rounded-full bg-[#E63946] grid place-items-center shrink-0"><Sparkles size={15} className="text-white" /></div>
            <div className="rounded-2xl px-4 py-3 bg-white border"><Loader2 size={16} className="animate-spin text-[#E63946]" /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* input — padding bawah aman dari tombol navigasi Android (safe-area) */}
      <div className="border-t bg-white p-3 lg:p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            data-testid="assistant-input" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            placeholder="Mis. buat produk Kopi Susu harga 18000 kategori Minuman…"
            className="flex-1 h-12 rounded-xl border px-4 outline-none focus:border-[#E63946]" />
          <button data-testid="assistant-send" onClick={() => ask()} disabled={loading || !input.trim()}
            className="tap h-12 w-12 rounded-xl bg-[#E63946] text-white grid place-items-center disabled:opacity-50">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* Dialog Rekomendasi Stok */}
      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent data-testid="rec-dialog" className="max-h-[88vh] overflow-y-auto max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingCart size={18} className="text-[#047857]" /> Rekomendasi Pembelian Stok</DialogTitle></DialogHeader>
          {recLoading && <div className="py-10 grid place-items-center"><Loader2 size={28} className="animate-spin text-[#E63946]" /></div>}
          {recData?.ai_summary && (
            <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-sm whitespace-pre-wrap" data-testid="rec-ai">{recData.ai_summary}</div>
          )}
          {recData && (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
                  <tr><th className="text-left p-2.5">Produk</th><th className="text-right p-2.5">Stok</th><th className="text-right p-2.5">Terjual 30hr</th><th className="text-right p-2.5">Rata/hari</th><th className="text-right p-2.5">Saran Beli</th></tr>
                </thead>
                <tbody>
                  {(recData.rows || []).slice(0, 40).map((r) => (
                    <tr key={r.product_id} className="border-t">
                      <td className="p-2.5 font-bold">{r.name}</td>
                      <td className={`p-2.5 text-right font-num ${r.stock <= r.min_stock ? "text-[#EF4444] font-bold" : ""}`}>{r.stock}</td>
                      <td className="p-2.5 text-right font-num">{r.sold_30d}</td>
                      <td className="p-2.5 text-right font-num">{r.daily_avg}</td>
                      <td className="p-2.5 text-right font-num font-bold text-[#047857]">{r.suggest}</td>
                    </tr>
                  ))}
                  {!recData.rows?.length && <tr><td colSpan={5} className="p-6 text-center text-[#a1a1aa]">Tidak ada produk retail ber-stok.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Usulkan Fitur */}
      <Dialog open={featOpen} onOpenChange={setFeatOpen}>
        <DialogContent data-testid="feature-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lightbulb size={18} className="text-[#4F46E5]" /> Usulkan Fitur untuk VibeCoder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#52525B] -mt-2">Jelaskan fitur yang Anda inginkan. Permintaan ini dikirim ke vibecoder.co.id untuk dipelajari, lalu saya buatkan kodenya dan kirim lewat update berikutnya.</p>
          <textarea
            data-testid="feature-input"
            value={featText}
            onChange={(e) => setFeatText(e.target.value)}
            placeholder="Contoh: tambahkan laporan penjualan per shift, atau tombol rekap harian di dashboard kasir…"
            rows={5}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[#4F46E5] resize-y"
          />
          <DialogFooter className="flex gap-2">
            <button data-testid="feature-cancel" onClick={() => setFeatOpen(false)} disabled={featSending}
              className="tap h-10 px-4 rounded-lg border-2 border-[#D4D4D8] text-[#52525B] font-bold text-sm disabled:opacity-50">Batal</button>
            <button data-testid="feature-send" onClick={sendFeature} disabled={featSending || !featText.trim()}
              className="tap h-10 px-5 rounded-lg bg-[#4F46E5] text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">
              {featSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Kirim Permintaan
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
