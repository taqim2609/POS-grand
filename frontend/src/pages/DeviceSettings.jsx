import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Server, Store, Save, ReceiptText, Upload, Loader2, Bluetooth } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { getDeviceConfig, setDeviceConfig, getServerUrl, setServerUrl, sampleOrder, getPrinterStatus } from "@/lib/device";
import { printReceipt } from "@/lib/receipt";
import { requestBluetoothPrinter, clearBluetoothPrinter } from "@/lib/bluetooth";

export default function DeviceSettings() {
  const [cfg, setCfg] = useState(getDeviceConfig());
  const [srv, setSrv] = useState(getServerUrl());
  const [outlet, setOutlet] = useState(null); // data global server (outlet & logo)
  const [upLogo, setUpLogo] = useState(false);
  const upd = (patch) => setCfg((c) => ({ ...c, ...patch }));

  useEffect(() => {
    api.get("/settings/outlet")
      .then((r) => {
        setOutlet(r.data);
        // Sinkronkan nama/alamat server ke config lokal bila lokal masih default kosong
        setCfg((c) => ({
          ...c,
          outletName: r.data?.name || c.outletName,
          outletAddress: r.data?.address || c.outletAddress,
        }));
      })
      .catch(() => {});
  }, []);

  const save = () => {
    setDeviceConfig(cfg);
    toast.success("Pengaturan perangkat disimpan di perangkat ini");
  };
  const saveServer = () => {
    setServerUrl(srv);
    toast.success("Alamat server disimpan. Memuat ulang...");
    setTimeout(() => window.location.reload(), 700);
  };
  const testPrint = () => {
    setDeviceConfig(cfg);
    printReceipt(sampleOrder());
    toast.message("Mengirim struk uji ke printer...");
  };
  const [btBusy, setBtBusy] = useState(false);
  const pairBt = async () => {
    setBtBusy(true);
    const t = toast.loading("Memilih printer Bluetooth...");
    try {
      const r = await requestBluetoothPrinter();
      const name = r.name || "Printer Bluetooth";
      setDeviceConfig({ ...getDeviceConfig(), printerMode: "bluetooth", bluetoothDevice: name });
      setCfg((c) => ({ ...c, printerMode: "bluetooth", bluetoothDevice: name }));
      toast.success(`Printer "${name}" terpasang`, { id: t });
    } catch (e) {
      toast.error(e.message || "Gagal memasang printer Bluetooth", { id: t, duration: 9000 });
    } finally { setBtBusy(false); }
  };
  const saveOutlet = async () => {
    if (!outlet) return;
    try {
      await api.put("/settings/outlet", { name: outlet.name, address: outlet.address, phone: outlet.phone });
      // ikutkan ke header struk lokal
      setCfg((c) => ({ ...c, outletName: outlet.name || c.outletName, outletAddress: outlet.address || c.outletAddress }));
      toast.success("Identitas outlet disimpan (server)");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const uploadLogo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUpLogo(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("/settings/outlet/logo", fd);
      setOutlet((o) => ({ ...o, logo_url: data.url }));
      toast.success("Logo terunggah");
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setUpLogo(false); e.target.value = ""; }
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="device-settings-page">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2"><Printer className="text-[#E63946]" /> Pengaturan Perangkat</h1>
          <p className="text-[#52525B] text-sm mt-1">Identitas outlet & logo disimpan di server (dipakai semua perangkat); setelan printer/server tersimpan per perangkat ini.</p>
        </div>

        {/* OUTLET & LOGO (global server) */}
        <Card icon={Store} title="Outlet & Logo (Identitas Outlet)">
          <div className="flex items-center gap-4 flex-wrap">
            {outlet?.logo_url ? (
              <img src={outlet.logo_url} alt="logo" className="h-16 w-16 rounded-xl border object-contain bg-white" data-testid="outlet-logo" />
            ) : (
              <div className="h-16 w-16 rounded-xl border bg-[#F4F5F7] grid place-items-center text-[#a1a1aa]"><Store size={24} /></div>
            )}
            <label className="tap h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-bold text-sm inline-flex items-center gap-2 cursor-pointer">
              <Upload size={15} /> {upLogo ? "Mengunggah..." : "Unggah Logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={uploadLogo} data-testid="outlet-logo-input" />
            </label>
          </div>
          <Field label="Nama Outlet">
            <input data-testid="outlet-name" value={outlet?.name || ""} onChange={(e) => setOutlet({ ...outlet, name: e.target.value })} className={inp} />
          </Field>
          <Field label="Alamat">
            <input data-testid="outlet-address" value={outlet?.address || ""} onChange={(e) => setOutlet({ ...outlet, address: e.target.value })} className={inp} />
          </Field>
          <Field label="Telepon">
            <input data-testid="outlet-phone" value={outlet?.phone || ""} onChange={(e) => setOutlet({ ...outlet, phone: e.target.value })} className={inp} />
          </Field>
          <button data-testid="outlet-save" onClick={saveOutlet} className="tap h-11 px-5 rounded-xl bg-[#E63946] text-white font-bold flex items-center gap-2"><Save size={16} /> Simpan Outlet</button>
        </Card>

        {/* IDENTITAS STRUK LOKAL (header per perangkat) */}
        <Card icon={ReceiptText} title="Header Struk (per perangkat)">
          <Field label="Nama Header Struk">
            <input data-testid="dev-outlet-name" value={cfg.outletName} onChange={(e) => upd({ outletName: e.target.value })} className={inp} />
          </Field>
          <Field label="Alamat Header">
            <input data-testid="dev-outlet-address" value={cfg.outletAddress} onChange={(e) => upd({ outletAddress: e.target.value })} className={inp} />
          </Field>
          <Field label="Teks Penutup Struk">
            <input data-testid="dev-footer" value={cfg.footerText} onChange={(e) => upd({ footerText: e.target.value })} className={inp} />
          </Field>
        </Card>

        {/* PRINTER */}
        <Card icon={ReceiptText} title="Printer Struk">
          <div data-testid="printer-status" className={`rounded-xl px-3 py-2 text-sm font-bold ${cfg.printerMode === "bluetooth" && !cfg.bluetoothDevice ? "bg-[#FEF3C7] text-[#B45309]" : cfg.printerMode === "bluetooth" && typeof navigator !== "undefined" && !navigator.bluetooth ? "bg-[#FEE2E2] text-[#B91C1C]" : cfg.printerMode === "epson" && !cfg.epsonIp ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#ECFDF5] text-[#047857]"}`}>
            Status: {getPrinterStatus().label}
          </div>
          <Field label="Mode Printer">
            <select data-testid="dev-printer-mode" value={cfg.printerMode} onChange={(e) => upd({ printerMode: e.target.value })} className={`${inp} bg-white`}>
              <option value="auto">Otomatis (Sunmi bawaan → browser)</option>
              <option value="sunmi">Sunmi bawaan (T2/T2+)</option>
              <option value="bluetooth">Bluetooth (ESC/POS)</option>
              <option value="epson">Epson jaringan (POS Komputer)</option>
              <option value="browser">Cetak lewat browser</option>
            </select>
          </Field>
          {cfg.printerMode === "bluetooth" && (
            <div className="space-y-2">
              <p className="text-[11px] text-[#a1a1aa] -mt-1">Butuh Chrome/WebView modern (Web Bluetooth). Di APK otomatis tersedia (http://localhost = secure).</p>
              <button data-testid="dev-bt-pair" onClick={pairBt} disabled={btBusy}
                className="tap h-11 px-4 rounded-lg bg-[#0A0A0A] text-white font-bold text-xs inline-flex items-center gap-2 disabled:opacity-50">
                {btBusy ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />} Pasang Printer Bluetooth…
              </button>
              {cfg.bluetoothDevice && (
                <div className="flex items-center gap-2 text-sm bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3 py-2">
                  <Bluetooth size={14} className="text-[#047857]" />
                  <span className="font-bold">{cfg.bluetoothDevice}</span>
                  <button data-testid="dev-bt-remove" onClick={() => { clearBluetoothPrinter(); setDeviceConfig({ ...getDeviceConfig(), bluetoothDevice: "" }); setCfg((c) => ({ ...c, bluetoothDevice: "" })); toast.success("Printer Bluetooth dilepas"); }}
                    className="ml-auto text-[#DC2626] font-bold text-xs">Lepas</button>
                </div>
              )}
            </div>
          )}
          {cfg.printerMode === "epson" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="IP Printer Epson">
                  <input data-testid="dev-epson-ip" value={cfg.epsonIp} onChange={(e) => upd({ epsonIp: e.target.value })} placeholder="192.168.1.50" className={`${inp} font-mono`} />
                </Field>
              </div>
              <Field label="Port">
                <input data-testid="dev-epson-port" value={cfg.epsonPort} onChange={(e) => upd({ epsonPort: e.target.value })} placeholder="80" className={`${inp} font-mono`} />
              </Field>
              <p className="col-span-3 text-[11px] text-[#a1a1aa] -mt-1">Aktifkan fitur <b>ePOS-Print</b> di printer Epson (mis. TM-T82X/TM-m30) lewat panel web printer.</p>
            </div>
          )}
          <label className="flex items-center gap-2.5 mt-1 cursor-pointer" data-testid="dev-cashdrawer">
            <input type="checkbox" checked={cfg.cashDrawer} onChange={(e) => upd({ cashDrawer: e.target.checked })} className="h-4 w-4 accent-[#E63946]" />
            <span className="text-sm font-bold">Buka laci kasir otomatis saat transaksi tunai</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button data-testid="dev-save" onClick={save} className="tap h-11 px-5 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center gap-2"><Save size={16} /> Simpan</button>
            <button data-testid="dev-testprint" onClick={testPrint} className="tap h-11 px-5 rounded-xl bg-[#F4F5F7] border font-bold flex items-center gap-2"><Printer size={16} /> Cetak Struk Uji</button>
          </div>
        </Card>

        {/* SERVER */}
        <Card icon={Server} title="Alamat Server (LAN)">
          <p className="text-[11px] text-[#a1a1aa] -mt-1">Isi IP komputer server saat memakai APK Android di jaringan toko. Kosongkan untuk memakai server yang sama dengan aplikasi.</p>
          <Field label="URL Server">
            <input data-testid="dev-server-url" value={srv} onChange={(e) => setSrv(e.target.value)} placeholder="http://192.168.1.100" className={`${inp} font-mono`} />
          </Field>
          <button data-testid="dev-server-save" onClick={saveServer} className="tap h-11 px-5 rounded-xl bg-[#0A0A0A] text-white font-bold flex items-center gap-2 w-fit"><Save size={16} /> Simpan & Hubungkan</button>
        </Card>
      </div>
    </div>
  );
}

const inp = "w-full h-11 px-3 rounded-xl border border-[#E4E4E7] outline-none focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/20 text-sm";

const Card = ({ icon: Icon, title, children }) => (
  <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 space-y-3">
    <div className="flex items-center gap-2 font-extrabold"><Icon size={18} className="text-[#E63946]" /> {title}</div>
    {children}
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">{label}</label>
    <div className="mt-1.5">{children}</div>
  </div>
);
