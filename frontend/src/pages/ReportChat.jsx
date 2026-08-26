import { useEffect, useRef, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Bot, Send, Loader2, MessageCircle, Sparkles, User } from "lucide-react";

const SUGGESTIONS = [
  "Berapa total penjualan hari ini?",
  "Apa produk terlaris hari ini?",
  "Bandingkan penjualan hari ini dengan kemarin",
  "Berapa total belanja hari ini?",
];

export default function ReportChat() {
  const { user } = useAuth();
  const [sid] = useState(() => `rc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingWa, setSendingWa] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const ask = async (q) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const r = await api.post("/ai/report-chat", { session_id: sid, message: question });
      setMessages((m) => [...m, { role: "assistant", text: r.data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${apiError(e.response?.data?.detail)}`, error: true }]);
    } finally { setLoading(false); }
  };

  const sendToWa = async (text, idx) => {
    setSendingWa(idx);
    try {
      const r = await api.post("/ai/report-chat/send-wa", { text });
      toast.success(`Laporan terkirim ke WhatsApp (${(r.data.recipients || []).length} nomor)`);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSendingWa(null); }
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]" data-testid="report-chat-page">
      {/* messages */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center pt-8" data-testid="chat-empty">
            <div className="h-14 w-14 rounded-2xl bg-[#E63946] grid place-items-center mx-auto mb-4">
              <Bot className="text-white" size={26} />
            </div>
            <h2 className="text-xl font-extrabold">Tanya AI tentang Laporan</h2>
            <p className="text-sm text-[#52525B] mt-1 mb-6">Tanyakan apa saja soal penjualan & belanja. Contoh:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} data-testid={`suggest-${s.slice(0, 8)}`} onClick={() => ask(s)}
                  className="tap text-sm font-semibold bg-white border rounded-full px-4 py-2 hover:border-[#E63946] hover:text-[#E63946] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 max-w-2xl ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`} data-testid={`msg-${m.role}-${i}`}>
            <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${m.role === "user" ? "bg-[#0A0A0A]" : "bg-[#E63946]"}`}>
              {m.role === "user" ? <User size={15} className="text-white" /> : <Sparkles size={15} className="text-white" />}
            </div>
            <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-[#0A0A0A] text-white" : m.error ? "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]" : "bg-white border"}`}>
              {m.text}
              {m.role === "assistant" && !m.error && user.role === "admin" && (
                <button data-testid={`send-wa-${i}`} onClick={() => sendToWa(m.text, i)} disabled={sendingWa === i}
                  className="tap mt-2 flex items-center gap-1.5 text-xs font-bold text-[#25D366] hover:underline disabled:opacity-50">
                  {sendingWa === i ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} Kirim ke WhatsApp
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 max-w-2xl mr-auto" data-testid="chat-thinking">
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
            data-testid="chat-input" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            placeholder="Tanya soal penjualan atau belanja…"
            className="flex-1 h-12 rounded-xl border px-4 outline-none focus:border-[#E63946]" />
          <button data-testid="chat-send" onClick={() => ask()} disabled={loading || !input.trim()}
            className="tap h-12 w-12 rounded-xl bg-[#E63946] text-white grid place-items-center disabled:opacity-50">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
