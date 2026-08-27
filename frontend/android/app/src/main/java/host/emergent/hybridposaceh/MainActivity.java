package host.emergent.hybridposaceh;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

import woyou.aidlservice.jiuiv5.IPrinterService;

/**
 * MainActivity + bridge printer Sunmi (AIDL).
 *
 * WebView Capacitor TIDAK menyediakan window.SunmiInnerPrinter (hanya WebView
 * bawaan Sunmi). Agar cetak thermal Sunmi T2 jalan dari dalam APK, kita bind ke
 * layanan AIDL Sunmi dan ekspos ke JS sebagai window.SunmiPrinterBridge.
 *
 * Kandidat service (paket, action) dicoba berurutan — sebagian ROM Sunmi memakai
 * nama/action berbeda. BindService bisa gagal bila paket tidak terlihat (Android
 * 11+ package visibility) — diatasi dengan <queries> di manifest + retry onResume.
 */
public class MainActivity extends BridgeActivity {

    // Kandidat (paket, action) layanan printer Sunmi.
    private static final String[][] CANDIDATES = {
            {"woyou.aidlservice.jiuiv5", "woyou.aidlservice.jiuiv5"},
            {"woyou.aidlservice.jiuiv5", "woyou.aidlservice.jiuiv5.IPrinterService"},
            {"sunmi.peripheral", "sunmi.peripheral"},
    };
    // Kandidat ComponentName EKSPLISIT (beberapa ROM hanya merespons ini)
    private static final String[][] COMPONENTS = {
            {"woyou.aidlservice.jiuiv5", "woyou.aidlservice.jiuiv5.PrinterService"},
            {"woyou.aidlservice.jiuiv5", "woyou.aidlservice.jiuiv5.IPrinterService"},
            {"sunmi.peripheral", "sunmi.peripheral.printer.SunmiPrinterService"},
    };

    private IPrinterService printerService = null;
    private String boundPackage = "";
    private String lastBindError = "";
    private boolean bound = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final ServiceConnection conn = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            try {
                printerService = IPrinterService.Stub.asInterface(service);
                bound = true;
            } catch (Exception e) {
                printerService = null;
                bound = false;
                lastBindError = "asInterface: " + e;
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerService = null;
            bound = false;
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bindPrinter();
        injectBridge();
        // Retry bind beberapa kali (layanan Sunmi bisa menyala belakangan).
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (printerService == null) bindPrinter();
                injectBridge();
                mainHandler.postDelayed(this, 3000);
            }
        }, 3000);
    }

    private void bindPrinter() {
        // 1) coba action-based
        for (String[] c : CANDIDATES) {
            try {
                Intent intent = new Intent();
                intent.setPackage(c[0]);
                intent.setAction(c[1]);
                if (bindService(intent, conn, Context.BIND_AUTO_CREATE)) {
                    boundPackage = c[0];
                    lastBindError = "";
                    return;
                }
            } catch (Exception e) {
                lastBindError = c[0] + " -> " + e;
            }
        }
        // 2) coba ComponentName eksplisit
        for (String[] c : COMPONENTS) {
            try {
                Intent intent = new Intent();
                intent.setComponent(new ComponentName(c[0], c[1]));
                if (bindService(intent, conn, Context.BIND_AUTO_CREATE)) {
                    boundPackage = c[0] + ":" + c[1];
                    lastBindError = "";
                    return;
                }
            } catch (Exception e) {
                lastBindError = c[0] + ":" + c[1] + " -> " + e;
            }
        }
        if (boundPackage.isEmpty()) lastBindError = lastBindError.isEmpty() ? "semua kandidat gagal bind" : lastBindError;
    }

    private void injectBridge() {
        try {
            final android.webkit.WebView wv = getBridge().getWebView();
            if (wv == null) return;
            wv.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        wv.addJavascriptInterface(new SunmiBridge(), "SunmiPrinterBridge");
                    } catch (Exception e) {
                        lastBindError = "jsInterface: " + e;
                    }
                }
            });
        } catch (Exception e) {
            lastBindError = "inject: " + e;
        }
    }

    public class SunmiBridge {
        @JavascriptInterface
        public boolean isConnected() {
            return printerService != null;
        }

        @JavascriptInterface
        public String getDebugInfo() {
            // Cek apakah paket layanan printer TERPASANG di perangkat
            StringBuilder pkgs = new StringBuilder();
            String[] names = {"woyou.aidlservice.jiuiv5", "sunmi.peripheral"};
            for (String p : names) {
                boolean installed = false;
                try {
                    getPackageManager().getPackageInfo(p, 0);
                    installed = true;
                } catch (Exception e) {
                    installed = false;
                }
                pkgs.append(p).append("=").append(installed ? "ADA" : "TIDAK").append("; ");
            }
            return "pkg:" + pkgs + "bound=" + bound + " pkg=" + boundPackage
                    + (lastBindError.isEmpty() ? "" : " err=" + lastBindError);
        }

        @JavascriptInterface
        public boolean printerInit() {
            try {
                return printerService != null && printerService.printerInit() == 0;
            } catch (Exception e) {
                lastBindError = "printerInit: " + e;
                return false;
            }
        }

        @JavascriptInterface
        public boolean setAlignment(int alignment) {
            try {
                return printerService != null && printerService.setAlignment(alignment) == 0;
            } catch (Exception e) {
                lastBindError = "setAlignment: " + e;
                return false;
            }
        }

        @JavascriptInterface
        public boolean printText(String text) {
            try {
                return printerService != null && printerService.printText(text == null ? "" : text) == 0;
            } catch (Exception e) {
                lastBindError = "printText: " + e;
                return false;
            }
        }

        @JavascriptInterface
        public boolean lineWrap(int n) {
            try {
                return printerService != null && printerService.lineWrap(n) == 0;
            } catch (Exception e) {
                lastBindError = "lineWrap: " + e;
                return false;
            }
        }

        @JavascriptInterface
        public boolean cutPaper() {
            try {
                return printerService != null && printerService.cutPaper(1) == 0;
            } catch (Exception e) {
                lastBindError = "cutPaper: " + e;
                return false;
            }
        }

        @JavascriptInterface
        public boolean openDrawer() {
            try {
                return printerService != null && printerService.openDrawer() == 0;
            } catch (Exception e) {
                lastBindError = "openDrawer: " + e;
                return false;
            }
        }
    }
}
