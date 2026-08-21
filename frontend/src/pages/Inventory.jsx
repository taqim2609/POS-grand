import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { toast } from "sonner";
import { Boxes, PackagePlus, ClipboardCheck, Plus, Camera, ScanLine, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [scanOpen, setScanOpen] = useState(false);

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
        <button data-testid="scan-invoice-btn" onClick={() => setScanOpen(true)} className="tap w-full h-12 mt-2 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center justify-center gap-2"><Camera size={18} /> Scan Faktur (AI)</button>
        <InvoiceScan open={scanOpen} onClose={() => setScanOpen(false)} onDone={() => { load(); onDone(); }} />
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

function InvoiceScan({ open, onClose, onDone }) {
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("edit");

  useEffect(() => {
    if (!open) return;
    setImage(""); setRows([]); setStep("edit");
    api.get("/products", { params: { type: "retail" } }).then((r) => setProducts(r.data)).catch(() => {});
    api.get("/categories").then((r) => setCats(r.data.filter((c) => c.type === "retail"))).catch(() => {});
  }, [open]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(f);
  };

  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const autoMatch = (name, sku) => {
    // 1) match by SKU/barcode if AI returned one
    if (sku) { const bySku = products.find((p) => (p.sku || "").toLowerCase() === String(sku).toLowerCase()); if (bySku) return bySku.id; }
    const n = norm(name);
    if (!n) return "";
    // 2) exact / substring
    let hit = products.find((p) => norm(p.name) === n)
      || products.find((p) => norm(p.name).includes(n) || n.includes(norm(p.name)));
    if (hit) return hit.id;
    // 3) token-overlap fuzzy scoring (auto-pick only when confident)
    const nt = [...new Set(n.split(" ").filter((w) => w.length >= 2))];
    let best = null, bestScore = 0;
    for (const p of products) {
      const pt = norm(p.name).split(" ").filter((w) => w.length >= 2);
      if (!pt.length || !nt.length) continue;
      let inter = 0;
      for (const w of pt) if (nt.some((x) => x === w || x.includes(w) || w.includes(x))) inter += 1;
      const score = inter / Math.max(pt.length, nt.length);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 0.5 && best ? best.id : "";
  };

  const parse = async () => {
    if (!image) return toast.error("Pilih/foto faktur dulu");
    setLoading(true);
    try {
      const { data } = await api.post("/ai/parse-invoice", { image });
      if (!data.items?.length) { toast.error("AI tidak menemukan item pada faktur"); setRows([]); }
      else { setRows(data.items.map((it) => ({ ...it, match: autoMatch(it.name, it.sku), newCat: cats[0]?.id || "", newPrice: it.unit_cost }))); setStep("edit"); }
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const upd = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const included = rows.filter((r) => r.match && r.match !== "skip");
  const grandTotal = included.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_cost) || 0), 0);
  const newCount = included.filter((r) => r.match === "new").length;
  const nameOf = (r) => (r.match === "new" ? "＋ Produk baru" : (products.find((p) => p.id === r.match)?.name || "?"));

  const goConfirm = () => {
    if (!included.length) return toast.error("Pilih minimal satu item untuk disimpan");
    const missingCat = included.find((r) => r.match === "new" && !r.newCat);
    if (missingCat) return toast.error(`Pilih kategori untuk produk baru "${missingCat.name}"`);
    setStep("confirm");
  };

  const save = async () => {
    setSaving(true);
    try {
      const items = included.map((r) => r.match === "new"
        ? { create_new: true, name: r.name, category_id: r.newCat, price: Number(r.newPrice || r.unit_cost), qty: Number(r.qty), unit_cost: Number(r.unit_cost) }
        : { product_id: r.match, qty: Number(r.qty), unit_cost: Number(r.unit_cost) });
      const { data } = await api.post("/purchases/bulk", { items, note: "Faktur AI" });
      toast.success(`${data.saved} pembelian tersimpan${data.created_products ? `, ${data.created_products} produk baru dibuat` : ""}. Stok diperbarui.`);
      onDone(); onClose();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Scan Faktur Pembelian (AI)</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="tap inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#F4F5F7] border font-bold text-sm cursor-pointer">
              <Camera size={16} /> Pilih / Foto Faktur
              <input data-testid="invoice-file" type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
            </label>
            <button data-testid="invoice-parse-btn" onClick={parse} disabled={!image || loading}
              className="tap h-11 px-5 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />} Baca dengan AI
            </button>
          </div>
          {image && <img src={image} alt="faktur" className="max-h-48 rounded-xl border" />}

          {rows.length > 0 && step === "edit" && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#52525B]">Produk sudah dicocokkan otomatis. Periksa & ubah bila ada yang salah, lalu lanjut ke konfirmasi:</div>
              {rows.map((r, i) => (
                <div key={i} data-testid={`invoice-row-${i}`} className="rounded-xl border p-3 grid md:grid-cols-12 gap-2 items-center">
                  <input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} className="md:col-span-4 h-10 rounded-lg border px-2 text-sm" />
                  <input type="number" value={r.qty} onChange={(e) => upd(i, { qty: e.target.value })} className="md:col-span-1 h-10 rounded-lg border px-2 text-sm font-num" title="Qty" />
                  <input type="number" value={r.unit_cost} onChange={(e) => upd(i, { unit_cost: e.target.value })} className="md:col-span-2 h-10 rounded-lg border px-2 text-sm font-num" title="Harga beli/unit" />
                  <select data-testid={`invoice-match-${i}`} value={r.match} onChange={(e) => upd(i, { match: e.target.value })} className="md:col-span-3 h-10 rounded-lg border px-2 text-sm bg-white">
                    <option value="">— pilih produk —</option>
                    <option value="new">＋ Buat produk baru</option>
                    <option value="skip">Lewati item ini</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {r.match === "new" ? (
                    <select data-testid={`invoice-newcat-${i}`} value={r.newCat} onChange={(e) => upd(i, { newCat: e.target.value })} className="md:col-span-2 h-10 rounded-lg border px-2 text-sm bg-white" title="Kategori produk baru">
                      <option value="">Kategori...</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <div className="md:col-span-2 text-right font-num text-sm font-bold">{rupiah((Number(r.qty) || 0) * (Number(r.unit_cost) || 0))}</div>
                  )}
                </div>
              ))}
              <button data-testid="invoice-confirm-btn" onClick={goConfirm}
                className="tap w-full h-12 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center justify-center gap-2">
                <ClipboardCheck size={16} /> Lanjut: Konfirmasi Pembelian
              </button>
            </div>
          )}

          {rows.length > 0 && step === "confirm" && (
            <div className="space-y-3" data-testid="invoice-confirm-panel">
              <div className="text-sm font-bold text-[#0A0A0A]">Periksa kembali sebelum menyimpan. Stok akan bertambah sesuai jumlah di bawah:</div>
              <div className="rounded-xl border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#F4F5F7] text-xs font-bold uppercase tracking-wider text-[#52525B]">
                  <div className="col-span-5">Barang → Produk</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Harga/Unit</div>
                  <div className="col-span-3 text-right">Subtotal</div>
                </div>
                {included.map((r, i) => (
                  <div key={i} data-testid={`invoice-confirm-row-${i}`} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t text-sm items-center">
                    <div className="col-span-5">
                      <div className="font-bold">{r.name}</div>
                      <div className={`text-xs ${r.match === "new" ? "text-[#E63946] font-bold" : "text-[#52525B]"}`}>{nameOf(r)}</div>
                    </div>
                    <div className="col-span-2 text-right font-num font-bold">{Number(r.qty) || 0}</div>
                    <div className="col-span-2 text-right font-num">{rupiah(Number(r.unit_cost) || 0)}</div>
                    <div className="col-span-3 text-right font-num font-bold">{rupiah((Number(r.qty) || 0) * (Number(r.unit_cost) || 0))}</div>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-2 px-3 py-3 border-t bg-[#FFF7F8] text-sm items-center">
                  <div className="col-span-9 font-bold">Total ({included.length} item{newCount ? `, ${newCount} produk baru` : ""})</div>
                  <div className="col-span-3 text-right font-num font-extrabold text-[#E63946]" data-testid="invoice-grand-total">{rupiah(grandTotal)}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button data-testid="invoice-back-btn" onClick={() => setStep("edit")} disabled={saving}
                  className="tap h-12 px-5 rounded-xl bg-[#F4F5F7] border font-bold disabled:opacity-50">← Kembali Edit</button>
                <button data-testid="invoice-save-btn" onClick={save} disabled={saving}
                  className="tap flex-1 h-12 rounded-xl bg-[#E63946] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Konfirmasi & Simpan Semua
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
