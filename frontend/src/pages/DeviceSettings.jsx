import { useState } from "react";
import { toast } from "sonner";
import { Printer, Server, Store, Save, ReceiptText } from "lucide-react";
import { getDeviceConfig, setDeviceConfig, getServerUrl, setServerUrl, sampleOrder } from "@/lib/device";
import { printReceipt } from "@/lib/receipt";

export default function DeviceSettings() {
  const [cfg, setCfg] = useState(getDeviceConfig());
  const [srv, setSrv] = useState(getServerUrl());
  const upd = (patch) => setCfg((c) => ({ ...c, ...patch }));

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

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="device-settings-page">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2"><Printer className="text-[#E63946]" /> Pengaturan Perangkat</h1>
          <p className="text-[#52525B] text-sm mt-1">Pengaturan ini tersimpan di perangkat ini saja (tiap kasir/tablet punya setelan sendiri).</p>
        </div>

        {/* OUTLET */}
        <Card icon={Store} title="Identitas Outlet (Header Struk)">
          <Field label="Nama Outlet">
            <input data-testid="dev-outlet-name" value={cfg.outletName} onChange={(e) => upd({ outletName: e.target.value })} className={inp} />
          </Field>
          <Field label="Alamat">
            <input data-testid="dev-outlet-address" value={cfg.outletAddress} onChange={(e) => upd({ outletAddress: e.target.value })} className={inp} />
          </Field>
          <Field label="Teks Penutup Struk">
            <input data-testid="dev-footer" value={cfg.footerText} onChange={(e) => upd({ footerText: e.target.value })} className={inp} />
          </Field>
        </Card>

        {/* PRINTER */}
        <Card icon={ReceiptText} title="Printer Struk">
          <Field label="Mode Printer">
            <select data-testid="dev-printer-mode" value={cfg.printerMode} onChange={(e) => upd({ printerMode: e.target.value })} className={`${inp} bg-white`}>
              <option value="auto">Otomatis (Sunmi bawaan → browser)</option>
              <option value="sunmi">Sunmi bawaan (T2/T2+)</option>
              <option value="epson">Epson jaringan (POS Komputer)</option>
              <option value="browser">Cetak lewat browser</option>
            </select>
          </Field>
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
