import { useEffect, useRef, useState } from "react";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, Loader2, Send, LogOut, RefreshCw, QrCode } from "lucide-react";

export default function WhatsApp() {
  const [status, setStatus] = useState({ ready: false, qr: null });
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const timer = useRef(null);

  const loadStatus = () => api.get("/whatsapp/status").then((r) => setStatus(r.data)).catch(() => {});
  useEffect(() => {
    loadStatus();
    timer.current = setInterval(loadStatus, 4000);
    return () => clearInterval(timer.current);
  }, []);

  useEffect(() => { if (status.ready) loadChats(); }, [status.ready]);
  const loadChats = () => api.get("/whatsapp/chats").then((r) => setChats(r.data)).catch((e) => toast.error(apiError(e.response?.data?.detail)));
  const openChat = (c) => { setActive(c); api.get("/whatsapp/messages", { params: { chatId: c.id } }).then((r) => setMessages(r.data)).catch((e) => toast.error(apiError(e.response?.data?.detail))); };
  const send = async () => {
    if (!text.trim() || !active) return;
    setSending(true);
    try {
      await api.post("/whatsapp/send", { to: active.id, message: text });
      setText(""); openChat(active);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSending(false); }
  };
  const logout = async () => { try { await api.post("/whatsapp/logout"); toast.success("WhatsApp diputus"); setStatus({ ready: false, qr: null }); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  if (!status.ready) {
    return (
      <div className="h-full grid place-items-center p-8" data-testid="wa-connect">
        <div className="max-w-md w-full bg-white rounded-2xl border p-7 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[#25D366]/15 grid place-items-center mx-auto mb-4"><MessageCircle className="text-[#25D366]" /></div>
          <h2 className="text-2xl font-extrabold">Hubungkan WhatsApp</h2>
          <p className="text-sm text-[#52525B] mt-1 mb-5">Buka WhatsApp di HP → Perangkat Tertaut → Tautkan Perangkat, lalu pindai QR di bawah.</p>
          {status.qr ? (
            <img data-testid="wa-qr" src={status.qr} alt="QR WhatsApp" className="mx-auto w-64 h-64 rounded-xl border" />
          ) : (
            <div className="w-64 h-64 mx-auto rounded-xl border grid place-items-center text-[#a1a1aa]">
              <div className="text-center"><QrCode className="mx-auto mb-2" /><div className="text-sm">Menyiapkan QR…</div>{status.error && <div className="text-[11px] text-[#EF4444] mt-2 px-3">{String(status.error).slice(0, 120)}</div>}</div>
            </div>
          )}
          <button data-testid="wa-refresh" onClick={loadStatus} className="tap mt-5 h-11 px-4 rounded-xl bg-[#F4F5F7] border font-bold text-sm inline-flex items-center gap-2"><RefreshCw size={15} /> Muat ulang</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" data-testid="wa-chat">
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-extrabold flex items-center gap-2"><MessageCircle className="text-[#25D366]" size={18} /> WhatsApp</h2>
          <div className="flex gap-1">
            <button data-testid="wa-reload-chats" onClick={loadChats} className="tap h-8 w-8 rounded-lg bg-[#F4F5F7] grid place-items-center"><RefreshCw size={14} /></button>
            <button data-testid="wa-logout" onClick={logout} className="tap h-8 w-8 rounded-lg bg-[#FEE2E2] text-[#EF4444] grid place-items-center"><LogOut size={14} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && <div className="p-4 text-sm text-[#a1a1aa]">Belum ada chat.</div>}
          {chats.map((c) => (
            <button key={c.id} data-testid={`wa-chat-${c.id}`} onClick={() => openChat(c)}
              className={`w-full text-left px-4 py-3 border-b hover:bg-[#F4F5F7] ${active?.id === c.id ? "bg-[#F4F5F7]" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm truncate">{c.name}</span>
                {c.unread > 0 && <span className="text-[10px] bg-[#25D366] text-white rounded-full px-1.5">{c.unread}</span>}
              </div>
              <div className="text-xs text-[#a1a1aa] truncate">{c.last}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-[#F4F5F7]">
        {active ? (
          <>
            <div className="p-4 border-b bg-white font-extrabold">{active.name}</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${m.fromMe ? "ml-auto bg-[#25D366] text-white" : "bg-white"}`}>{m.body}</div>
              ))}
            </div>
            <div className="p-3 bg-white border-t flex gap-2">
              <input data-testid="wa-message-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ketik pesan..." className="flex-1 h-11 rounded-xl border px-3" />
              <button data-testid="wa-send-btn" onClick={send} disabled={sending} className="tap h-11 px-4 rounded-xl bg-[#25D366] text-white font-bold flex items-center gap-2 disabled:opacity-50">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-[#a1a1aa]">Pilih chat untuk memulai</div>
        )}
      </div>
    </div>
  );
}
