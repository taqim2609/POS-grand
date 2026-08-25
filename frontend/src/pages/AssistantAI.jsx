import { useEffect, useRef, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Bot, Send, Loader2, Sparkles, User, Cpu, CheckCircle2, X, Wand2, Settings as SettingsIcon,
} from "lucide-react";

const SUGGESTIONS = [
  "Buat kategori baru 'Kopi' untuk minuman",
  "Tambah produk Nasi Goreng harga 20000 kategori Makanan",
  "Buat vendor baru bernama Toko Sumber Rezeki",
  "Ubah harga produk Es Teh Manis jadi 6000",
  "Tambah metode pembayaran QRIS BCA",
];

const ACTION_LABEL = {
  create_category: "Buat Kategori",
  create_vendor: "Buat Vendor",
  create_payment_method: "Buat Metode Pembayaran",
  create_product: "Buat Produk",
  update_product: "Ubah Produk",
};

const FIELD_LABEL = {
  name: "Nama", kind: "Tipe", contact: "Kontak", note: "Catatan", pm_type: "Jenis",
  price: "Harga", cost: "HPP", stock: "Stok", sku: "SKU", description: "Deskripsi",
  category_name: "Kategori", vendor_name: "Vendor", sold_out: "Habis", active: "Aktif",
};

function ActionCard({ action, state, onApply }) {
  const rows = Object.entries(action).filter(([k]) => k !== "type");
  return (
    <div className="mt-3 rounded-xl border-2 border-[#2563EB] bg-[#EFF6FF] p-3.5" data-testid="assistant-action-card">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 size={16} className="text-[#2563EB]" />
        <span className="font-extrabold text-[#1D4ED8] text-sm">{ACTION_LABEL[action.type] || action.type}</span>
      </div>
      <div className="rounded-lg bg-white border border-[#BFDBFE] divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-3 py-1.5">
            <span className="text-[#52525B]">{FIELD_LABEL[k] || k}</span>
            <span className="font-bold text-right break-all">{String(v)}</span>
          </div>
        ))}
      </div>
      {state === "applied" ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-[#047857] font-bold text-sm">
          <CheckCircle2 size={16} /> Sudah diterapkan
        </div>
      ) : state === "cancelled" ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-[#71717A] font-bold text-sm">
          <X size={16} /> Dibatalkan
        </div>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <button data-testid="assistant-apply-btn" onClick={() => onApply("apply")} disabled={state === "applying"}
            className="tap flex-1 h-10 rounded-lg bg-[#2563EB] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {state === "applying" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Terapkan
          </button>
          <button data-testid="assistant-cancel-btn" onClick={() => onApply("cancel")} disabled={state === "applying"}
            className="tap h-10 px-4 rounded-lg border-2 border-[#71717A] text-[#52525B] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            <X size={15} /> Batal
          </button>
        </div>
      )}
    </div>
  );
}

export default function AssistantAI() {
  const [sid, setSid] = useState(null);
  const [messages, setMessages] = useState([]); // {role, text, error?, action?, actionState?}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [keySet, setKeySet] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const loadCfg = () =>
    api.get("/settings/ai").then((r) => {
      const a = r.data.features?.assistant || {};
      setProvider(a.provider || "gemini");
      setKeySet(!!a.api_key_set);
    }).catch(() => {});
  useEffect(() => { loadCfg(); }, []);

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
      setMessages((m) => m.map((msg, i) => i === idx ? { ...msg, actionState: "applied" } : msg));
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
        <h1 className="text-lg font-extrabold flex items-center gap-2"><Sparkles className="text-[#E63946]" size={20} /> Asisten Admin AI</h1>
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
      </div>

      {provider === "chenzk" && !keySet && (
        <div className="bg-[#FEF3C7] border-b border-[#F59E0B] text-[#92400E] text-sm px-4 lg:px-6 py-2.5 flex items-center gap-2" data-testid="assistant-key-warning">
          <SettingsIcon size={16} className="shrink-0" />
          Provider chenzk belum ada API Key/model. Atur di{" "}
          <Link to="/settings-ai" className="font-extrabold underline">Pengaturan AI</Link>.
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
                <ActionCard action={m.action} state={m.actionState} onApply={(mode) => handleAction(i, mode)} />
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

      {/* input */}
      <div className="border-t bg-white p-3 lg:p-4">
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
    </div>
  );
}
