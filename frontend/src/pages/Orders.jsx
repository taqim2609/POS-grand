import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah, ORDER_TYPE_LABEL, wibToday } from "@/lib/format";
import { printReceipt } from "@/lib/receipt";
import { toast } from "sonner";
import { FileSpreadsheet, Receipt, Ban, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const STATUS_STYLE = {
  paid: "bg-[#D1FAE5] text-[#047857]", open: "bg-[#FEF3C7] text-[#B45309]",
  void: "bg-[#F4F4F5] text-[#71717A]", refunded: "bg-[#FEE2E2] text-[#EF4444]",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [date, setDate] = useState(wibToday());
  const [fType, setFType] = useState("");
  const [voidTarget, setVoidTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("void");

  const load = () => api.get("/orders", { params: { date, order_type: fType || undefined } }).then((r) => setOrders(r.data));
  useEffect(() => { load(); }, [date, fType]);

  const doVoid = async () => {
    if (!reason.trim()) return toast.error("Isi alasan");
    try {
      await api.post(`/orders/${voidTarget.id}/void`, { reason, action });
      toast.success(action === "refund" ? "Refund tercatat" : "Order dibatalkan");
      setVoidTarget(null); setReason(""); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><FileSpreadsheet /> Transaksi</h1>
        <div className="flex gap-2">
          <select value={fType} onChange={(e) => setFType(e.target.value)} className="h-11 rounded-xl border px-3 bg-white text-sm font-bold">
            <option value="">Semua Jenis</option><option value="dine_in">Dine-In</option><option value="take_away">Take Away</option><option value="retail">Retail</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border px-3 font-num bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
            <tr><th className="text-left p-3">No Order</th><th className="text-left p-3">Jenis</th><th className="text-left p-3">Waktu</th><th className="text-left p-3">Kasir</th><th className="text-right p-3">Total</th><th className="text-center p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[#a1a1aa]">Tidak ada transaksi</td></tr>}
            {orders.map((o) => (
              <tr key={o.id} data-testid={`order-row-${o.id}`} className="border-t">
                <td className="p-3 font-num font-bold">
                  {o.order_number}
                  {o.client_ref && <span data-testid={`offline-tag-${o.id}`} className="ml-1.5 align-middle text-[9px] font-bold bg-[#FEF3C7] text-[#B45309] px-1.5 py-0.5 rounded" title="Transaksi ini dibuat offline lalu tersinkron">EKS-OFFLINE</span>}
                </td>
                <td className="p-3"><span className={`ot-${o.order_type} text-xs font-bold px-2 py-0.5 rounded border`}>{ORDER_TYPE_LABEL[o.order_type]}</span></td>
                <td className="p-3 text-[#52525B]">{new Date(o.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="p-3">{o.cashier_name}</td>
                <td className="p-3 text-right font-num font-bold">{rupiah(o.total)}</td>
                <td className="p-3 text-center"><span className={`text-xs font-bold px-2 py-1 rounded ${STATUS_STYLE[o.status]}`}>{o.status.toUpperCase()}</span></td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    {o.status === "paid" && <button data-testid={`reprint-btn-${o.id}`} onClick={() => printReceipt(o)} className="tap h-8 px-3 rounded-lg bg-[#0A0A0A] text-white grid place-items-center" title="Cetak ulang struk (nomor resmi)"><span className="flex items-center gap-1 text-xs font-bold"><Receipt size={13} /> Cetak Ulang</span></button>}
                    {(o.status === "paid" || o.status === "open") && (
                      <button data-testid={`void-btn-${o.id}`} onClick={() => { setVoidTarget(o); setAction(o.status === "paid" ? "refund" : "void"); }} className="tap h-8 w-8 rounded-lg bg-[#FEE2E2] text-[#EF4444] grid place-items-center" title="Void/Refund">
                        {o.status === "paid" ? <RotateCcw size={14} /> : <Ban size={14} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!voidTarget} onOpenChange={() => setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void / Refund — {voidTarget?.order_number}</DialogTitle></DialogHeader>
          <p className="text-sm text-[#52525B]">Transaksi lunas tidak boleh diedit. Koreksi hanya via void/refund dengan jejak audit.</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setAction("void")} className={`tap flex-1 h-11 rounded-xl font-bold ${action === "void" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7]"}`}>Void</button>
            <button onClick={() => setAction("refund")} className={`tap flex-1 h-11 rounded-xl font-bold ${action === "refund" ? "bg-[#0A0A0A] text-white" : "bg-[#F4F5F7]"}`}>Refund</button>
          </div>
          <textarea data-testid="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Alasan koreksi (wajib)" className="w-full rounded-xl border px-3 py-2 mt-3 resize-none" />
          <DialogFooter><button data-testid="confirm-void-btn" onClick={doVoid} className="tap w-full h-12 rounded-xl bg-[#EF4444] text-white font-bold">Konfirmasi {action === "refund" ? "Refund" : "Void"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
