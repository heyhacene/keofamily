package fr.otsmane.dar;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "DarMainActivity";
    private String pendingICSContent = null;
    private String pendingICSFileName = "rendez-vous.ics";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        Log.d(TAG, "Incoming intent action: " + action + ", type: " + intent.getType() + ", data: " + intent.getData());

        // 1. Insertion ou édition de rendez-vous (Doctolib, applications de réservation, agenda)
        if (Intent.ACTION_INSERT.equals(action) || Intent.ACTION_EDIT.equals(action)) {
            handleCalendarInsertIntent(intent);
            return;
        }

        // 2. Ouverture de fichier ou lien calendrier (ACTION_VIEW)
        if (Intent.ACTION_VIEW.equals(action)) {
            handleCalendarViewIntent(intent);
            return;
        }

        // 3. Partage de fichier vers Dar (ACTION_SEND)
        if (Intent.ACTION_SEND.equals(action)) {
            handleCalendarSendIntent(intent);
            return;
        }
    }

    private void handleCalendarInsertIntent(Intent intent) {
        Bundle extras = intent.getExtras();
        if (extras == null) extras = new Bundle();

        // Récupérer le titre
        String title = extras.getString("title");
        if (title == null || title.trim().isEmpty()) {
            title = extras.getString(Intent.EXTRA_TITLE);
        }
        if (title == null || title.trim().isEmpty()) {
            title = "Rendez-vous Doctolib";
        }

        // Récupérer la description et le lieu
        String description = extras.getString("description");
        if (description == null) description = "";
        String location = extras.getString("eventLocation");
        if (location == null) location = extras.getString("location");
        if (location != null && !location.trim().isEmpty()) {
            if (!description.isEmpty()) description += "\nLieu: " + location;
            else description = "Lieu: " + location;
        }

        // Dates et heures (millisecondes)
        long beginTime = extras.getLong("beginTime", 0);
        if (beginTime == 0) {
            beginTime = extras.getLong("android.intent.extra.START_DATE", 0);
        }
        long endTime = extras.getLong("endTime", 0);
        if (endTime == 0) {
            endTime = extras.getLong("android.intent.extra.END_DATE", 0);
        }

        if (beginTime == 0) {
            beginTime = System.currentTimeMillis();
        }
        if (endTime == 0 || endTime <= beginTime) {
            endTime = beginTime + (60 * 60 * 1000); // 1 heure par défaut
        }

        boolean allDay = extras.getBoolean("allDay", false);

        SimpleDateFormat icsUtcFormat = new SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", Locale.US);
        icsUtcFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
        SimpleDateFormat icsDayFormat = new SimpleDateFormat("yyyyMMdd", Locale.US);

        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\n");
        sb.append("VERSION:2.0\n");
        sb.append("PRODID:-//Dar Family Agenda//FR\n");
        sb.append("CALSCALE:GREGORIAN\n");
        sb.append("BEGIN:VEVENT\n");
        sb.append("UID:").append(UUID.randomUUID().toString()).append("@dar.otsmane.fr\n");
        sb.append("DTSTAMP:").append(icsUtcFormat.format(new Date())).append("\n");

        if (allDay) {
            sb.append("DTSTART;VALUE=DATE:").append(icsDayFormat.format(new Date(beginTime))).append("\n");
            sb.append("DTEND;VALUE=DATE:").append(icsDayFormat.format(new Date(endTime))).append("\n");
        } else {
            sb.append("DTSTART:").append(icsUtcFormat.format(new Date(beginTime))).append("\n");
            sb.append("DTEND:").append(icsUtcFormat.format(new Date(endTime))).append("\n");
        }

        sb.append("SUMMARY:").append(escapeIcsText(title)).append("\n");
        if (!description.isEmpty()) {
            sb.append("DESCRIPTION:").append(escapeIcsText(description)).append("\n");
        }
        if (location != null && !location.trim().isEmpty()) {
            sb.append("LOCATION:").append(escapeIcsText(location)).append("\n");
        }
        sb.append("END:VEVENT\n");
        sb.append("END:VCALENDAR\n");

        pendingICSContent = sb.toString();
        pendingICSFileName = title.replaceAll("[^a-zA-Z0-9.-]", "_") + ".ics";
        dispatchICSToWebView();
    }

    private String pendingKeoNoteB64 = null;
    private String pendingKeoNoteSubject = null;
    private String pendingKeoNoteRawText = null;

    private void handleCalendarViewIntent(Intent intent) {
        Uri uri = intent.getData();
        if (uri != null) {
            String importParam = uri.getQueryParameter("keonote_import");
            if (importParam != null && !importParam.isEmpty()) {
                pendingKeoNoteB64 = importParam;
                pendingKeoNoteSubject = null;
                pendingKeoNoteRawText = null;
                scheduleKeoNoteImportDispatches();
                return;
            }
            readIcsFromUri(uri);
        } else {
            handleCalendarInsertIntent(intent);
        }
    }

    private void handleCalendarSendIntent(Intent intent) {
        Uri streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (streamUri != null) {
            readIcsFromUri(streamUri);
        } else {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (text != null) {
                if (text.contains("BEGIN:VCALENDAR") || text.contains("BEGIN:VEVENT")) {
                    pendingICSContent = text;
                    pendingICSFileName = "rendez-vous.ics";
                    dispatchICSToWebView();
                } else {
                    pendingKeoNoteB64 = null;
                    pendingKeoNoteSubject = subject;
                    pendingKeoNoteRawText = text;
                    scheduleKeoNoteImportDispatches();
                }
            }
        }
    }

    private void scheduleKeoNoteImportDispatches() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        int[] delays = new int[] { 0, 800, 1800, 3200 };
        for (int delay : delays) {
            webView.postDelayed(new Runnable() {
                @Override
                public void run() {
                    dispatchKeoNoteImportToWebView();
                }
            }, delay);
        }
    }

    private void dispatchKeoNoteImportToWebView() {
        if (pendingKeoNoteB64 == null && pendingKeoNoteRawText == null) return;
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        final String b64Payload = pendingKeoNoteB64;
        final String subject = pendingKeoNoteSubject;
        final String rawText = pendingKeoNoteRawText;

        try {
            String quotedB64 = b64Payload != null ? JSONObject.quote(b64Payload) : "null";
            String quotedSubj = subject != null ? JSONObject.quote(subject) : "null";
            String quotedText = rawText != null ? JSONObject.quote(rawText) : "null";

            String js = "(function() {" +
                "  try {" +
                "    if (!window.location || window.location.href === 'about:blank') return 'not_ready';" +
                "    var b64 = " + quotedB64 + ";" +
                "    var subj = " + quotedSubj + ";" +
                "    var raw = " + quotedText + ";" +
                "    if (b64) {" +
                "      sessionStorage.setItem('dar_pending_keonote_import', b64);" +
                "      localStorage.setItem('dar_pending_keonote_import', b64);" +
                "    } else if (raw) {" +
                "      var rawJson = JSON.stringify({ title: subj, rawText: raw });" +
                "      sessionStorage.setItem('dar_pending_keonote_raw', rawJson);" +
                "      localStorage.setItem('dar_pending_keonote_raw', rawJson);" +
                "    }" +
                "    window.dispatchEvent(new CustomEvent('dar:keonote-import', { detail: { b64: b64, title: subj, rawText: raw } }));" +
                "    return 'ok';" +
                "  } catch(e) { return 'err'; }" +
                "})();";

            webView.evaluateJavascript(js, new android.webkit.ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    if (value != null && value.contains("ok")) {
                        pendingKeoNoteB64 = null;
                        pendingKeoNoteSubject = null;
                        pendingKeoNoteRawText = null;
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Erreur evaluateJavascript pour KeoNote import", e);
        }
    }

    private void readIcsFromUri(Uri uri) {
        Log.d(TAG, "Incoming URI for calendar/ICS: " + uri);
        try {
            InputStream is = getContentResolver().openInputStream(uri);
            if (is != null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append("\n");
                }
                is.close();

                String content = sb.toString();
                if (content.contains("BEGIN:VCALENDAR") || content.contains("BEGIN:VEVENT")) {
                    pendingICSContent = content;
                    String segment = uri.getLastPathSegment();
                    if (segment != null && !segment.isEmpty()) {
                        pendingICSFileName = segment;
                    }
                    dispatchICSToWebView();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur lecture fichier ICS depuis intent Android", e);
        }
    }

    private String escapeIcsText(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                   .replace(";", "\\;")
                   .replace(",", "\\,")
                   .replace("\n", "\\n")
                   .replace("\r", "");
    }

    private void dispatchICSToWebView() {
        if (pendingICSContent == null) return;

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        final String content = pendingICSContent;
        final String fileName = pendingICSFileName;

        webView.post(new Runnable() {
            @Override
            public void run() {
                try {
                    String quotedContent = JSONObject.quote(content);
                    String quotedName = JSONObject.quote(fileName);

                    String js = "(function() {" +
                        "  try {" +
                        "    var text = " + quotedContent + ";" +
                        "    var name = " + quotedName + ";" +
                        "    sessionStorage.setItem('dar_pending_ics_content', text);" +
                        "    sessionStorage.setItem('dar_pending_ics_name', name);" +
                        "    window.dispatchEvent(new CustomEvent('dar:open-ics', { detail: { content: text, name: name } }));" +
                        "    if (window.location.pathname !== '/agenda') {" +
                        "      window.location.href = '/agenda?import_ics=1';" +
                        "    }" +
                        "  } catch(e) { console.error('Erreur dispatch ICS frontend:', e); }" +
                        "})();";

                    webView.evaluateJavascript(js, null);
                    pendingICSContent = null;
                } catch (Exception e) {
                    Log.e(TAG, "Erreur evaluateJavascript pour ICS", e);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingICSContent != null) {
            dispatchICSToWebView();
        }
        if (pendingKeoNoteB64 != null || pendingKeoNoteRawText != null) {
            scheduleKeoNoteImportDispatches();
        }
    }
}
