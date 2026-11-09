package com.conacash.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        limparCacheAntigoWebView();
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.clearCache(true);
            WebSettings settings = webView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        }
    }

    private void limparCacheAntigoWebView() {
        try {
            File dataDir = new File(getApplicationInfo().dataDir);
            File webViewDir = new File(dataDir, "app_webview");
            if (webViewDir.exists()) {
                excluirPastaRecursivo(new File(webViewDir, "Default/Service Worker"));
                excluirPastaRecursivo(new File(webViewDir, "Default/Cache"));
                excluirPastaRecursivo(new File(webViewDir, "Default/Code Cache"));
                excluirPastaRecursivo(new File(webViewDir, "Service Worker"));
                excluirPastaRecursivo(new File(webViewDir, "Cache"));
                excluirPastaRecursivo(new File(webViewDir, "Code Cache"));
            }
            if (getCacheDir() != null) {
                excluirPastaRecursivo(getCacheDir());
            }
        } catch (Exception ignored) {
        }
    }

    private void excluirPastaRecursivo(File arquivoOuPasta) {
        if (arquivoOuPasta == null || !arquivoOuPasta.exists()) {
            return;
        }
        if (arquivoOuPasta.isDirectory()) {
            File[] filhos = arquivoOuPasta.listFiles();
            if (filhos != null) {
                for (File filho : filhos) {
                    excluirPastaRecursivo(filho);
                }
            }
        }
        arquivoOuPasta.delete();
    }
}
