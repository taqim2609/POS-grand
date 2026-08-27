import { useEffect, useRef, useState } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah, TYPE_LABEL } from "@/lib/format";
import { toast } from "sonner";
import {
  Package, Plus, Pencil, Trash2, Sparkles, ImagePlus, Loader2,
  FileDown, FileUp, Download, Ban, CheckCircle2, X, Search,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const empty = { name: "", sku: "", category_id: "", type: "makanan", price: 0, cost: 0, vendor_id: "", vendor_share_percent: 0, description: "", image: "", active: true, sold_out: false, stock: 0, min_stock: 10 };
const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function Products() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [aiDesc, setAiDesc] = useState(false);
  const [aiImg, setAiImg] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = () => Promise.all([api.get("/products"), api.get("/categories"), api.get("/vendors")]).then(([p, c, v]) => { setItems(p.data); setCats(c.data); setVendors(v.data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  useEffect(() => { load(); }, []);

  const catCandidates = cats.filter((c) => c.type === form.type && c.active);

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) return toast.error("Nama & SKU wajib");
    if (!form.category_id) return toast.error("Pilih kategori");
    try {
      const payload = { ...form, price: Number(form.price), cost: Number(form.cost), stock: Number(form.stock), min_stock: Number(form.min_stock) };
      if (form.type === "vendor") {
        if (!form.vendor_id) return toast.error("Pilih vendor");
        payload.vendor_share_percent = Number(form.vendor_share_percent);
        payload.cost = 0;
      }
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post("/products", payload);
      toast.success("Produk tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (p) => {
    if (!window.confirm(`Hapus ${p.name}?`)) return;
    try { const { data } = await api.delete(`/products/${p.id}`); toast.success(data.reason || "Terhapus"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const toggleSold = async (p) => { try { await api.patch(`/products/${p.id}/sold-out`); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  const genDesc = async () => {
    if (!form.name) return toast.error("Isi nama produk dulu");
    setAiDesc(true);
    try {
      const cat = cats.find((c) => c.id === form.category_id)?.name || "";
      const { data } = await api.post("/ai/product-description", { name: form.name, type: form.type, category: cat });
      setForm((f) => ({ ...f, description: data.description }));
      toast.success("Deskripsi AI dibuat");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setAiDesc(false); }
  };
  const genImg = async () => {
    if (!form.name) return toast.error("Isi nama produk dulu");
    setAiImg(true);
    try {
      const { data } = await api.post("/ai/product-image", { name: form.name, description: form.description });
      setForm((f) => ({ ...f, image: data.image }));
      toast.success("Gambar AI dibuat");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setAiImg(false); }
  };

  const download = async (path, filename) => {
    const t = localStorage.getItem("gak_token");
    const res = await fetch(`${BACKEND}/api${path}`, { headers: { Authorization: `Bearer ${t}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const q = search.trim().toLowerCase();
  const shown = items.filter((p) =>
    (filter === "all" || p.type === filter) &&
    (catFilter === "all" || p.category_id === catFilter) &&
    (!q || (p.name || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))
  );
  const filterCats = cats.filter((c) => c.active && (filter === "all" || c.type === filter));

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Package /> Produk</h1>
        <div className="flex gap-2 flex-wrap">
          <button data-testid="download-template-btn" onClick={() => download("/products/template", "template_produk.xlsx")} className="tap h-11 px-4 rounded-xl bg-white border font-bold text-sm flex items-center gap-2"><Download size={16} /> Template</button>
          <button data-testid="export-btn" onClick={() => download("/products/export", "produk.xlsx")} className="tap h-11 px-4 rounded-xl bg-white border font-bold text-sm flex items-center gap-2"><FileDown size={16} /> Export</button>
          <button data-testid="import-btn" onClick={() => setImportOpen(true)} className="tap h-11 px-4 rounded-xl bg-white border font-bold text-sm flex items-center gap-2"><FileUp size={16} /> Import</button>
          <button data-testid="add-product-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }} className="tap h-11 px-5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2"><Plus size={18} /> Tambah</button>
        </div>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <input data-testid="prod-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / SKU..."
            className="h-9 pl-9 pr-3 rounded-lg bg-white border text-sm w-56 max-w-full placeholder:text-[#A1A1AA]" />
        </div>
        {["all", "makanan", "minuman", "retail", "vendor"].map((t) => (
          <button key={t} onClick={() => { setFilter(t); setCatFilter("all"); }} className={`tap h-9 px-4 rounded-lg text-sm font-bold ${filter === t ? "bg-[#0A0A0A] text-white" : "bg-white border"}`}>
            {t === "all" ? "Semua" : TYPE_LABEL[t]}
          </button>
        ))}
        <select data-testid="prod-cat-filter" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="h-9 px-3 rounded-lg bg-white border text-sm font-bold text-[#0A0A0A]">
          <option value="all">Semua Kategori</option>
          {filterCats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {catFilter !== "all" && (
          <button onClick={() => setCatFilter("all")} className="tap h-9 px-3 rounded-lg bg-[#FEE2E2] text-[#EF4444] text-sm font-bold inline-flex items-center gap-1"><X size={14} /> Reset</button>
        )}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F5F7] text-[#52525B] text-xs uppercase tracking-wider">
            <tr><th className="text-left p-3">Produk</th><th className="text-left p-3">SKU</th><th className="text-left p-3">Tipe</th><th className="text-right p-3">Harga</th><th className="text-right p-3">HPP/Beli</th><th className="text-right p-3">Stok</th><th className="text-center p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} data-testid={`product-row-${p.id}`} className={`border-t ${!p.active && "opacity-50"}`}>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-[#F4F5F7] overflow-hidden shrink-0">{p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}</div>
                    <span className="font-bold">{p.name}</span>
                  </div>
                </td>
                <td className="p-3 font-num text-[#52525B]">{p.sku}</td>
                <td className="p-3">{TYPE_LABEL[p.type]}</td>
                <td className="p-3 text-right font-num font-bold">{rupiah(p.price)}</td>
                <td className="p-3 text-right font-num text-[#52525B]">{p.type === "vendor" ? `${p.vendor_share_percent || 0}%` : rupiah(p.cost || 0)}</td>
                <td className="p-3 text-right font-num">{p.track_stock ? p.stock : "-"}</td>
                <td className="p-3 text-center">
                  <button data-testid={`soldout-toggle-${p.id}`} onClick={() => toggleSold(p)} className={`text-xs font-bold px-2 py-1 rounded ${p.sold_out ? "bg-[#FEE2E2] text-[#EF4444]" : "bg-[#D1FAE5] text-[#047857]"}`}>
                    {p.sold_out ? "SOLD OUT" : "Tersedia"}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <button data-testid={`edit-product-${p.id}`} onClick={() => { setForm({ ...empty, ...p, min_stock: p.min_stock ?? 10 }); setEditId(p.id); setOpen(true); }} className="tap h-8 w-8 rounded-lg bg-[#F4F5F7] grid place-items-center"><Pencil size={14} /></button>
                    <button data-testid={`delete-product-${p.id}`} onClick={() => del(p)} className="tap h-8 w-8 rounded-lg bg-[#FEE2E2] text-[#EF4444] grid place-items-center"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Product form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Tambah"} Produk</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama"><input data-testid="prod-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-11 rounded-xl border px-3" /></Field>
              <Field label="SKU / Kode"><input data-testid="prod-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipe">
                <select data-testid="prod-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category_id: "" })} className="w-full h-11 rounded-xl border px-3 bg-white">
                  <option value="makanan">Makanan</option><option value="minuman">Minuman</option><option value="retail">Retail</option><option value="vendor">Vendor (Bagi Hasil)</option>
                </select>
              </Field>
              <Field label="Kategori">
                <select data-testid="prod-category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full h-11 rounded-xl border px-3 bg-white">
                  <option value="">Pilih...</option>
                  {catCandidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Harga Jual"><input data-testid="prod-price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
              {form.type === "vendor" ? (
                <Field label="Bagi Hasil Vendor (%)"><input data-testid="prod-vendor-share" type="number" min="0" max="100" value={form.vendor_share_percent} onChange={(e) => setForm({ ...form, vendor_share_percent: e.target.value })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
              ) : (
                <Field label={form.type === "retail" ? "Harga Beli" : "HPP (Modal)"}><input data-testid="prod-cost" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
              )}
            </div>
            {form.type === "vendor" && (
              <Field label="Vendor (Pemilik Produk)">
                <select data-testid="prod-vendor" value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })} className="w-full h-11 rounded-xl border px-3 bg-white">
                  <option value="">Pilih vendor...</option>
                  {vendors.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <span className="text-[11px] text-[#a1a1aa]">Bagi hasil dihitung {form.vendor_share_percent || 0}% dari harga jual (omzet).</span>
              </Field>
            )}
            {form.type === "retail" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stok Awal"><input data-testid="prod-stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
                <Field label="Ambang Stok Menipis"><input data-testid="prod-min-stock" type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="w-full h-11 rounded-xl border px-3 font-num" /></Field>
              </div>
            )}
            <Field label="Deskripsi">
              <div className="relative">
                <textarea data-testid="prod-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-xl border px-3 py-2 resize-none" />
                <button data-testid="ai-desc-btn" onClick={genDesc} disabled={aiDesc} className="tap absolute bottom-2 right-2 h-8 px-3 rounded-lg bg-[#0A0A0A] text-white text-xs font-bold flex items-center gap-1">
                  {aiDesc ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI
                </button>
              </div>
            </Field>
            <Field label="Gambar">
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 rounded-xl bg-[#F4F5F7] overflow-hidden shrink-0 relative">
                  {form.image ? <img src={form.image} alt="" className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center text-[#d4d4d8]"><ImagePlus size={22} /></div>}
                  {form.image && <button onClick={() => setForm({ ...form, image: "" })} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X size={12} /></button>}
                </div>
                <button data-testid="ai-image-btn" onClick={genImg} disabled={aiImg} className="tap h-11 px-4 rounded-xl bg-[#0A0A0A] text-white text-sm font-bold flex items-center gap-2">
                  {aiImg ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generate Gambar AI
                </button>
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Produk Aktif</label>
          </div>
          <DialogFooter><button data-testid="save-product-btn" onClick={save} className="tap w-full h-12 rounded-xl bg-[#E63946] text-white font-bold">Simpan</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  );
}

function ImportDialog({ open, onClose, onDone }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  // edits[row] = { name, sku, category_name, type, price, cost } — hasil perbaikan user
  const [edits, setEdits] = useState({});
  const [cats, setCats] = useState([]);

  useEffect(() => {
    if (!open) { setFile(null); setPreview(null); setEdits({}); return; }
    api.get("/categories").then((r) => setCats(r.data || [])).catch(() => {});
  }, [open]);

  const doPreview = async (f) => {
    setFile(f); setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("/products/import/preview", fd);
      setPreview(data); setEdits({});
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const setEdit = (row, patch) => setEdits((e) => ({ ...e, [row]: { ...(e[row] || {}), ...patch } }));

  // Gabungkan baris asli + perbaikan user; validasi lokal ringan untuk UI.
  const mergedRows = (preview?.rows || []).map((r) => {
    const e = edits[r.row] || {};
    return { ...r, name: e.name ?? r.name, sku: e.sku ?? r.sku, category_name: e.category_name ?? r.category_name, type: e.type ?? r.type, price: e.price ?? r.price, cost: e.cost ?? r.cost };
  });

  const validCount = mergedRows.filter((r) => {
    const errs = [];
    if (!String(r.name || "").trim()) errs.push("nama kosong");
    if (!String(r.sku || "").trim()) errs.push("SKU kosong");
    if (!String(r.price || "").trim() || isNaN(Number(r.price))) errs.push("harga bukan angka");
    if (!String(r.category_name || "").trim()) errs.push("kategori kosong");
    if (!["makanan", "minuman", "retail"].includes(String(r.type || "").trim().toLowerCase())) errs.push("tipe tidak valid");
    return errs.length === 0;
  }).length;

  const commit = async () => {
    setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/products/import/commit", fd);
      toast.success(`Import selesai: ${data.created} baru, ${data.updated} update, ${data.errors} error`);
      onClose(); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  // Commit dari data YANG SUDAH DIPERBAIKI (semua baris, termasuk yang diedit)
  const commitFixed = async () => {
    setLoading(true);
    try {
      const rows = mergedRows.map((r) => ({
        nama_produk: r.name, sku: r.sku, kategori: r.category_name,
        tipe_produk: String(r.type || "").toLowerCase(), harga: r.price, harga_beli: r.cost,
      }));
      const { data } = await api.post("/products/import/commit-fix", { rows });
      toast.success(`Import selesai: ${data.created} baru, ${data.updated} update, ${data.errors} error`);
      onClose(); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const inp = "w-full min-w-[80px] h-8 rounded border px-2 text-xs";
  const hasEdits = Object.keys(edits).length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Produk dari Excel</DialogTitle></DialogHeader>
        {!preview ? (
          <div className="border-2 border-dashed rounded-2xl p-10 text-center">
            <FileUp size={40} className="mx-auto text-[#a1a1aa]" />
            <p className="text-sm text-[#52525B] mt-3">Unggah file .xlsx sesuai template resmi</p>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files[0] && doPreview(e.target.files[0])} />
            <button data-testid="choose-file-btn" onClick={() => fileRef.current.click()} className="tap mt-4 h-11 px-6 rounded-xl bg-[#E63946] text-white font-bold">
              {loading ? "Memproses..." : "Pilih File"}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-3 mb-3 flex-wrap text-sm font-bold">
              <span className="px-3 py-1 rounded-lg bg-[#D1FAE5] text-[#047857]">Valid: {validCount}</span>
              <span className="px-3 py-1 rounded-lg bg-[#FEE2E2] text-[#EF4444]">Error: {mergedRows.length - validCount}</span>
              <span className="px-3 py-1 rounded-lg bg-[#E0E7FF] text-[#4338CA]">Baru: {mergedRows.filter((r) => !r.exists).length}</span>
              <span className="px-3 py-1 rounded-lg bg-[#FEF3C7] text-[#B45309]">Update: {mergedRows.filter((r) => r.exists).length}</span>
              {hasEdits && <span className="px-3 py-1 rounded-lg bg-[#4F46E5] text-white">✏️ {Object.keys(edits).length} baris diperbaiki</span>}
            </div>
            <p className="text-[11px] text-[#52525B] mb-2">Baris error bisa langsung <b>diperbaiki di tabel</b> (ubah kolom lalu Commit). Data akan divalidasi ulang server-side.</p>
            <div className="border rounded-xl max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#F4F5F7] sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Baris</th><th className="p-2 text-left">Nama</th><th className="p-2 text-left">SKU</th>
                    <th className="p-2 text-left">Kategori</th><th className="p-2 text-left">Tipe</th><th className="p-2 text-left">Harga</th><th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((r) => (
                    <tr key={r.row} className={`border-t ${!r.valid ? "bg-[#FEF2F2]" : ""}`}>
                      <td className="p-1.5 font-num">{r.row}</td>
                      <td className="p-1.5"><input className={inp} value={r.name} onChange={(e) => setEdit(r.row, { name: e.target.value })} /></td>
                      <td className="p-1.5"><input className={inp} value={r.sku} onChange={(e) => setEdit(r.row, { sku: e.target.value })} /></td>
                      <td className="p-1.5">
                        <input className={inp} value={r.category_name} list={`cat-list-${r.row}`} onChange={(e) => setEdit(r.row, { category_name: e.target.value })} />
                        <datalist id={`cat-list-${r.row}`}>{cats.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                      </td>
                      <td className="p-1.5">
                        <select className={inp} value={String(r.type || "").toLowerCase()} onChange={(e) => setEdit(r.row, { type: e.target.value })}>
                          <option value="">—</option><option value="makanan">makanan</option><option value="minuman">minuman</option><option value="retail">retail</option>
                        </select>
                      </td>
                      <td className="p-1.5"><input className={`${inp} font-num`} type="number" value={r.price} onChange={(e) => setEdit(r.row, { price: e.target.value })} /></td>
                      <td className="p-1.5">
                        {r.valid ? <span className="text-[#047857] flex items-center gap-1"><CheckCircle2 size={13} />{r.exists ? "Update" : "Baru"}</span>
                          : <span className="text-[#EF4444] flex items-center gap-1"><Ban size={13} />{r.errors.join(", ")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="mt-4 gap-2">
              <button onClick={() => setPreview(null)} className="tap h-12 px-5 rounded-xl bg-[#F4F5F7] font-bold">Ganti File</button>
              {!hasEdits ? (
                <button data-testid="commit-import-btn" onClick={commit} disabled={loading || preview.valid_count === 0} className="tap flex-1 h-12 rounded-xl bg-[#E63946] text-white font-bold disabled:opacity-40">
                  Commit {preview.valid_count} Baris Valid
                </button>
              ) : (
                <button data-testid="commit-fix-btn" onClick={commitFixed} disabled={loading || validCount === 0} className="tap flex-1 h-12 rounded-xl bg-[#4F46E5] text-white font-bold disabled:opacity-40">
                  Simpan Hasil Perbaikan ({validCount} valid)
                </button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const Field = ({ label, children }) => (
  <div><label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label><div className="mt-1.5">{children}</div></div>
);
