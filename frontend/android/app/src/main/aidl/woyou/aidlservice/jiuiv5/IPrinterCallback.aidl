package woyou.aidlservice.jiuiv5;

interface IPrinterCallback {
    void onRunResult(boolean isSuccess);
    void onReturnString(String result);
    void onRaiseException(int code, String msg);
}
