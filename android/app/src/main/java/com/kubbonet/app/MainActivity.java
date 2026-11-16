package com.kubbonet.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
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
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }

        String text = null;
        String title = null;

        // 1. EXTRA_TEXT (String or CharSequence)
        CharSequence csText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (csText != null && csText.length() > 0) {
            text = csText.toString();
        }

        // 2. EXTRA_SUBJECT or EXTRA_TITLE
        CharSequence csSubject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        if (csSubject != null && csSubject.length() > 0) {
            title = csSubject.toString();
        } else {
            CharSequence csTitle = intent.getCharSequenceExtra(Intent.EXTRA_TITLE);
            if (csTitle != null && csTitle.length() > 0) {
                title = csTitle.toString();
            }
        }

        // 3. ClipData (Android 10+ share target item)
        if (text == null && intent.getClipData() != null) {
            ClipData clipData = intent.getClipData();
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < clipData.getItemCount(); i++) {
                ClipData.Item item = clipData.getItemAt(i);
                if (item.getText() != null) {
                    if (sb.length() > 0) sb.append("\n");
                    sb.append(item.getText());
                } else if (item.getUri() != null) {
                    if (sb.length() > 0) sb.append("\n");
                    sb.append(item.getUri().toString());
                }
            }
            if (sb.length() > 0) {
                text = sb.toString();
            }
        }

        // 4. ACTION_SEND_MULTIPLE list
        if (text == null && Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<CharSequence> list = intent.getCharSequenceArrayListExtra(Intent.EXTRA_TEXT);
            if (list != null && !list.isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (CharSequence item : list) {
                    if (item != null) {
                        if (sb.length() > 0) sb.append("\n");
                        sb.append(item);
                    }
                }
                if (sb.length() > 0) {
                    text = sb.toString();
                }
            }
        }

        // 5. Intent Data URI (direct URI sharing)
        if (text == null && intent.getData() != null) {
            text = intent.getData().toString();
        }

        // 6. EXTRA_STREAM (if text is still null but stream URI is present)
        if (text == null) {
            try {
                Uri streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (streamUri != null) {
                    text = streamUri.toString();
                }
            } catch (Exception ignored) {}
        }

        if (text != null && !text.trim().isEmpty()) {
            pendingSharedText = text.trim();
            pendingSharedTitle = title != null ? title.trim() : "";
            scheduleDelivery();
        }
    }

    private void scheduleDelivery() {
        if (pendingSharedText == null) return;

        // Progressive retries to ensure WebView and React are fully loaded
        int[] delays = { 300, 800, 1500, 3000 };
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
            "  var payload = { text: %s, title: %s };" +
            "  window.__PENDING_SHARED_CONTENT__ = payload;" +
            "  if (typeof window.__handleIncomingShare === 'function') {" +
            "    window.__handleIncomingShare(payload);" +
            "  } else {" +
            "    window.dispatchEvent(new CustomEvent('appShareReceived', { detail: payload }));" +
            "  }" +
            "})();",
            jsonText, jsonTitle
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
