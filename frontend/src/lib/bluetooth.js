import { toast } from "sonner";
import { getDeviceConfig, setDeviceConfig } from "./device";

// ============================================================
// Printer Bluetooth (ESC/POS) — via Web Bluetooth API.
// Berjalan di Chrome/WebView yang mendukung navigator.bluetooth
// (secure context: HTTPS atau http://localhost — APK memenuhi).
// ============================================================

// Karakteristik tulis yang umum dipakai printer thermal 58/80mm Bluetooth.
const CANDIDATE_SERVICES = [0x18f0, 0xff00, 0x0000fff0, "49535343-fe7d-4ae5-8fa9-9fafd205e455"];
const WRITE_PROPS = ["writeValueWithoutResponse", "writeValue"];

let cachedCharacteristic = null;
let cachedDevice = null;

function escapeBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

function toBytes(text) {
  // Encode teks ke byte (UTF-8). Nama/angka Indonesia aman; gunakan charset ESC/POS.
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) out.push(c);
    else out.push(0x3f); // '?' untuk non-ASCII (fallback WebView sangat tua)
  }
  return new Uint8Array(out);
}

// ESC/POS command helpers
const ESC = 0x1b, GS = 0x1d;
function cmd(...args) { return new Uint8Array(args); }
function text(t) { return toBytes(t); }
function concat(...parts) {
  let len = 0;
  parts.forEach((p) => { len += p.length; });
  const out = new Uint8Array(len);
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}

export async function requestBluetoothPrinter() {
  if (!escapeBluetoothSupported()) throw new Error("Bluetooth tidak didukung di browser/WebView ini");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATE_SERVICES,
  });
  const server = await device.gatt.connect();
  // Cari karakteristik tulis pada layanan kandidat
  let found = null;
  for (const svc of CANDIDATE_SERVICES) {
    try {
      const service = await server.getPrimaryService(svc);
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (WRITE_PROPS.some((p) => ch[p])) { found = ch; break; }
      }
    } catch (_) { /* layanan tidak ada, coba berikutnya */ }
    if (found) break;
  }
  if (!found) {
    // Coba semua layanan yang terpapar (fallback)
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (WRITE_PROPS.some((p) => ch[p])) { found = ch; break; }
        }
        if (found) break;
      }
    } catch (_) {}
  }
  if (!found) throw new Error("Tidak menemukan karakteristik tulis pada printer ini");
  cachedCharacteristic = found;
  cachedDevice = device;
  device.addEventListener("gattserverdisconnected", () => { cachedCharacteristic = null; cachedDevice = null; });
  return { name: device.name || "Printer Bluetooth", characteristic: found };
}

export function hasBluetoothPrinter() {
  return !!cachedCharacteristic;
}

export function clearBluetoothPrinter() {
  try { cachedDevice && cachedDevice.gatt && cachedDevice.gatt.disconnect(); } catch (_) {}
  cachedCharacteristic = null;
  cachedDevice = null;
}

function buildEscPos(order, cfg) {
  const rupiah = (n) => "Rp" + Math.round(Number(n || 0)).toLocaleString("id-ID");
  const LABEL = { dine_in: "Dine-In", take_away: "Take Away", retail: "Retail" };
  const dt = new Date(order.paid_at || order.created_at).toLocaleString("id-ID");
  const L = [];
  L.push(cmd(ESC, 0x40)); // init
  L.push(cmd(ESC, 0x61, 1)); // center
  L.push(cmd(ESC, 0x45, 1)); // bold on
  L.push(text((cfg.outletName || "") + "\n"));
  L.push(cmd(ESC, 0x45, 0)); // bold off
  if (cfg.outletAddress) L.push(text((cfg.outletAddress || "") + "\n"));
  L.push(text("\n"));
  L.push(cmd(ESC, 0x61, 0)); // left
  L.push(text(`No: ${order.order_number}\n`));
  L.push(text(`${dt}\n`));
  L.push(text(`Kasir: ${order.cashier_name || "-"}\n`));
  L.push(text(`${LABEL[order.order_type] || order.order_type || ""}\n`));
  L.push(text("--------------------------------\n"));
  (order.items || []).forEach((i) => {
    const rp = (n) => "Rp" + Math.round(Number(n || 0)).toLocaleString("id-ID");
    const qp = `${i.qty}x${rp(i.price)}`;
    const tot = rp(i.price * i.qty);
    const right = `${qp} ${tot}`;
    const nameW = 40 - right.length - 1;
    let nm = String(i.name || "");
    if (nm.length > nameW) nm = nm.slice(0, Math.max(0, nameW - 1)) + "~";
    const pad = Math.max(1, 41 - nm.length - right.length);
    L.push(text(`${nm}${" ".repeat(pad)}${right}\n`));
  });
  L.push(text("--------------------------------\n"));
  L.push(text(`Subtotal: ${rupiah(order.subtotal)}\n`));
  if (order.discount) L.push(text(`Diskon: -${rupiah(order.discount)}\n`));
  (order.promos_applied || []).forEach((p) => L.push(text(`Promo ${p}: -${rupiah(order.promo_discount || 0)}\n`)));
  if (order.redeem_discount) L.push(text(`Tukar poin: -${rupiah(order.redeem_discount)}\n`));
  L.push(cmd(ESC, 0x61, 1));
  L.push(cmd(ESC, 0x45, 1));
  L.push(text(`TOTAL: ${rupiah(order.total)}\n`));
  L.push(cmd(ESC, 0x45, 0));
  L.push(cmd(ESC, 0x61, 0));
  if (order.payment_method_name) L.push(text(`${order.payment_method_name}: ${rupiah(order.amount_paid || order.total)}\n`));
  if (order.change) L.push(text(`Kembali: ${rupiah(order.change)}\n`));
  if (order.points_earned) L.push(text(`Poin member: +${order.points_earned}\n`));
  L.push(text(`\n${cfg.footerText || "Terima kasih"}\n`));
  L.push(text("\n\n"));
  L.push(cmd(GS, 0x56, 0)); // cut (full)
  return concat(...L);
}

export async function printViaBluetooth(order) {
  const cfg = getDeviceConfig();
  if (!escapeBluetoothSupported()) throw new Error("Web Bluetooth tidak didukung browser ini");
  let ch = cachedCharacteristic;
  // Coba sambungkan ulang ke device yang tersimpan di config
  if (!ch && cfg.bluetoothDevice) {
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: CANDIDATE_SERVICES,
        // tidak bisa filter nama di semua browser; requestDevice menampilkan pilihan
      });
      const server = await device.gatt.connect();
      for (const svc of CANDIDATE_SERVICES) {
        try {
          const service = await server.getPrimaryService(svc);
          const chars = await service.getCharacteristics();
          for (const cc of chars) {
            if (WRITE_PROPS.some((p) => cc[p])) { ch = cc; break; }
          }
        } catch (_) {}
        if (ch) break;
      }
      if (!ch) throw new Error("Tidak menemukan karakteristik tulis");
      cachedCharacteristic = ch;
      cachedDevice = device;
      device.addEventListener("gattserverdisconnected", () => { cachedCharacteristic = null; cachedDevice = null; });
    } catch (e) {
      throw new Error("Gagal konek printer Bluetooth: " + (e.message || e));
    }
  }
  if (!ch) throw new Error("Printer Bluetooth belum dipasang — pilih di Pengaturan > Perangkat");
  const data = buildEscPos(order, cfg);
  try {
    if (ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(data);
    else if (ch.writeValue) await ch.writeValue(data);
    else throw new Error("Karakteristik tidak bisa ditulis");
  } catch (e) {
    throw new Error("Gagal kirim ke printer: " + (e.message || e));
  }
  return true;
}

export { escapeBluetoothSupported };
