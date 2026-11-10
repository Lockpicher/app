package com.kubbonet.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private String pendingSharedText = null;
    private String pendingSharedTitle = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleSendIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSendIntent(intent);
    }

    private void handleSendIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if ("text/plain".equals(type) || type.startsWith("text/")) {
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
                if (text != null && !text.trim().isEmpty()) {
                    pendingSharedText = text;
                    pendingSharedTitle = subject != null ? subject : "";
                    scheduleDelivery();
                }
            }
        }
    }

    private void scheduleDelivery() {
        if (pendingSharedText == null) return;

        int[] delays = { 600, 1500, 3000 };
        for (int delay : delays) {
            getWindow().getDecorView().postDelayed(new Runnable() {
                @Override
                public void run() {
                    deliverSharedContent();
                }
            }, delay);
        }
    }

    private void deliverSharedContent() {
        if (pendingSharedText == null) return;
        if (getBridge() == null || getBridge().getWebView() == null) return;

        WebView webView = getBridge().getWebView();
        final String text = pendingSharedText;
        final String title = pendingSharedTitle != null ? pendingSharedTitle : "";

        String jsonText = JSONObject.quote(text);
        String jsonTitle = JSONObject.quote(title);

        final String script = String.format(
            "(function() {" +
            "  window.__PENDING_SHARED_CONTENT__ = { text: %s, title: %s };" +
            "  window.dispatchEvent(new CustomEvent('appShareReceived', { detail: { text: %s, title: %s } }));" +
            "})();",
            jsonText, jsonTitle, jsonText, jsonTitle
        );

        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(script, null);
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        scheduleDelivery();
    }
}
