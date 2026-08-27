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
 * Aplikasi Capacitor memakai WebView standar Android yang TIDAK menyediakan
 * window.SunmiInnerPrinter (hanya ada di WebView bawaan Sunmi). Agar cetak thermal
 * Sunmi T2 jalan dari dalam APK, kita bind ke layanan AIDL Sunmi
 * (woyou.aidlservice.jiuiv5) dan ekspos ke JavaScript sebagai window.SunmiPrinterBridge.
 *
 * Metode yang dipakai (semua sinkron, return int 0=sukses):
 *   printerInit(), setAlignment(int), printText(String), lineWrap(int),
 *   cutPaper(), openDrawer()
 */
public class MainActivity extends BridgeActivity {

    private IPrinterService printerService = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final ServiceConnection conn = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerService = IPrinterService.Stub.asInterface(service);
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerService = null;
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Bind layanan printer Sunmi (T2/T2+/T1, dsb.)
        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5");
            bindService(intent, conn, Context.BIND_AUTO_CREATE);
        } catch (Exception ignored) {
        }
        // Ekspos bridge ke JS
        try {
            getBridge().getWebView().addJavascriptInterface(new SunmiBridge(), "SunmiPrinterBridge");
        } catch (Exception ignored) {
        }
    }

    public class SunmiBridge {
        @JavascriptInterface
        public boolean printerInit() {
            try {
                return printerService != null && printerService.printerInit() == 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean setAlignment(int alignment) {
            try {
                return printerService != null && printerService.setAlignment(alignment) == 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean printText(String text) {
            try {
                return printerService != null && printerService.printText(text == null ? "" : text) == 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean lineWrap(int n) {
            try {
                return printerService != null && printerService.lineWrap(n) == 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean cutPaper() {
            try {
                return printerService != null && printerService.cutPaper(1) == 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean openDrawer() {
            try {
                return printerService != null && printerService.openDrawer() == 0;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
