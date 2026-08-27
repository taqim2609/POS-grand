package host.emergent.hybridposaceh;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;
import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.InnerResultCallback;
import com.sunmi.peripheral.printer.SunmiPrinterService;

/**
 * MainActivity + bridge printer Sunmi — SDK RESMI Sunmi (com.sunmi:printerlibrary
 * via InnerPrinterManager). Signature semua method memakai InnerResultCallback
 * (async). Ekspos window.SunmiPrinterBridge ke JS.
 */
public class MainActivity extends BridgeActivity {

    private SunmiPrinterService printerService = null;
    private String lastBindError = "";
    private volatile String lastResult = "";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final InnerPrinterCallback innerPrinterCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            printerService = service;
            lastBindError = "";
        }

        @Override
        protected void onDisconnected() {
            printerService = null;
        }
    };

    private final InnerResultCallback resultCallback = new InnerResultCallback() {
        @Override
        public void onRunResult(boolean isSuccess) {
            lastResult = isSuccess ? "OK" : "FAIL";
        }

        @Override
        public void onReturnString(String result) {
            lastResult = result == null ? "" : result;
        }

        @Override
        public void onRaiseException(int code, String msg) {
            lastResult = "EXC(" + code + "):" + msg;
        }

        @Override
        public void onPrintResult(int code, String msg) {
            lastResult = "PRINT(" + code + "):" + msg;
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        initPrinter();
        injectBridge();
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (printerService == null) initPrinter();
                injectBridge();
                mainHandler.postDelayed(this, 3000);
            }
        }, 3000);
    }

    private void initPrinter() {
        try {
            boolean ret = InnerPrinterManager.getInstance().bindService(this, innerPrinterCallback);
            if (!ret) lastBindError = "bindService=false (paket layanan tidak ditemukan)";
        } catch (InnerPrinterException e) {
            lastBindError = "InnerPrinterException: " + e.getMessage();
        } catch (Exception e) {
            lastBindError = e.toString();
        }
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
            StringBuilder pkgs = new StringBuilder();
            String[] names = {"woyou.aidlservice.jiuiv5", "sunmi.peripheral"};
            for (String p : names) {
                boolean installed = false;
                try {
                    getPackageManager().getPackageInfo(p, 0);
                    installed = true;
                } catch (Exception e) { installed = false; }
                pkgs.append(p).append("=").append(installed ? "ADA" : "TIDAK").append("; ");
            }
            return "pkg:" + pkgs + "connected=" + (printerService != null)
                    + (lastBindError.isEmpty() ? "" : " err=" + lastBindError);
        }

        @JavascriptInterface
        public boolean printerInit() {
            try {
                if (printerService == null) return false;
                printerService.printerInit(resultCallback);
                return true;
            } catch (Exception e) { lastBindError = "printerInit: " + e; return false; }
        }

        @JavascriptInterface
        public boolean setAlignment(int alignment) {
            try {
                if (printerService == null) return false;
                printerService.setAlignment(alignment, resultCallback);
                return true;
            } catch (Exception e) { lastBindError = "setAlignment: " + e; return false; }
        }

        @JavascriptInterface
        public boolean printText(String text) {
            try {
                if (printerService == null) return false;
                printerService.printText(text == null ? "" : text, resultCallback);
                return true;
            } catch (Exception e) { lastBindError = "printText: " + e; return false; }
        }

        @JavascriptInterface
        public boolean lineWrap(int n) {
            try {
                if (printerService == null) return false;
                printerService.lineWrap(n, resultCallback);
                return true;
            } catch (Exception e) { lastBindError = "lineWrap: " + e; return false; }
        }

        @JavascriptInterface
        public boolean cutPaper() {
            try {
                if (printerService == null) return false;
                printerService.cutPaper(resultCallback);
                return true;
            } catch (Exception e) { lastBindError = "cutPaper: " + e; return false; }
        }

        @JavascriptInterface
        public boolean printQRCode(String data, int modulesize, int errorlevel) {
            try {
                if (printerService == null) return false;
                printerService.printQRCode(data == null ? "" : data, modulesize, errorlevel, resultCallback);
                return true;
            } catch (Exception e) { lastBindError = "printQRCode: " + e; return false; }
        }

        @JavascriptInterface
        public boolean printBitmap(String dataUrl) {
            try {
                if (printerService == null) return false;
                if (dataUrl == null || dataUrl.isEmpty()) return false;
                // Format: data:image/png;base64,<...>
                int comma = dataUrl.indexOf(',');
                if (comma < 0) return false;
                String b64 = dataUrl.substring(comma + 1);
                byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bmp == null) return false;
                printerService.printBitmap(bmp, resultCallback);
                return true;
            } catch (Exception e) { lastBindError = "printBitmap: " + e; return false; }
        }
    }
}
