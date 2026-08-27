import { useEffect, useMemo, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { printReceipt } from "@/lib/receipt";
import { getDeviceConfig, setDeviceConfig } from "@/lib/device";
import { useOffline } from "@/context/OfflineContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Utensils, ShoppingBag, Store, Plus, Minus, Trash2, Armchair,
  Search, Receipt, X, CheckCircle2, Layers, Database, ScanLine, Clock, Play,
} from "lucide-react";

const ORDER_TYPES = [
  { key: "dine_in", label: "Dine-In", icon: Utensils, cls: "ot-dine_in" },
  { key: "take_away", label: "Take Away", icon: ShoppingBag, cls: "ot-take_away" },
  { key: "retail", label: "Retail", icon: Store, cls: "ot-retail" },
];

export default function POS() {
  const { online, addPending } = useOffline();
  const [orderType, setOrderType] = useState("take_away");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [pms, setPms] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [table, setTable] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [discType, setDiscType] = useState("none");
  const [discVal, setDiscVal] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [cacheAt, setCacheAt] = useState(() => localStorage.getItem("gak_pos_cache_at"));
  const [shift, setShift] = useState(undefined);
  const [openingCash, setOpeningCash] = useState("");
  const [barcode, setBarcode] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, c, t, m] = await Promise.all([
        api.get("/products", { params: { active_only: true } }),
        api.get("/categories", { params: { include_inactive: false } }),
        api.get("/tables"),
        api.get("/payment-methods"),
      ]);
      const cached = { products: p.data, categories: c.data, tables: t.data, pms: m.data.filter((x) => x.active) };
      localStorage.setItem("gak_pos_cache", JSON.stringify(cached));
      const at = new Date().toISOString();
      localStorage.setItem("gak_pos_cache_at", at);
      setCacheAt(at);
      setProducts(cached.products);
      setCategories(cached.categories);
      setTables(cached.tables);
      setPms(cached.pms);
    } catch (e) {
      const cache = JSON.parse(localStorage.getItem("gak_pos_cache") || "null");
      if (cache) {
        setProducts(cache.products);
        setCategories(cache.categories);
        setTables(cache.tables);
        setPms(cache.pms);
        toast.info("Mode offline: memakai data produk tersimpan");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only stable refs (api/setters/toast) used
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh cached master data (stock/prices) after offline orders finish uploading
  useEffect(() => {
    const onSynced = () => load();
    window.addEventListener("gak-synced", onSynced);
    return () => window.removeEventListener("gak-synced", onSynced);
  }, [load]);

  // Shift gate: POS is only usable after opening a shift (offline is allowed).
  useEffect(() => {
    api.get("/shifts/current").then((r) => setShift(r.data || null)).catch(() => setShift({ offline: true }));
  }, []);

  const relevantTypes = orderType === "retail" ? ["retail"] : ["makanan", "minuman", "vendor"];
  const cats = categories.filter((c) => relevantTypes.includes(c.type));

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (!relevantTypes.includes(p.type)) return false;
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, relevantTypes, activeCat, search]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount =
    discType === "percent" ? Math.round((subtotal * discVal) / 100)
    : discType === "amount" ? Math.min(discVal, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  const resetSale = () => {
    setCart([]); setTable(null); setCurrentOrderId(null);
    setDiscType("none"); setDiscVal(0);
  };

  // Cetak BILL SEMENTARA (struk pratinjau tanpa pembayaran) — untuk dine-in/open bill.
  const printInterimBill = () => {
    if (!cart.length) return toast.error("Keranjang kosong");
    setDeviceConfig(getDeviceConfig());
    let cashier = "-";
    try { cashier = JSON.parse(localStorage.getItem("gak_user") || "{}").name || "-"; } catch (e) {}
    printReceipt({
      order_number: currentOrderId ? `BILL-${currentOrderId.slice(-6)}` : `BILL-${Date.now().toString().slice(-8)}`,
      order_type: orderType,
      items: cart,
      subtotal,
      discount,
      total,
      cashier_name: cashier,
      note: "BILL SEMENTARA",
      created_at: new Date().toISOString(),
    });
    toast.success("Bill sementara dicetak");
  };

  const switchType = (key) => {
    if (cart.length && !window.confirm("Ganti jenis transaksi akan mengosongkan keranjang. Lanjut?")) return;
    resetSale();
    setActiveCat("all");
    setOrderType(key);
  };

  const addItem = (p) => {
    if (p.sold_out) return;
    if (p.type === "retail" && p.track_stock && p.stock <= 0) {
      toast.error("Stok retail habis");
      return;
    }
    setCart((prev) => {
      const ex = prev.find((i) => i.product_id === p.id);
      if (ex) return prev.map((i) => (i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product_id: p.id, name: p.name, price: p.price, qty: 1, type: p.type }];
    });
  };
  const changeQty = (id, d) =>
    setCart((prev) =>
      prev.map((i) => (i.product_id === id ? { ...i, qty: i.qty + d } : i)).filter((i) => i.qty > 0)
    );
  const removeItem = (id) => setCart((prev) => prev.filter((i) => i.product_id !== id));

  const openShiftInline = async () => {
    try {
      const { data } = await api.post("/shifts/open", { opening_cash: Number(openingCash || 0) });
      setShift(data);
      toast.success("Shift dibuka. POS siap digunakan.");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const handleBarcode = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const found = products.find((p) => (p.sku || "").toLowerCase() === code.toLowerCase());
    if (found) { addItem(found); setBarcode(""); }
    else { toast.error(`Produk kode "${code}" tidak ditemukan`); setBarcode(""); }
  };

  const openTablePicker = () => setTableOpen(true);
  const selectTable = async (t) => {
    setTableOpen(false);
    setTable(t);
    if (t.open_order_id) {
      const { data } = await api.get(`/orders/${t.open_order_id}`);
      setCart(data.items);
      setCurrentOrderId(data.id);
      setDiscType(data.discount_type);
      setDiscVal(data.discount_value);
      toast.info(`Open bill ${data.order_number} dimuat`);
    } else {
      setCurrentOrderId(null); // keep items the cashier already added; assign them to this table
    }
  };

  const ensureOrder = async () => {
    if (currentOrderId) {
      await api.patch(`/orders/${currentOrderId}/items`, { items: cart });
      return currentOrderId;
    }
    const { data } = await api.post("/orders", {
      order_type: orderType, table_id: orderType === "dine_in" ? table?.id : null,
      items: cart, discount_type: discType, discount_value: Number(discVal),
    });
    setCurrentOrderId(data.id);
    return data.id;
  };

  const saveOpenBill = async () => {
    if (!cart.length) return toast.error("Keranjang kosong");
    if (!table) return toast.error("Pilih meja dulu");
    try {
      await ensureOrder();
      toast.success(`Open bill tersimpan untuk ${table.name}`);
      resetSale();
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const doPay = async (pm, amountPaid, opts = {}) => {
    if (!online) {
      if (orderType === "dine_in" || currentOrderId) {
        return toast.error("Mode offline hanya untuk take away & retail (bukan open bill dine-in)");
      }
      const payload = {
        order_type: orderType, table_id: null,
        items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        discount_type: discType, discount_value: Number(discVal),
        member_id: opts.member_id || null, redeem_points: Number(opts.redeem_points || 0),
        discount_reason: opts.discount_reason || null,
        pay_now: true, payment_method: pm.id,
      };
      addPending(payload, { order_type: orderType, total, item_count: cart.length, preview: cart.map((i) => `${i.qty}x ${i.name}`).join(", ") });
      const offlineReceipt = {
        order_number: `OFFLINE-${Date.now().toString().slice(-8)}`, order_type: orderType, items: cart,
        subtotal, discount, total, cashier_name: "(offline)",
        payment_method_name: pm.name, amount_paid: amountPaid || total,
        change: (amountPaid || total) - total, created_at: new Date().toISOString(), offline: true,
      };
      setPayOpen(false);
      setReceipt(offlineReceipt);
      resetSale();
      toast.success("Disimpan offline. Otomatis disinkron saat online kembali.");
      return;
    }
    try {
      const oid = await ensureOrder();
      const { data } = await api.post(`/orders/${oid}/pay`, {
        payment_method: pm.id, discount_type: discType, discount_value: Number(discVal),
        amount_paid: amountPaid,
        member_id: opts.member_id || null, redeem_points: Number(opts.redeem_points || 0),
        discount_reason: opts.discount_reason || null,
      });
      setPayOpen(false);
      setReceipt(data);
      resetSale();
      load();
      toast.success("Pembayaran berhasil");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  if (shift === undefined) {
    return <div className="h-screen grid place-items-center"><div className="animate-pulse text-[#E63946] font-bold">Memuat…</div></div>;
  }
  if (shift === null) {
    return (
      <div className="h-screen grid place-items-center bg-[#F4F5F7] p-6" data-testid="shift-gate">
        <div className="w-full max-w-md bg-white rounded-2xl border p-7 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[#FEF2F2] grid place-items-center mx-auto mb-4"><Clock className="text-[#E63946]" /></div>
          <h2 className="text-2xl font-extrabold">Buka Shift Dulu</h2>
          <p className="text-sm text-[#52525B] mt-1 mb-5">Masukkan kas awal untuk memulai. POS Kasir baru bisa dipakai setelah shift dibuka.</p>
          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B] text-left block">Kas Awal</label>
          <input data-testid="gate-opening-cash" type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="0" className="w-full h-12 rounded-xl border px-3 mt-1.5 font-num text-lg" autoFocus />
          <button data-testid="gate-open-shift-btn" onClick={openShiftInline}
            className="tap w-full py-3 mt-4 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center justify-center gap-2">
            <Play size={16} /> Buka Shift & Mulai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* top bar: order type */}
      <div className="h-16 shrink-0 bg-white border-b flex items-center px-4 gap-2">
        {ORDER_TYPES.map((t) => (
          <button
            key={t.key}
            data-testid={`ordertype-${t.key}`}
            onClick={() => switchType(t.key)}
            className={`tap h-11 px-5 rounded-xl font-bold text-sm flex items-center gap-2 border-2 ${
              orderType === t.key ? `${t.cls}` : "bg-white text-[#52525B] border-transparent hover:bg-[#F4F5F7]"
            }`}
          >
            <t.icon size={18} /> {t.label}
          </button>
        ))}
        <div className="flex-1" />
        {cacheAt && (
          <div data-testid="cache-indicator" title="Waktu data produk/harga terakhir diperbarui dari server"
            className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold ${online ? "bg-[#F4F5F7] text-[#52525B]" : "bg-[#FEF3C7] text-[#B45309]"}`}>
            <Database size={13} /> Data: {new Date(cacheAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            {!online && " (offline)"}
          </div>
        )}
        {orderType === "dine_in" && (
          <button
            data-testid="pick-table-btn"
            onClick={openTablePicker}
            className="tap h-11 px-5 rounded-xl font-bold text-sm flex items-center gap-2 bg-[#0A0A0A] text-white"
          >
            <Armchair size={18} /> {table ? table.name : "Pilih Meja"}
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* categories */}
        <div className="w-[200px] shrink-0 bg-white border-r overflow-y-auto no-scrollbar p-3 space-y-1.5">
          <button
            onClick={() => setActiveCat("all")}
            className={`tap w-full h-14 rounded-xl px-3 text-left font-bold text-sm flex items-center gap-2 ${
              activeCat === "all" ? "bg-[#E63946] text-white" : "bg-[#F4F5F7] hover:bg-[#e9eaee]"
            }`}
          >
            <Layers size={16} /> Semua
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              data-testid={`cat-${c.id}`}
              onClick={() => setActiveCat(c.id)}
              className={`tap w-full min-h-14 rounded-xl px-3 py-2 text-left font-bold text-sm ${
                activeCat === c.id ? "bg-[#E63946] text-white" : "bg-[#F4F5F7] hover:bg-[#e9eaee]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* product grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-white space-y-2">
            <div className="relative">
              <ScanLine size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E63946]" />
              <input
                data-testid="barcode-input"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleBarcode}
                placeholder="Scan / ketik kode produk (SKU) lalu Enter"
                className="w-full h-12 pl-10 pr-3 rounded-xl border-2 border-[#E63946] outline-none font-num"
                autoFocus
              />
            </div>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
              <input
                data-testid="product-search"
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-[#E4E4E7] focus:border-[#E63946] outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-3">
            {visibleProducts.length === 0 && (
              <div className="text-center text-[#a1a1aa] mt-20">Tidak ada produk</div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleProducts.map((p) => {
                const out = p.sold_out || (p.track_stock && p.stock <= 0);
                return (
                  <button
                    key={p.id}
                    data-testid={`product-card-${p.id}`}
                    onClick={() => addItem(p)}
                    disabled={out}
                    className={`tap relative text-left rounded-xl border bg-white overflow-hidden hover:border-[#E63946] ${
                      out ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <div className="h-24 bg-[#F4F5F7] overflow-hidden">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full grid place-items-center text-[#d4d4d8]"><Store size={28} /></div>
                      )}
                    </div>
                    {out && (
                      <span className="absolute top-2 left-2 bg-[#EF4444] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        SOLD OUT
                      </span>
                    )}
                    <div className="p-2.5">
                      <div className="font-bold text-sm leading-tight line-clamp-2 min-h-[2.3em]">{p.name}</div>
                      <div className="font-num text-[#E63946] font-bold mt-1">{rupiah(p.price)}</div>
                      {p.track_stock && <div className="text-[11px] text-[#52525B]">Stok: {p.stock}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* cart */}
        <div className="w-[340px] shrink-0 bg-white border-l-2 border-[#E63946] flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-extrabold flex items-center gap-2"><Receipt size={18} /> Keranjang</div>
            {cart.length > 0 && (
              <button data-testid="clear-cart" onClick={resetSale} className="text-xs text-[#EF4444] font-bold flex items-center gap-1">
                <Trash2 size={14} /> Kosongkan
              </button>
            )}
          </div>
          {orderType === "dine_in" && table && (
            <div className="px-4 py-2 text-sm font-bold ot-dine_in border-y">
              Meja: {table.name} {currentOrderId ? "· Open Bill" : ""}
            </div>
          )}
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
            {cart.length === 0 && (
              <div className="text-center text-[#a1a1aa] mt-16 text-sm">Belum ada item</div>
            )}
            {cart.map((i) => (
              <div key={i.product_id} data-testid={`cart-item-${i.product_id}`} className="rounded-xl border p-2.5">
                <div className="flex justify-between gap-2">
                  <div className="font-bold text-sm leading-tight">{i.name}</div>
                  <button onClick={() => removeItem(i.product_id)} className="text-[#a1a1aa] hover:text-[#EF4444]"><X size={16} /></button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button data-testid={`qty-minus-${i.product_id}`} onClick={() => changeQty(i.product_id, -1)} className="tap h-8 w-8 rounded-lg bg-[#F4F5F7] grid place-items-center"><Minus size={15} /></button>
                    <span className="font-num font-bold w-6 text-center">{i.qty}</span>
                    <button data-testid={`qty-plus-${i.product_id}`} onClick={() => changeQty(i.product_id, 1)} className="tap h-8 w-8 rounded-lg bg-[#F4F5F7] grid place-items-center"><Plus size={15} /></button>
                  </div>
                  <div className="font-num font-bold">{rupiah(i.price * i.qty)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t p-4 space-y-3">
            <div className="flex gap-2">
              <select
                data-testid="discount-type" value={discType}
                onChange={(e) => { setDiscType(e.target.value); setDiscVal(0); }}
                className="h-10 rounded-lg border px-2 text-sm bg-white"
              >
                <option value="none">Tanpa Diskon</option>
                <option value="percent">Diskon %</option>
                <option value="amount">Diskon Rp</option>
              </select>
              {discType !== "none" && (
                <input
                  data-testid="discount-value" type="number" min="0" value={discVal}
                  onChange={(e) => setDiscVal(Number(e.target.value))}
                  className="h-10 rounded-lg border px-2 text-sm flex-1 font-num"
                />
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[#52525B]"><span>Subtotal</span><span className="font-num">{rupiah(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-[#EF4444]"><span>Diskon</span><span className="font-num">-{rupiah(discount)}</span></div>}
              <div className="flex justify-between font-extrabold text-lg"><span>Total</span><span className="font-num" data-testid="cart-total">{rupiah(total)}</span></div>
            </div>
            <div className="flex gap-2">
              {orderType === "dine_in" && (
                <>
                  <button
                    data-testid="save-openbill-btn" onClick={saveOpenBill} disabled={!cart.length || !table}
                    className="tap flex-1 h-13 py-3 rounded-xl bg-[#0A0A0A] text-white font-bold disabled:opacity-40"
                  >
                    Simpan Bill
                  </button>
                  <button
                    data-testid="interim-bill-btn" onClick={printInterimBill} disabled={!cart.length}
                    className="tap h-13 px-3 rounded-xl bg-white border-2 border-[#0A0A0A] text-[#0A0A0A] font-bold text-xs disabled:opacity-40"
                  >
                    <Receipt size={15} /> Bill Sementara
                  </button>
                </>
              )}
              <button
                data-testid="pay-btn"
                onClick={() => {
                  if (!cart.length) return toast.error("Keranjang kosong");
                  if (orderType === "dine_in" && !table) return toast.error("Pilih meja dulu");
                  setPayOpen(true);
                }}
                disabled={!cart.length}
                className="tap flex-1 h-13 py-3 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold disabled:opacity-40"
              >
                Bayar
              </button>
            </div>
          </div>
        </div>
      </div>

      <TableDialog open={tableOpen} onClose={() => setTableOpen(false)} tables={tables} onSelect={selectTable} />
      <PayDialog open={payOpen} onClose={() => setPayOpen(false)} pms={pms} total={total}
        discountType={discType} discountValue={Number(discVal)} subtotal={subtotal} onPay={doPay} />
      <ReceiptDialog order={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function TableDialog({ open, onClose, tables, onSelect }) {
  const areas = [...new Set(tables.filter((t) => t.active).map((t) => t.area))];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Pilih Meja (Dine-In)</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {tables.filter((t) => t.active).length === 0 && <p className="text-sm text-[#52525B]">Belum ada meja aktif. Tambahkan di menu Meja.</p>}
          {areas.map((area) => (
            <div key={area}>
              <div className="text-xs uppercase tracking-wider font-bold text-[#52525B] mb-2">{area}</div>
              <div className="grid grid-cols-5 gap-2">
                {tables.filter((t) => t.active && t.area === area).map((t) => (
                  <button
                    key={t.id} data-testid={`table-opt-${t.id}`} onClick={() => onSelect(t)}
                    className={`tap h-14 rounded-lg border-2 font-bold flex flex-col items-center justify-center ${
                      t.status === "open_bill" ? "tbl-open_bill" : "tbl-empty"
                    }`}
                  >
                    <span className="text-sm">{t.name}</span>
                    <span className="text-[9px] mt-0.5">{t.status === "open_bill" ? "OPEN BILL" : `${t.capacity} kursi`}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ open, onClose, pms, total, discountType, discountValue, subtotal, onPay }) {
  const [method, setMethod] = useState(null);
  const [paid, setPaid] = useState("");
  const [member, setMember] = useState(null);
  const [phone, setPhone] = useState("");
  const [redeemPts, setRedeemPts] = useState("");
  const [discReason, setDiscReason] = useState("");
  const [searching, setSearching] = useState(false);
  useEffect(() => { if (open) { setMethod(null); setPaid(""); setMember(null); setPhone(""); setRedeemPts(""); setDiscReason(""); } }, [open]);
  const isCash = method?.type === "cash";
  const amt = isCash ? Number(paid || 0) : total;
  const change = amt - total;
  const quick = [total, 50000, 100000, 150000, 200000];
  const redeemVal = Math.min(Number(redeemPts || 0) || 0, member?.points || 0) * 100;
  const finalTotal = Math.max(0, total - redeemVal);
  const needReason = (discountType === "percent" && discountValue > 15) || (discountType === "amount" && discountValue > 50000);

  const findMember = async () => {
    if (!phone.trim()) return toast.error("Masukkan nomor WA member dulu");
    setSearching(true);
    try {
      const { data } = await api.get("/members/search", { params: { phone: phone.trim() } });
      if (data.member) { setMember(data.member); toast.success(`${data.member.name} — poin ${(data.member.points || 0).toLocaleString("id-ID")}`); }
      else { setMember(null); toast.error("Member tidak ditemukan. Daftarkan di menu Member."); }
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSearching(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Pembayaran</DialogTitle></DialogHeader>
        <div className="text-center py-2">
          <div className="text-xs uppercase tracking-wider text-[#52525B] font-bold">Total Tagihan</div>
          <div className="font-num text-4xl font-extrabold text-[#E63946]">{rupiah(total)}</div>
        </div>

        {/* Member & poin */}
        <div className="rounded-xl border border-[#E4E4E7] p-3 space-y-2">
          <div className="text-xs font-bold text-[#52525B] uppercase tracking-wider">Member (poin loyalitas)</div>
          <div className="flex gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="No. WA member"
              className="flex-1 h-10 rounded-lg border px-3 text-sm" />
            <button onClick={findMember} disabled={searching} className="tap h-10 px-3 rounded-lg bg-[#0A0A0A] text-white text-sm font-bold disabled:opacity-50">
              {searching ? "..." : "Cari"}
            </button>
          </div>
          {member && (
            <div className="text-sm bg-[#F4F5F7] rounded-lg p-2 flex flex-wrap items-center gap-2">
              <span className="font-bold">{member.name}</span>
              <span className="text-[#047857] font-bold">Poin {(member.points || 0).toLocaleString("id-ID")}</span>
              <input type="number" min="0" max={member.points} value={redeemPts} onChange={(e) => setRedeemPts(e.target.value)}
                placeholder="Tukar poin (1pt=Rp100)" className="ml-auto w-40 h-9 rounded-lg border px-2 font-num text-sm" />
            </div>
          )}
          {redeemVal > 0 && (
            <div className="flex justify-between text-sm font-bold"><span>Potongan poin</span><span className="text-[#E63946] font-num">-{rupiah(redeemVal)}</span></div>
          )}
        </div>

        {/* Alasan diskon besar */}
        {needReason && (
          <div>
            <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Alasan diskon (wajib)</label>
            <textarea value={discReason} onChange={(e) => setDiscReason(e.target.value)} rows={2}
              placeholder="Contoh: diskon member, promo perayaan, komplain pelanggan…"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#E63946]" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {pms.map((pm) => (
            <button
              key={pm.id} data-testid={`pm-${pm.type}`} onClick={() => setMethod(pm)}
              className={`tap h-14 rounded-xl border-2 font-bold text-sm ${
                method?.id === pm.id ? "bg-[#E63946] text-white border-[#E63946]" : "bg-white border-[#E4E4E7]"
              }`}
            >
              {pm.name}
            </button>
          ))}
        </div>
        {isCash && (
          <div className="space-y-2">
            <input
              data-testid="cash-amount" type="number" value={paid} onChange={(e) => setPaid(e.target.value)}
              placeholder="Jumlah bayar" className="w-full h-12 rounded-xl border px-3 font-num text-lg"
            />
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button key={q} onClick={() => setPaid(String(q))} className="tap px-3 h-9 rounded-lg bg-[#F4F5F7] text-sm font-num font-bold">
                  {rupiah(q)}
                </button>
              ))}
            </div>
            {amt >= total && <div className="flex justify-between font-bold"><span>Kembalian</span><span className="font-num text-[#047857]">{rupiah(change)}</span></div>}
          </div>
        )}
        <DialogFooter>
          <button
            data-testid="confirm-pay-btn"
            disabled={!method || (isCash && amt < finalTotal) || (needReason && !discReason.trim())}
            onClick={() => onPay(method, isCash ? amt : finalTotal, {
              member_id: member?.id || null,
              redeem_points: Number(redeemPts || 0) || 0,
              discount_reason: needReason ? discReason.trim() : null,
            })}
            className="tap w-full h-13 py-3 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} /> Konfirmasi Bayar {finalTotal !== total ? `· ${rupiah(finalTotal)}` : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({ order, onClose }) {
  if (!order) return null;
  return (
    <Dialog open={!!order} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#047857]"><CheckCircle2 /> Transaksi Selesai</DialogTitle></DialogHeader>
        <div className="text-center">
          {order.offline && <div data-testid="offline-receipt-badge" className="inline-block bg-[#0A0A0A] text-white text-xs font-bold px-3 py-1 rounded-full mb-2">STRUK OFFLINE — BELUM DISINKRON</div>}
          <div className="font-num text-sm text-[#52525B]">{order.order_number}</div>
          <div className="font-num text-3xl font-extrabold mt-1">{rupiah(order.total)}</div>
          {order.change > 0 && <div className="text-sm mt-1">Kembalian: <span className="font-num font-bold">{rupiah(order.change)}</span></div>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <button data-testid="print-receipt-btn" onClick={() => printReceipt(order)} className="tap w-full h-12 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center justify-center gap-2">
            <Receipt size={18} /> Cetak Struk
          </button>
          <button onClick={onClose} className="tap w-full h-12 rounded-xl bg-[#F4F5F7] font-bold">Transaksi Baru</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
