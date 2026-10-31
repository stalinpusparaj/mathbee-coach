package com.stalinpusparaj.mathbee

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.util.Log
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.core.content.FileProvider
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File
import java.io.Writer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Native side of the `MathBeeAndroid` bridge (docs/BUILD_PLAN.md §3.5; web side: src/app/shell.ts).
 *
 * One JSON string per message, `{ v: 1, type, ...payload }`, both directions. The page gets the
 * object through `WebViewCompat.addWebMessageListener`, restricted to our origin; every message
 * is checked again here (main frame, exact origin, size, version, whitelisted type) and every
 * field is clamped by BridgeRules. Strings from the page are never executed.
 *
 * Native → web messages wait in a small queue until the page has said `hello` and received the
 * `shell` reply, so nothing sent during start-up (insets, voices, lifecycle) is lost.
 */
class ShellBridge(private val activity: ComponentActivity, private val host: Host) {
    /** What the bridge needs from the activity. All calls happen on the main thread. */
    interface Host {
        fun onWebReady()
        fun setBackEnabled(enabled: Boolean)
        fun setKeepAwake(on: Boolean)
        /** Opens the system "save as" picker; the result comes back through [onSaveTarget]. False when no picker exists. */
        fun pickSaveTarget(filename: String, mime: String): Boolean
        fun print(jobName: String): Boolean
        fun haptic(style: String)
        fun onFlushed()
        fun exitApp()
    }

    private val main = Handler(Looper.getMainLooper())
    /** File work (up to 20 MB) runs here, in order, off the main thread. */
    private val io: ExecutorService = Executors.newSingleThreadExecutor()
    private var proxy: JavaScriptReplyProxy? = null
    private var connected = false
    private var helloSeq = 0
    private val queue = ArrayDeque<String>()
    private var startScript: ScriptHandler? = null
    private var insets = Insets(0, 0, 0, 0)
    private var lastHaptic = Long.MIN_VALUE / 2
    private var transfer: Transfer? = null
    private var pendingSave: Transfer? = null
    private var transferSeq = 0

    val speech = Speech(
        activity,
        onEvent = { id, state -> emit("speech", JSONObject().put("id", id).put("state", state)) },
        onVoices = { en, ta -> emit("voices", JSONObject().put("voices", voicesJson(en, ta))) },
    )

    private data class Insets(val top: Int, val right: Int, val bottom: Int, val left: Int) {
        fun json(): JSONObject = JSONObject().put("top", top).put("right", right).put("bottom", bottom).put("left", left)
    }

    private class Transfer(
        val kind: String,
        val reqId: String,
        val filename: String,
        val mime: String,
        val tracker: BridgeRules.ChunkTracker,
        val file: File,
        var writer: Writer?,
    )

    init {
        // leftovers from an earlier run (the share target has long finished with them)
        io.execute { cleanExports(maxAgeMs = 60 * 60 * 1000L) }
    }

    // ---------------------------------------------------------------- wiring

    /** Registers the document-start script and the message listener on a fresh WebView (before loadUrl). */
    fun attach(view: WebView) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            startScript = WebViewCompat.addDocumentStartJavaScript(view, documentStartScript(), setOf(BridgeRules.ORIGIN))
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(view, BridgeRules.JS_OBJECT, setOf(BridgeRules.ORIGIN)) { _, message, origin, isMainFrame, reply ->
            onMessage(message.data, origin, isMainFrame, reply)
        }
    }

    /** The page is gone (renderer crash or a new WebView): forget the old reply channel. */
    fun reset() {
        transfer?.let { fail(it) }
        transfer = null
        proxy = null
        connected = false
        queue.clear()                                                  // nothing queued belongs to the next page
        startScript = null
        speech.stop()
    }

    fun shutdown() {
        speech.shutdown()
        main.removeCallbacksAndMessages(null)
        io.shutdown()
    }

    /** `window.__MATHBEE_SHELL__` before any page script runs, and reduce-motion when the system turned animations off. */
    private fun documentStartScript(): String {
        val animScale = animatorScale()
        val info = JSONObject()
            .put("platform", "android")
            .put("versionName", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("sdk", Build.VERSION.SDK_INT)
            .put("lowRam", isLowRam())
            .put("animScale", animScale.toDouble())
        val reduce = if (animScale == 0f) {
            "var a=function(){var d=document.documentElement;if(d)d.classList.add('reduce-motion')};" +
                "if(document.documentElement)a();else document.addEventListener('DOMContentLoaded',a);"
        } else ""
        return "(function(){window.__MATHBEE_SHELL__=$info;$reduce})();"
    }

    private fun animatorScale(): Float =
        runCatching { Settings.Global.getFloat(activity.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) }.getOrDefault(1f)

    /** Low-end devices get the 2D map and lighter effects (`lowRam` in the web shell info). */
    private fun isLowRam(): Boolean {
        val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return am.isLowRamDevice || am.memoryClass <= 192
    }

    // ---------------------------------------------------------------- web → native

    private fun onMessage(raw: String?, origin: Uri, isMainFrame: Boolean, reply: JavaScriptReplyProxy) {
        if (!BridgeRules.isTrustedSource(origin.toString(), isMainFrame)) return reject("origin $origin main=$isMainFrame")
        if (!BridgeRules.isAcceptableRaw(raw)) return reject("size")
        val m = runCatching { JSONObject(raw!!) }.getOrNull() ?: return reject("json")
        val v = if (m.has("v")) m.optInt("v", -1) else null
        if (!BridgeRules.isSupportedVersion(v)) return reject("version $v")
        val type = m.optString("type")
        if (!BridgeRules.isAllowedType(type)) return reject("type $type")
        proxy = reply
        when (type) {
            "hello" -> onHello()
            "ready" -> host.onWebReady()
            "route" -> host.setBackEnabled(m.optBoolean("canGoBack", false))
            "speak" -> speech.speak(
                BridgeRules.clampText(m.optString("id"), BridgeRules.MAX_ID_CHARS),
                BridgeRules.clampText(m.optString("text"), BridgeRules.MAX_SPEAK_CHARS),
                BridgeRules.normalizeLang(m.optString("lang")),
                BridgeRules.clampRate(m.optDouble("rate")),
            )
            "stopSpeaking" -> speech.stop()
            "haptic" -> haptic(m.optString("style"))
            "keepAwake" -> host.setKeepAwake(m.optBoolean("on", false))
            "saveFile", "shareFile" -> onFile(type, m)
            "print" -> {
                val reqId = BridgeRules.clampText(m.optString("reqId"), BridgeRules.MAX_ID_CHARS)
                val job = BridgeRules.clampText(m.optString("jobName").ifBlank { activity.getString(R.string.print_job) }, BridgeRules.MAX_JOB_NAME_CHARS)
                result(reqId, if (runCatching { host.print(job) }.getOrDefault(false)) "printed" else "error")
            }
            "installVoice" -> installVoice()
            "exitApp" -> host.exitApp()
            "flushed" -> host.onFlushed()
        }
    }

    private fun reject(reason: String) {
        if (BuildConfig.DEBUG) Log.w(TAG, "bridge message dropped: $reason")
    }

    /**
     * `hello` → `shell` (version, device facts, insets, voices) once the TTS engine has started, so
     * the first narrated screen already knows its voices; at most ~900 ms, inside the web side's
     * 1500 ms wait. Then everything queued meanwhile is delivered.
     */
    private fun onHello() {
        connected = false
        val seq = ++helloSeq
        var sent = false
        val replyNow = {
            if (!sent && seq == helloSeq) {
                sent = true
                post(shellInfo().toString())
                connected = true
                while (queue.isNotEmpty()) post(queue.removeFirst())
            }
        }
        speech.whenInitialised { replyNow() }
        main.postDelayed(replyNow, HELLO_WAIT_MS)
    }

    private fun shellInfo(): JSONObject {
        val (en, ta) = speech.voicesNow()
        return envelope("shell")
            .put("platform", "android")
            .put("versionName", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("sdk", Build.VERSION.SDK_INT)
            .put("lowRam", isLowRam())
            .put("animScale", animatorScale().toDouble())
            .put("insets", insets.json())
            .put("voices", voicesJson(en, ta))
    }

    private fun voicesJson(en: Boolean, ta: Boolean) = JSONObject().put("en", en).put("ta", ta)

    /** Gentle and rate-limited. The web side never asks for one on a wrong answer. */
    private fun haptic(style: String) {
        if (!BridgeRules.isHapticStyle(style)) return
        val now = SystemClock.uptimeMillis()
        if (!BridgeRules.hapticAllowed(lastHaptic, now)) return
        lastHaptic = now
        host.haptic(style)
    }

    /** Parent area only (behind the gate): opens the system text-to-speech data installer. */
    private fun installVoice() {
        try {
            activity.startActivity(Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            reject("no TTS installer")
        }
    }

    // ---------------------------------------------------------------- files (save / share)

    /** `begin` (name, type, size, piece count) → `chunk` (index, data) … → `end`; one `result` per request. */
    private fun onFile(kind: String, m: JSONObject) {
        val reqId = BridgeRules.clampText(m.optString("reqId"), BridgeRules.MAX_ID_CHARS)
        when (m.optString("phase")) {
            "begin" -> {
                transfer?.let { fail(it) }
                transfer = null
                val size = m.optInt("size", -1)
                val chunks = m.optInt("chunks", -1)
                if (!BridgeRules.isValidBegin(size, chunks)) return result(reqId, "error")
                val file = File(exportsDir(), ".part-${++transferSeq}")
                val t = Transfer(kind, reqId, BridgeRules.sanitizeFilename(m.optString("filename")),
                    BridgeRules.normalizeMime(m.optString("mime")), BridgeRules.ChunkTracker(size, chunks), file, null)
                transfer = t
                io.execute { t.writer = runCatching { file.parentFile?.mkdirs(); file.bufferedWriter(Charsets.UTF_8) }.getOrNull() }
            }
            "chunk" -> {
                val t = transfer?.takeIf { it.reqId == reqId && it.kind == kind } ?: return
                val data = m.optString("data")
                if (!t.tracker.accept(m.optInt("index", -1), data.length)) { transfer = null; return fail(t) }
                io.execute { runCatching { t.writer!!.write(data) }.onFailure { t.writer = null } }
            }
            "end" -> {
                val t = transfer?.takeIf { it.reqId == reqId && it.kind == kind } ?: return
                transfer = null
                if (!t.tracker.isComplete()) return fail(t)
                io.execute {
                    val ok = runCatching { t.writer!!.close() }.isSuccess
                    t.writer = null
                    main.post { if (!ok) fail(t) else if (t.kind == "saveFile") askWhereToSave(t) else share(t) }
                }
            }
        }
    }

    private fun askWhereToSave(t: Transfer) {
        pendingSave?.let { fail(it) }
        pendingSave = t
        if (!host.pickSaveTarget(t.filename, t.mime)) { pendingSave = null; fail(t) }
    }

    /** The parent picked a place in the system "save as" dialog (null = they backed out). */
    fun onSaveTarget(uri: Uri?) {
        val t = pendingSave ?: return
        pendingSave = null
        if (uri == null) { io.execute { t.file.delete() }; return result(t.reqId, "cancelled") }
        io.execute {
            val ok = runCatching {
                activity.contentResolver.openOutputStream(uri, "wt")!!.use { out -> t.file.inputStream().use { it.copyTo(out) } }
            }.isSuccess
            t.file.delete()
            main.post { result(t.reqId, if (ok) "saved" else "error") }
        }
    }

    /** cache/exports/<name> through our FileProvider, then the system share sheet. */
    private fun share(t: Transfer) {
        io.execute {
            val target = File(exportsDir(), t.filename)
            val ok = runCatching { target.delete(); check(t.file.renameTo(target)) }.isSuccess
            main.post {
                if (!ok) { io.execute { t.file.delete() }; return@post result(t.reqId, "error") }
                val shared = runCatching {
                    val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.files", target)
                    val send = Intent(Intent.ACTION_SEND)
                        .setType(t.mime)
                        .putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    send.clipData = ClipData.newRawUri(t.filename, uri)
                    activity.startActivity(Intent.createChooser(send, activity.getString(R.string.share_title)))
                }.isSuccess
                result(t.reqId, if (shared) "shared" else "error")
            }
        }
    }

    private fun fail(t: Transfer) {
        io.execute {
            runCatching { t.writer?.close() }
            t.writer = null
            t.file.delete()
        }
        result(t.reqId, "error")
    }

    private fun exportsDir() = File(activity.cacheDir, "exports")

    private fun cleanExports(maxAgeMs: Long) {
        val now = System.currentTimeMillis()
        exportsDir().listFiles()?.forEach { f -> if (f.name.startsWith(".part-") || now - f.lastModified() > maxAgeMs) f.delete() }
    }

    // ---------------------------------------------------------------- native → web

    /** Insets in CSS px (the web side sets --shell-inset-*). Sent only when they change. */
    fun sendInsets(top: Int, right: Int, bottom: Int, left: Int) {
        val next = Insets(top, right, bottom, left)
        if (next == insets) return
        insets = next
        emit("insets", JSONObject().put("insets", next.json()))
    }

    fun sendLifecycle(state: String) = emit("lifecycle", JSONObject().put("state", state))

    fun sendBack() = emit("back", JSONObject())

    private fun result(reqId: String, status: String) = emit("result", JSONObject().put("reqId", reqId).put("status", status))

    private fun envelope(type: String) = JSONObject().put("v", BridgeRules.PROTOCOL_VERSION).put("type", type)

    /** Sends (or queues until `hello`) one message; safe from any thread. */
    fun emit(type: String, payload: JSONObject) {
        if (Looper.myLooper() != Looper.getMainLooper()) { main.post { emit(type, payload) }; return }
        payload.put("v", BridgeRules.PROTOCOL_VERSION).put("type", type)
        val json = payload.toString()
        if (connected && proxy != null) post(json)
        else {
            if (queue.size >= MAX_QUEUE) queue.removeFirst()
            queue.addLast(json)
        }
    }

    /** A reply proxy only exists once the WEB_MESSAGE_LISTENER feature was used, so no feature check here. */
    @SuppressLint("RequiresFeature")
    private fun post(json: String) {
        runCatching { proxy?.postMessage(json) }.onFailure { reject("post failed: ${it.message}") }
    }

    companion object {
        private const val TAG = "MathBeeShell"
        private const val HELLO_WAIT_MS = 900L
        private const val MAX_QUEUE = 64
    }
}
