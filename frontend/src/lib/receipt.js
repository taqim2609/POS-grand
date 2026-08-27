import { rupiah, ORDER_TYPE_LABEL } from "@/lib/format";
import { getDeviceConfig, printViaEpson } from "@/lib/device";
import { printViaBluetooth } from "@/lib/bluetooth";
import { getServerUrl } from "@/lib/api";
import { toast } from "sonner";

// ============================================================
// Logo outlet untuk struk — diambil dari server (settings/outlet),
// di-cache sebagai dataURL di localStorage supaya cetak tetap cepat.
// ============================================================
async function getOutletLogoB64() {
  try {
    const cached = localStorage.getItem("gak_logo_b64");
    if (cached) return cached;
    const base = getServerUrl();
    if (!base) return "";
    const token = localStorage.getItem("gak_token") || "";
    const r = await fetch(`${base}/api/settings/outlet`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) return "";
    const j = await r.json();
    const logoUrl = j.logo_url;
    if (!logoUrl) return "";
    const img = await fetch(`${base}${logoUrl}`, { cache: "no-store" });
    if (!img.ok) return "";
    const blob = await img.blob();
    const b64 = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve("");
      fr.readAsDataURL(blob);
    });
    if (b64) localStorage.setItem("gak_logo_b64", b64);
    return b64;
  } catch (e) {
    return "";
  }
}

// HTML-escape any user-controlled value before it enters printable markup (prevents XSS)
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Attempt native Sunmi built-in printer (80mm) via its WebView JS bridge.
// Works on Sunmi T2/T2+ when the app runs inside a Sunmi WebView exposing the printer interface.
function trySunmiPrinter(order, cfg, logoB64) {
  try {
    // Bridge Sunmi: (a) bawaan WebView Sunmi (SunmiInnerPrinter), atau
    // (b) bridge native dari MainActivity APK ini (SunmiPrinterBridge, via SDK resmi).
    const sp = window.SunmiInnerPrinter || window.sunmiInnerPrinter || window.sunmi || window.SunmiPrinterBridge;
    if (!sp || typeof sp.printText !== "function") return false;
    // Bridge APK SELALU ada (addJavascriptInterface) walau service belum ter-bind —
    // cek koneksi sungguhan supaya tidak "diam tanpa cetak".
    if (typeof sp.isConnected === "function" && !sp.isConnected()) return false;
    if (sp.printerInit) sp.printerInit();
    // Logo outlet (kalau ada)
    if (logoB64 && sp.printBitmap) {
      try { sp.printBitmap(logoB64); } catch (e) {}
      if (sp.lineWrap) sp.lineWrap(1);
    }
    if (sp.setAlignment) sp.setAlignment(1);
    sp.printText(`${cfg.outletName}\n`);
    if (cfg.outletAddress) sp.printText(`${cfg.outletAddress}\n`);
    if (sp.setAlignment) sp.setAlignment(0);
    sp.printText(`No: ${order.order_number}\n`);
    sp.printText(`${new Date(order.paid_at || order.created_at).toLocaleString("id-ID")}\n`);
    sp.printText(`Kasir: ${order.cashier_name || "-"}\n`);
    sp.printText(`${ORDER_TYPE_LABEL[order.order_type] || order.order_type}\n`);
    sp.printText("--------------------------------\n");
    order.items.forEach((i) => {
      sp.printText(`${i.name}\n  ${i.qty} x ${rupiah(i.price)}  ${rupiah(i.price * i.qty)}\n`);
    });
    sp.printText("--------------------------------\n");
    sp.printText(`Subtotal: ${rupiah(order.subtotal)}\n`);
    if (order.discount) sp.printText(`Diskon: -${rupiah(order.discount)}\n`);
    (order.promos_applied || []).forEach((p) => sp.printText(`Promo ${p}: -${rupiah(order.promo_discount || 0)}\n`));
    if (order.redeem_discount) sp.printText(`Tukar poin: -${rupiah(order.redeem_discount)}\n`);
    sp.printText(`TOTAL: ${rupiah(order.total)}\n`);
    if (order.payment_method_name) sp.printText(`${order.payment_method_name}: ${rupiah(order.amount_paid || order.total)}\n`);
    if (order.change) sp.printText(`Kembali: ${rupiah(order.change)}\n`);
    if (order.points_earned) sp.printText(`Poin member: +${order.points_earned}\n`);
    // QR (mis. QRIS/Netzme di masa depan) — kalau order punya qr_content
    if (order.qr_content && sp.printQRCode) {
      if (sp.lineWrap) sp.lineWrap(1);
      try { sp.printQRCode(order.qr_content, 8, 2); } catch (e) {}
    }
    sp.printText(`\n${cfg.footerText || "Terima kasih"}\n`);
    if (sp.lineWrap) sp.lineWrap(3);
    if (sp.cutPaper) sp.cutPaper(); // auto-cut
    if (cfg.cashDrawer && sp.openDrawer) sp.openDrawer(); // buka laci kasir
    return true;
  } catch (e) {
    return false;
  }
}

function browserPrint(order, cfg, logoB64) {
  const dt = new Date(order.paid_at || order.created_at).toLocaleString("id-ID");
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${esc(i.name)}<br><span class="s">${i.qty} x ${rupiah(i.price)}</span></td>
         <td class="r">${rupiah(i.price * i.qty)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${esc(order.order_number)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body{font-family:'JetBrains Mono',monospace;width:80mm;margin:0;padding:6px 8px;color:#000;font-size:12px}
    h1{font-size:16px;text-align:center;margin:0}
    .c{text-align:center}.r{text-align:right}.s{color:#555;font-size:10px}
    table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
    .hr{border-top:1px dashed #000;margin:6px 0}
    .tot{font-weight:700;font-size:14px}
    .badge{display:inline-block;border:1px solid #000;border-radius:4px;padding:1px 6px;font-size:10px}
    .off{background:#000;color:#fff;text-align:center;padding:2px;font-weight:700;font-size:10px}
    .logo{max-width:60mm;max-height:20mm;object-fit:contain}
  </style></head><body>
    ${logoB64 ? `<div class="c"><img class="logo" src="${logoB64}" alt="logo" /></div>` : ""}
    <h1>${esc(cfg.outletName)}</h1>
    <div class="c s">${esc(cfg.outletAddress || "")}</div>
    ${order.offline ? '<div class="off">STRUK OFFLINE — BELUM DISINKRON</div>' : ""}
    <div class="hr"></div>
    <div>No: ${esc(order.order_number)}</div>
    <div>${esc(dt)}</div>
    <div>Kasir: ${esc(order.cashier_name || "-")}</div>
    <div class="c" style="margin:4px 0"><span class="badge">${esc(ORDER_TYPE_LABEL[order.order_type] || order.order_type)}</span></div>
    <div class="hr"></div>
    <table>${rows}</table>
    <div class="hr"></div>
    <table>
      <tr><td>Subtotal</td><td class="r">${rupiah(order.subtotal)}</td></tr>
      ${order.discount ? `<tr><td>Diskon</td><td class="r">-${rupiah(order.discount)}</td></tr>` : ""}
      ${(order.promos_applied || []).length ? `<tr><td>Promo ${esc(order.promos_applied.join(", "))}</td><td class="r">-${rupiah(order.promo_discount || 0)}</td></tr>` : ""}
      ${order.redeem_discount ? `<tr><td>Tukar poin</td><td class="r">-${rupiah(order.redeem_discount)}</td></tr>` : ""}
      <tr class="tot"><td>TOTAL</td><td class="r">${rupiah(order.total)}</td></tr>
      ${order.payment_method_name ? `<tr><td>${esc(order.payment_method_name)}</td><td class="r">${rupiah(order.amount_paid || order.total)}</td></tr>` : ""}
      ${order.change ? `<tr><td>Kembali</td><td class="r">${rupiah(order.change)}</td></tr>` : ""}
    </table>
    <div class="hr"></div>
    <div class="c s">${esc(cfg.footerText || "Terima kasih")}</div>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close()},400)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=360,height=640");
  if (w) {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    w.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

export async function printReceipt(order) {
  const cfg = getDeviceConfig();
  const logoB64 = await getOutletLogoB64();
  if (cfg.printerMode === "epson") {
    try {
      await printViaEpson(order, cfg);
    } catch (e) {
      toast.error(e.message || "Gagal mencetak ke printer Epson");
      browserPrint(order, cfg, logoB64); // fallback so struk tetap keluar
    }
    return;
  }
  if (cfg.printerMode === "browser") return browserPrint(order, cfg, logoB64);
  if (cfg.printerMode === "bluetooth") {
    try {
      await printViaBluetooth(order);
    } catch (e) {
      toast.error(e.message || "Gagal mencetak ke printer Bluetooth");
      browserPrint(order, cfg, logoB64);
    }
    return;
  }
  // "auto" or "sunmi": coba printer Sunmi bawaan, jatuh ke browser bila tak ada
  if (trySunmiPrinter(order, cfg, logoB64)) return;
  browserPrint(order, cfg, logoB64);
}
