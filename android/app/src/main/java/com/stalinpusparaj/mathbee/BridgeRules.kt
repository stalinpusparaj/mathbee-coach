package com.stalinpusparaj.mathbee

/**
 * Pure rules for the web bridge (docs/BUILD_PLAN.md §3.5, §A3 items 17-22), kept free of Android
 * types so they run as plain JVM unit tests. ShellBridge and MainActivity apply them.
 */
object BridgeRules {
    /**
     * FROZEN. The game is served from this origin and path forever: IndexedDB progress is keyed by
     * origin, so changing the host, scheme or the /web/ path would wipe every child's garden.
     * Never switch to file:// or loadDataWithBaseURL. BridgeRulesTest pins these strings.
     */
    const val ORIGIN = "https://appassets.androidplatform.net"
    const val ORIGIN_HOST = "appassets.androidplatform.net"
    const val WEB_PATH = "/web/"
    const val START_URL = "$ORIGIN${WEB_PATH}index.html"

    /** Name of the object the page sees (`window.MathBeeAndroid`). */
    const val JS_OBJECT = "MathBeeAndroid"
    const val PROTOCOL_VERSION = 1

    /** Oldest Android System WebView major version the game supports (ES2020, dvh, WAAPI). */
    const val MIN_WEBVIEW_MAJOR = 111

    const val MAX_SPEAK_CHARS = 600
    const val MAX_ID_CHARS = 40
    const val MAX_JOB_NAME_CHARS = 60
    const val MAX_ROUTE_CHARS = 40
    const val MAX_FILENAME_CHARS = 80
    /** Files travel in pieces of at most this many characters, up to MAX_FILE_CHARS in total (matches shell.ts). */
    const val FILE_CHUNK_CHARS = 512 * 1024
    const val MAX_FILE_CHARS = 20 * 1024 * 1024
    /** A raw message may be bigger than its chunk: JSON escaping can grow text up to 6x (\u0000 form). */
    const val MAX_MESSAGE_CHARS = FILE_CHUNK_CHARS * 6 + 8 * 1024
    const val HAPTIC_GAP_MS = 150L
    const val DEFAULT_FILENAME = "mathbee.json"
    const val DEFAULT_MIME = "application/json"

    /** Every message type the page may send. Anything else is dropped. */
    val WEB_TYPES: Set<String> = setOf(
        "hello", "ready", "route", "speak", "stopSpeaking", "haptic", "keepAwake",
        "saveFile", "shareFile", "print", "installVoice", "exitApp", "flushed",
    )
    val HAPTIC_STYLES: Set<String> = setOf("tap", "success", "celebrate")
    val FILE_PHASES: Set<String> = setOf("begin", "chunk", "end")
    /** Types a parent can save or share. Others become application/json (the progress backup). */
    val FILE_MIMES: Set<String> = setOf("application/json", "text/plain", "text/csv", "text/html")

    /** Only the top frame of our own origin may talk to native. */
    fun isTrustedSource(origin: String?, isMainFrame: Boolean): Boolean =
        isMainFrame && origin != null && origin.trimEnd('/') == ORIGIN

    fun isAllowedType(type: String?): Boolean = type != null && type in WEB_TYPES

    /** Envelope check before any JSON parsing work: size cap; the version is checked after parsing. */
    fun isAcceptableRaw(raw: String?): Boolean = raw != null && raw.isNotEmpty() && raw.length <= MAX_MESSAGE_CHARS

    /** Missing version is tolerated (old pages); any other version is from a different protocol. */
    fun isSupportedVersion(v: Int?): Boolean = v == null || v == PROTOCOL_VERSION

    /** The WebView may only ever show our bundled pages. */
    fun isAllowedNavigation(scheme: String?, host: String?): Boolean =
        scheme == "https" && host == ORIGIN_HOST

    /** The asset loader serves only /web/ (and below) from our origin (never other APK assets). */
    fun isServedPath(host: String?, path: String?): Boolean {
        if (host != ORIGIN_HOST || path == null || !path.startsWith(WEB_PATH)) return false
        return path.split('/').none { it == ".." || it == "." }
    }

    /** `[A-Za-z0-9._-]{1,80}`, no leading dots; anything unusable becomes mathbee.json. */
    fun sanitizeFilename(raw: String?): String {
        val cleaned = (raw ?: "").replace(Regex("[^A-Za-z0-9._-]"), "_").trimStart('.').take(MAX_FILENAME_CHARS)
        return if (cleaned.isEmpty() || cleaned.all { it == '_' || it == '.' }) DEFAULT_FILENAME else cleaned
    }

    fun normalizeMime(raw: String?): String {
        val m = raw?.substringBefore(';')?.trim()?.lowercase()
        return if (m != null && m in FILE_MIMES) m else DEFAULT_MIME
    }

    fun clampText(s: String?, max: Int): String = (s ?: "").take(max)

    /** Speech rate 0.5-1.5 (web speech units, 1 = normal); garbage means the game's default 0.9. */
    fun clampRate(rate: Double?): Double = if (rate == null || rate.isNaN()) 0.9 else rate.coerceIn(0.5, 1.5)

    fun normalizeLang(lang: String?): String = if (lang == "ta") "ta" else "en"

    fun isHapticStyle(style: String?): Boolean = style != null && style in HAPTIC_STYLES

    /** Rate limit for haptics: at most one per HAPTIC_GAP_MS. */
    fun hapticAllowed(lastAtMs: Long, nowMs: Long): Boolean = nowMs - lastAtMs >= HAPTIC_GAP_MS

    /** Major version from a WebView versionName such as "124.0.6367.82"; null when unreadable. */
    fun webViewMajor(versionName: String?): Int? =
        versionName?.trim()?.substringBefore('.')?.toIntOrNull()?.takeIf { it > 0 }

    fun isWebViewSupported(versionName: String?): Boolean = (webViewMajor(versionName) ?: 0) >= MIN_WEBVIEW_MAJOR

    /** Number of pieces a file of `size` characters must arrive in (same formula as shell.ts). */
    fun expectedChunks(size: Int): Int = maxOf(1, (size + FILE_CHUNK_CHARS - 1) / FILE_CHUNK_CHARS)

    /** A `begin` is acceptable when the size fits and the piece count matches it. */
    fun isValidBegin(size: Int, chunks: Int): Boolean =
        size in 0..MAX_FILE_CHARS && chunks == expectedChunks(size)

    /**
     * Tracks one chunked transfer (`begin` → `chunk`* → `end`). Pieces must come in order, each at
     * most FILE_CHUNK_CHARS, never beyond the announced size; `end` is complete only when every
     * piece and every character arrived.
     */
    class ChunkTracker(val size: Int, val chunks: Int) {
        var received = 0; private set
        var chars = 0; private set
        var failed = false; private set

        fun accept(index: Int, length: Int): Boolean {
            val ok = !failed && index == received && index < chunks && length in 0..FILE_CHUNK_CHARS && chars + length <= size
            if (!ok) { failed = true; return false }
            received++
            chars += length
            return true
        }

        fun isComplete(): Boolean = !failed && received == chunks && chars == size
    }

    /**
     * Renderer crash recovery: recreate the WebView at most MAX_RECREATES times inside
     * CRASH_WINDOW_MS; after that a native "Try again" cover shows instead (the same page may
     * crash again straight away).
     */
    const val MAX_RECREATES = 2
    const val CRASH_WINDOW_MS = 60_000L

    /** Returns the crash times still inside the window, including `now`. */
    fun recentCrashes(previous: List<Long>, now: Long): List<Long> =
        previous.filter { now - it < CRASH_WINDOW_MS } + now

    fun shouldRecreate(recent: List<Long>): Boolean = recent.size <= MAX_RECREATES
}
