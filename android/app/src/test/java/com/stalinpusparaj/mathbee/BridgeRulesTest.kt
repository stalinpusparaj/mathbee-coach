package com.stalinpusparaj.mathbee

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeRulesTest {
    @Test fun startUrlIsFrozen() {
        // Changing any of these loses every child's saved garden (IndexedDB is keyed by origin).
        assertEquals("https://appassets.androidplatform.net", BridgeRules.ORIGIN)
        assertEquals("https://appassets.androidplatform.net/web/index.html", BridgeRules.START_URL)
        assertEquals("MathBeeAndroid", BridgeRules.JS_OBJECT)
    }

    @Test fun onlyMainFrameOfOurOriginIsTrusted() {
        assertTrue(BridgeRules.isTrustedSource("https://appassets.androidplatform.net", true))
        assertTrue(BridgeRules.isTrustedSource("https://appassets.androidplatform.net/", true))
        assertFalse(BridgeRules.isTrustedSource("https://appassets.androidplatform.net", false))
        assertFalse(BridgeRules.isTrustedSource("http://appassets.androidplatform.net", true))
        assertFalse(BridgeRules.isTrustedSource("https://appassets.androidplatform.net.evil.com", true))
        assertFalse(BridgeRules.isTrustedSource("https://example.com", true))
        assertFalse(BridgeRules.isTrustedSource("null", true))
        assertFalse(BridgeRules.isTrustedSource(null, true))
    }

    @Test fun typeWhitelist() {
        listOf("hello", "ready", "route", "speak", "stopSpeaking", "haptic", "keepAwake", "saveFile",
            "shareFile", "print", "installVoice", "exitApp", "flushed").forEach { assertTrue(it, BridgeRules.isAllowedType(it)) }
        listOf(null, "", "eval", "loadUrl", "HELLO", "shell", "back", "result").forEach { assertFalse("$it", BridgeRules.isAllowedType(it)) }
    }

    @Test fun versionAndSize() {
        assertTrue(BridgeRules.isSupportedVersion(1))
        assertTrue(BridgeRules.isSupportedVersion(null))
        assertFalse(BridgeRules.isSupportedVersion(2))
        assertFalse(BridgeRules.isSupportedVersion(0))
        assertFalse(BridgeRules.isAcceptableRaw(null))
        assertFalse(BridgeRules.isAcceptableRaw(""))
        assertTrue(BridgeRules.isAcceptableRaw("{}"))
        assertFalse(BridgeRules.isAcceptableRaw("x".repeat(BridgeRules.MAX_MESSAGE_CHARS + 1)))
    }

    @Test fun filenamesAreSanitised() {
        assertEquals("mathbee-backup-2026-10-31.json", BridgeRules.sanitizeFilename("mathbee-backup-2026-10-31.json"))
        assertEquals("_.._etc_passwd", BridgeRules.sanitizeFilename("/../etc/passwd"))
        assertEquals("hidden.json", BridgeRules.sanitizeFilename("..hidden.json"))
        assertEquals("my_garden.json", BridgeRules.sanitizeFilename("my garden.json"))
        assertTrue(Regex("_+\\.json").matches(BridgeRules.sanitizeFilename("தோட்டம்.json")))
        assertEquals("mathbee.json", BridgeRules.sanitizeFilename(""))
        assertEquals("mathbee.json", BridgeRules.sanitizeFilename(null))
        assertEquals("mathbee.json", BridgeRules.sanitizeFilename("..."))
        assertEquals("mathbee.json", BridgeRules.sanitizeFilename("///"))
        assertEquals(80, BridgeRules.sanitizeFilename("a".repeat(300)).length)
        val s = BridgeRules.sanitizeFilename("we:ird\\na<me>|?*\u0000.txt")
        assertTrue(s, Regex("[A-Za-z0-9._-]{1,80}").matches(s))
    }

    @Test fun mimeWhitelist() {
        assertEquals("application/json", BridgeRules.normalizeMime("application/json"))
        assertEquals("text/plain", BridgeRules.normalizeMime("Text/Plain; charset=utf-8"))
        assertEquals("application/json", BridgeRules.normalizeMime("application/vnd.android.package-archive"))
        assertEquals("application/json", BridgeRules.normalizeMime(null))
    }

    @Test fun lengthCapsAndClamps() {
        assertEquals(600, BridgeRules.clampText("a".repeat(5000), BridgeRules.MAX_SPEAK_CHARS).length)
        assertEquals("", BridgeRules.clampText(null, 10))
        assertEquals(0.5, BridgeRules.clampRate(0.1), 0.0)
        assertEquals(1.5, BridgeRules.clampRate(9.0), 0.0)
        assertEquals(0.9, BridgeRules.clampRate(Double.NaN), 0.0)
        assertEquals(0.9, BridgeRules.clampRate(null), 0.0)
        assertEquals("ta", BridgeRules.normalizeLang("ta"))
        assertEquals("en", BridgeRules.normalizeLang("fr"))
        assertEquals("en", BridgeRules.normalizeLang(null))
    }

    @Test fun hapticsAreWhitelistedAndRateLimited() {
        assertTrue(BridgeRules.isHapticStyle("tap"))
        assertTrue(BridgeRules.isHapticStyle("celebrate"))
        assertFalse(BridgeRules.isHapticStyle("wrong"))
        assertFalse(BridgeRules.isHapticStyle("error"))
        assertFalse(BridgeRules.hapticAllowed(1_000, 1_100))
        assertTrue(BridgeRules.hapticAllowed(1_000, 1_150))
    }

    @Test fun navigationAndServedPaths() {
        assertTrue(BridgeRules.isAllowedNavigation("https", "appassets.androidplatform.net"))
        assertFalse(BridgeRules.isAllowedNavigation("http", "appassets.androidplatform.net"))
        assertFalse(BridgeRules.isAllowedNavigation("https", "play.google.com"))
        assertFalse(BridgeRules.isAllowedNavigation("intent", null))
        assertTrue(BridgeRules.isServedPath("appassets.androidplatform.net", "/web/index.html"))
        assertTrue(BridgeRules.isServedPath("appassets.androidplatform.net", "/web/assets/app-1234.js"))
        assertFalse(BridgeRules.isServedPath("appassets.androidplatform.net", "/index.html"))
        assertFalse(BridgeRules.isServedPath("appassets.androidplatform.net", "/webx/index.html"))
        assertFalse(BridgeRules.isServedPath("appassets.androidplatform.net", "/web/../secret"))
        assertFalse(BridgeRules.isServedPath("example.com", "/web/index.html"))
        assertFalse(BridgeRules.isServedPath("appassets.androidplatform.net", null))
    }

    @Test fun webViewVersionCheck() {
        assertEquals(124, BridgeRules.webViewMajor("124.0.6367.82"))
        assertNull(BridgeRules.webViewMajor(null))
        assertNull(BridgeRules.webViewMajor("beta"))
        assertTrue(BridgeRules.isWebViewSupported("111.0.5563.116"))
        assertFalse(BridgeRules.isWebViewSupported("110.0.5481.153"))
        assertFalse(BridgeRules.isWebViewSupported("69.0.3497.100"))
        assertFalse(BridgeRules.isWebViewSupported(null))
    }

    @Test fun chunkPlanMatchesTheWebSide() {
        val c = BridgeRules.FILE_CHUNK_CHARS
        assertEquals(1, BridgeRules.expectedChunks(0))
        assertEquals(1, BridgeRules.expectedChunks(c))
        assertEquals(2, BridgeRules.expectedChunks(c + 1))
        assertEquals(40, BridgeRules.expectedChunks(BridgeRules.MAX_FILE_CHARS))
        assertTrue(BridgeRules.isValidBegin(10, 1))
        assertFalse(BridgeRules.isValidBegin(10, 2))
        assertFalse(BridgeRules.isValidBegin(-1, 1))
        assertFalse(BridgeRules.isValidBegin(BridgeRules.MAX_FILE_CHARS + 1, 41))
    }

    @Test fun chunkTrackerAcceptsInOrderPiecesOnly() {
        val c = BridgeRules.FILE_CHUNK_CHARS
        val ok = BridgeRules.ChunkTracker(size = c + 10, chunks = 2)
        assertTrue(ok.accept(0, c))
        assertFalse(ok.isComplete())
        assertTrue(ok.accept(1, 10))
        assertTrue(ok.isComplete())

        val outOfOrder = BridgeRules.ChunkTracker(size = c + 10, chunks = 2)
        assertFalse(outOfOrder.accept(1, 10))
        assertFalse(outOfOrder.accept(0, c))                                 // a failed transfer stays failed
        assertFalse(outOfOrder.isComplete())

        val tooBig = BridgeRules.ChunkTracker(size = 5, chunks = 1)
        assertFalse(tooBig.accept(0, 6))

        val oversizedPiece = BridgeRules.ChunkTracker(size = c + 10, chunks = 2)
        assertFalse(oversizedPiece.accept(0, c + 1))

        val short = BridgeRules.ChunkTracker(size = 10, chunks = 1)
        assertTrue(short.accept(0, 9))
        assertFalse(short.isComplete())

        val extra = BridgeRules.ChunkTracker(size = 10, chunks = 1)
        assertTrue(extra.accept(0, 10))
        assertFalse(extra.accept(1, 0))
    }

    @Test fun rendererRecoveryIsLimited() {
        var crashes = BridgeRules.recentCrashes(emptyList(), 1_000)
        assertTrue(BridgeRules.shouldRecreate(crashes))
        crashes = BridgeRules.recentCrashes(crashes, 2_000)
        assertTrue(BridgeRules.shouldRecreate(crashes))
        crashes = BridgeRules.recentCrashes(crashes, 3_000)
        assertFalse(BridgeRules.shouldRecreate(crashes))                     // third crash within a minute: retry cover
        crashes = BridgeRules.recentCrashes(crashes, 3_000 + BridgeRules.CRASH_WINDOW_MS)
        assertTrue(BridgeRules.shouldRecreate(crashes))                      // older crashes have aged out
    }
}
