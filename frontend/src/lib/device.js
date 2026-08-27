// Per-device configuration (printer, outlet header, cash drawer) stored on THIS device.
// Server URL lives in api.js (getServerUrl/setServerUrl); this file re-exports helpers for convenience.
import { getServerUrl, setServerUrl } from "@/lib/api";

export { getServerUrl, setServerUrl };

const KEY = "gak_device_cfg";

export const DEVICE_DEFAULTS = {
  printerMode: "auto", // auto | sunmi | browser | epson | bluetooth
  epsonIp: "",
  epsonPort: "80", // Epson ePOS-Print over HTTP
  bluetoothDevice: "", // nama printer Bluetooth yang dipasang
  cashDrawer: true,
  outletName: "GRAND ACEH KULINER",
  outletAddress: "Jl. Contoh No. 1, Banda Aceh",
  footerText: "Terima kasih & selamat menikmati",
};

export function getDeviceConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEVICE_DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) {
    return { ...DEVICE_DEFAULTS };
  }
}

export function setDeviceConfig(patch) {
  const next = { ...getDeviceConfig(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

const escXml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

// Build an Epson ePOS-Print SOAP envelope for a receipt.
function buildEposEnvelope(order, cfg) {
  const rupiah = (n) => "Rp" + Math.round(Number(n || 0)).toLocaleString("id-ID");
  const LABEL = { dine_in: "Dine-In", take_away: "Take Away", retail: "Retail" };
  const dt = new Date(order.paid_at || order.created_at).toLocaleString("id-ID");
  const t = (txt) => `<text>${escXml(txt)}&#10;</text>`;
  let body = "";
  body += `<text align="center"/><text em="true">${escXml(cfg.outletName)}&#10;</text><text em="false"/>`;
  if (cfg.outletAddress) body += `<text align="center"/>${t(cfg.outletAddress)}`;
  body += `<text align="left"/><text>--------------------------------&#10;</text>`;
  body += t(`No: ${order.order_number}`);
  body += t(dt);
  body += t(`Kasir: ${order.cashier_name || "-"}`);
  body += t(LABEL[order.order_type] || order.order_type || "");
  body += `<text>--------------------------------&#10;</text>`;
  (order.items || []).forEach((i) => {
    body += t(i.name);
    body += t(`  ${i.qty} x ${rupiah(i.price)}   ${rupiah(i.price * i.qty)}`);
  });
  body += `<text>--------------------------------&#10;</text>`;
  body += t(`Subtotal: ${rupiah(order.subtotal)}`);
  if (order.discount) body += t(`Diskon: -${rupiah(order.discount)}`);
  body += `<text em="true">${escXml(`TOTAL: ${rupiah(order.total)}`)}&#10;</text><text em="false"/>`;
  if (order.payment_method_name) body += t(`${order.payment_method_name}: ${rupiah(order.amount_paid || order.total)}`);
  if (order.change) body += t(`Kembali: ${rupiah(order.change)}`);
  body += `<feed line="1"/><text align="center"/>${t(cfg.footerText || "Terima kasih")}`;
  body += `<feed line="2"/><cut type="feed"/>`;
  if (cfg.cashDrawer) body += `<pulse drawer="drawer_1" time="pulse_100"/>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>
<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">${body}</epos-print>
</s:Body></s:Envelope>`;
}

// Print to an Epson TM network printer with ePOS-Print enabled.
export async function printViaEpson(order, cfg) {
  if (!cfg.epsonIp) throw new Error("Alamat IP printer Epson belum diisi");
  const url = `http://${cfg.epsonIp}:${cfg.epsonPort || 80}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' },
    body: buildEposEnvelope(order, cfg),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok || /success="false"/.test(text)) {
    throw new Error("Printer Epson menolak cetak. Pastikan ePOS-Print aktif & IP benar.");
  }
  return true;
}

export function sampleOrder() {
  return {
    order_number: "TEST-0001",
    created_at: new Date().toISOString(),
    cashier_name: "Uji Coba",
    order_type: "dine_in",
    items: [
      { name: "Kopi Susu Gula Aren", qty: 1, price: 18000 },
      { name: "Mie Aceh Goreng", qty: 2, price: 25000 },
    ],
    subtotal: 68000,
    discount: 0,
    total: 68000,
    payment_method_name: "Tunai",
    amount_paid: 70000,
    change: 2000,
  };
}

// ============================================================
// Status printer — untuk ditampilkan di Pengaturan > Perangkat & layar POS
// ============================================================
export function getPrinterStatus() {
  const cfg = getDeviceConfig();
  const mode = cfg.printerMode || "auto";
  const bluetoothSupported = typeof navigator !== "undefined" && !!navigator.bluetooth;
  let label = "";
  let level = "info"; // ok | warn | error
  let debug = "";
  // Cek bridge Sunmi (untuk mode sunmi/auto) — status koneksi AIDL
  let sunmiConnected = null;
  try {
    const sp = window.SunmiInnerPrinter || window.sunmiInnerPrinter || window.sunmi || window.SunmiPrinterBridge;
    if (sp && typeof sp.isConnected === "function") sunmiConnected = !!sp.isConnected();
    if (sp && typeof sp.getDebugInfo === "function" && sunmiConnected === false) debug = sp.getDebugInfo();
  } catch (e) {}
  switch (mode) {
    case "auto":
      label = "Otomatis (Sunmi → browser)";
      if (sunmiConnected === false) { label = "Otomatis (Sunmi tidak terdeteksi → browser)"; level = "warn"; }
      break;
    case "sunmi":
      if (sunmiConnected === false) { label = "Sunmi (printer tidak terdeteksi)"; level = "error"; }
      else if (sunmiConnected === null) { label = "Sunmi (periksa di APK — bridge tidak ada)"; level = "warn"; }
      else { label = "Sunmi (printer internal)"; }
      break;
    case "epson":
      label = cfg.epsonIp ? `Epson ${cfg.epsonIp}` : "Epson (IP belum diisi)";
      if (!cfg.epsonIp) level = "warn";
      break;
    case "bluetooth":
      if (!bluetoothSupported) { label = "Bluetooth (tidak didukung browser ini)"; level = "error"; }
      else if (cfg.bluetoothDevice) { label = `Bluetooth: ${cfg.bluetoothDevice}`; }
      else { label = "Bluetooth (belum dipasang)"; level = "warn"; }
      break;
    case "browser":
      label = "Cetak lewat browser";
      break;
    default:
      label = mode;
  }
  return { mode, label, level, bluetoothSupported, deviceName: cfg.bluetoothDevice || cfg.epsonIp || "", sunmiConnected, debug };
}
