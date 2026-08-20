import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { toast } from "sonner";
import { Boxes, PackagePlus, ClipboardCheck, Plus } from "lucide-react";
import { wibToday } from "@/lib/format";

export default function Inventory() {
  const [tab, setTab] = useState("purchase");
  const [products, setProducts] = useState([]);

  const loadProducts = () => api.get("/products", { params: { type: "retail" } }).then((r) => setProducts(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { loadProducts(); }, []);

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-extrabold flex items-center gap-2 mb-1"><Boxes /> Persediaan Retail</h1>
      <p className="text-[#52525B] mb-6">Pembelian stok masuk & stok opname (khusus produk retail).</p>

      <div className="flex gap-2 mb-6">
        <button data-testid="tab-purchase" onClick={() => setTab("purchase")}
          className={`tap h-11 px-5 rounded-xl font-bold text-sm flex items-center gap-2 ${tab === "purchase" ? "bg-[#E63946] text-white" : "bg-white border"}`}>
          <PackagePlus size={17} /> Pembelian
        </button>
        <button data-testid="tab-opname" onClick={() => setTab("opname")}
          className={`tap h-11 px-5 rounded-xl font-bold text-sm flex items-center gap-2 ${tab === "opname" ? "bg-[#E63946] text-white" : "bg-white border"}`}>
          <ClipboardCheck size={17} /> Stok Opname
        </button>
      </div>

      {tab === "purchase" ? <Purchase products={products} onDone={loadProducts} /> : <Opname products={products} onDone={loadProducts} />}
    </div>
  );
}

function Purchase({ products, onDone }) {
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [list, setList] = useState([]);

  const load = () => api.get("/purchases", { params: { date: wibToday() } }).then((r) => setList(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!pid) return toast.error("Pilih produk");
    if (!qty || Number(qty) <= 0) return toast.error("Qty harus > 0");
    try {
      await api.post("/purchases", { product_id: pid, qty: Number(qty), unit_cost: Number(cost || 0), note });
      toast.success("Pembelian dicatat, stok bertambah");
      setPid(""); setQty(""); setCost(""); setNote("");
      load(); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const total = list.reduce((s, p) => s + p.total_cost, 0);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-extrabold mb-4">Catat Pembelian</h3>
        <Field label="Produk Retail">
          <select data-testid="purchase-product" value={pid} onChange={(e) => setPid(e.target.value)} className="w-full h-11 rounded-xl border px-3 bg-white">
            <option value="">Pilih produk...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{`${p.name} (stok ${p.stock})`}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Qty Masuk"><input data-testid="purchase-qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
          <Field label="Harga Beli/Unit"><input data-testid="purchase-cost" type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
        </div>
        <Field label="Catatan" className="mt-3"><input value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-11 rounded-xl border px-3" placeholder="opsional" /></Field>
        <button data-testid="submit-purchase" onClick={submit} className="tap w-full h-12 mt-4 rounded-xl bg-[#E63946] text-white font-bold flex items-center justify-center gap-2"><Plus size={18} /> Simpan Pembelian</button>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-extrabold">Pembelian Hari Ini</h3>
          <span className="font-num font-bold text-[#E63946]">{rupiah(total)}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
            <tr><th className="text-left p-3">Produk</th><th className="text-right p-3">Qty</th><th className="text-right p-3">Harga/Unit</th><th className="text-right p-3">Total</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-[#a1a1aa]">Belum ada pembelian</td></tr>}
            {list.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-bold">{p.product_name}</td>
                <td className="p-3 text-right font-num">+{p.qty}</td>
                <td className="p-3 text-right font-num">{rupiah(p.unit_cost)}</td>
                <td className="p-3 text-right font-num font-bold">{rupiah(p.total_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Opname({ products, onDone }) {
  const [pid, setPid] = useState("");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [list, setList] = useState([]);
  const selected = products.find((p) => p.id === pid);

  const load = () => api.get("/stock-opname", { params: { date: wibToday() } }).then((r) => setList(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!pid) return toast.error("Pilih produk");
    if (counted === "" || Number(counted) < 0) return toast.error("Isi jumlah fisik");
    try {
      const { data } = await api.post("/stock-opname", { product_id: pid, counted_stock: Number(counted), note });
      toast.success(`Opname tersimpan. Selisih: ${data.difference}`);
      setPid(""); setCounted(""); setNote("");
      load(); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-extrabold mb-4">Stok Opname</h3>
        <Field label="Produk Retail">
          <select data-testid="opname-product" value={pid} onChange={(e) => setPid(e.target.value)} className="w-full h-11 rounded-xl border px-3 bg-white">
            <option value="">Pilih produk...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        {selected && (
          <div className="mt-3 flex gap-2 text-sm">
            <div className="flex-1 rounded-xl bg-[#F4F5F7] p-3">
              <div className="text-xs text-[#52525B] font-bold">Stok Sistem</div>
              <div className="font-num font-extrabold text-lg">{selected.stock}</div>
            </div>
            {counted !== "" && (
              <div className={`flex-1 rounded-xl p-3 ${Number(counted) - selected.stock < 0 ? "bg-[#FEE2E2]" : "bg-[#D1FAE5]"}`}>
                <div className="text-xs font-bold">Selisih</div>
                <div className="font-num font-extrabold text-lg">{Number(counted) - selected.stock}</div>
              </div>
            )}
          </div>
        )}
        <Field label="Jumlah Fisik (dihitung)" className="mt-3"><input data-testid="opname-counted" type="number" value={counted} onChange={(e) => setCounted(e.target.value)} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
        <Field label="Catatan" className="mt-3"><input value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-11 rounded-xl border px-3" placeholder="opsional" /></Field>
        <button data-testid="submit-opname" onClick={submit} className="tap w-full h-12 mt-4 rounded-xl bg-[#E63946] text-white font-bold">Simpan Opname</button>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-extrabold">Opname Hari Ini</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
            <tr><th className="text-left p-3">Produk</th><th className="text-right p-3">Sistem</th><th className="text-right p-3">Fisik</th><th className="text-right p-3">Selisih</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-[#a1a1aa]">Belum ada opname</td></tr>}
            {list.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-bold">{o.product_name}</td>
                <td className="p-3 text-right font-num">{o.system_stock}</td>
                <td className="p-3 text-right font-num">{o.counted_stock}</td>
                <td className={`p-3 text-right font-num font-bold ${o.difference < 0 ? "text-[#EF4444]" : o.difference > 0 ? "text-[#047857]" : ""}`}>{o.difference > 0 ? "+" : ""}{o.difference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Field = ({ label, children, className = "" }) => (
  <div className={className}><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label><div className="mt-1.5">{children}</div></div>
);
