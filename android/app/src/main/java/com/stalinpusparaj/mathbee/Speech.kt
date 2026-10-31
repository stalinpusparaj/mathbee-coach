package com.stalinpusparaj.mathbee

import android.content.Context
import android.media.AudioAttributes
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import java.util.Locale

/**
 * Narration through the device's own text-to-speech (WebView has no speechSynthesis).
 * English and Tamil; only offline voices count (the app has no INTERNET permission), preferring
 * an Indian voice and higher quality. Every utterance reports start and end/error so the web side
 * can duck the music and hold its timers exactly while speech plays.
 *
 * All callbacks arrive on the main thread.
 */
class Speech(
    context: Context,
    private val onEvent: (id: String, state: String) -> Unit,
    private val onVoices: (en: Boolean, ta: Boolean) -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private val readyWaiters = mutableListOf<() -> Unit>()
    private var shutDown = false

    /** True once the engine finished starting (whether or not it succeeded). */
    var initialised = false; private set
    private var ready = false
    private var voices = Pair(false, false)

    private val tts: TextToSpeech = TextToSpeech(context.applicationContext) { status ->
        main.post {
            if (shutDown) return@post
            ready = status == TextToSpeech.SUCCESS
            initialised = true
            if (ready) {
                // speech follows the game's volume (STREAM_MUSIC) and never asks for audio focus itself
                tts.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
            }
            refreshVoices()
            readyWaiters.toList().forEach { it() }
            readyWaiters.clear()
            // right after install some engines list their voices a little later: look again once
            if (ready && !voices.first) main.postDelayed({ if (!shutDown) refreshVoices() }, LATE_VOICES_MS)
        }
    }

    init {
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String) { main.post { onEvent(id, "start") } }
            override fun onDone(id: String) { main.post { onEvent(id, "end") } }
            @Deprecated("Deprecated in Java")
            override fun onError(id: String) { main.post { onEvent(id, "error") } }
            override fun onError(id: String, errorCode: Int) { main.post { onEvent(id, "error") } }
            override fun onStop(id: String, interrupted: Boolean) { main.post { onEvent(id, "end") } }
        })
    }

    /** Runs `fn` once the engine has started (now if it already has). */
    fun whenInitialised(fn: () -> Unit) {
        if (initialised) fn() else readyWaiters += fn
    }

    private fun installedVoices(): List<Voice> = runCatching { tts.voices?.toList() }.getOrNull().orEmpty()
        .filter { !it.isNetworkConnectionRequired && TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features }

    /** Best offline voice for `lang`: same language, Indian locale first, then higher quality, then lower latency. */
    private fun bestVoice(lang: String): Voice? = installedVoices()
        .filter { it.locale.language == lang }
        .sortedWith(
            compareByDescending<Voice> { it.locale.country == "IN" }
                .thenByDescending { it.quality }
                .thenBy { it.latency },
        )
        .firstOrNull()

    /** Some engines list no Voice objects; then trust isLanguageAvailable for the Indian locale. */
    private fun localeFallback(lang: String): Locale? {
        if (installedVoices().isNotEmpty()) return null
        val candidates = listOf(Locale.forLanguageTag("$lang-IN"), Locale.forLanguageTag(lang))
        return candidates.firstOrNull { runCatching { tts.isLanguageAvailable(it) }.getOrDefault(TextToSpeech.LANG_NOT_SUPPORTED) >= TextToSpeech.LANG_AVAILABLE }
    }

    fun has(lang: String): Boolean = ready && (bestVoice(lang) != null || localeFallback(lang) != null)

    fun voicesNow(): Pair<Boolean, Boolean> = voices

    /** Re-reads the installed voices (a parent may have just installed Tamil) and reports them. */
    fun refreshVoices() {
        voices = Pair(has("en"), has("ta"))
        if (BuildConfig.DEBUG) {
            val all = runCatching { tts.voices?.toList() }.getOrNull().orEmpty()
            Log.i(TAG, "voices ready=$ready total=${all.size} offline=${installedVoices().size} en=${voices.first} ta=${voices.second} " +
                all.filter { it.locale.language == "en" || it.locale.language == "ta" }.take(12)
                    .joinToString { "${it.name}[net=${it.isNetworkConnectionRequired},f=${it.features}]" })
        }
        onVoices(voices.first, voices.second)
    }

    /** Speaks `text`, replacing anything still playing. Without a voice the web side shows the text instead. */
    fun speak(id: String, text: String, lang: String, rate: Double) {
        if (!ready || text.isBlank()) { onEvent(id, "error"); return }
        val voice = bestVoice(lang)
        val ok = when {
            voice != null -> runCatching { tts.voice = voice }.isSuccess
            else -> localeFallback(lang)?.let { tts.setLanguage(it) >= TextToSpeech.LANG_AVAILABLE } ?: false
        }
        if (!ok) { onEvent(id, "error"); return }
        tts.setSpeechRate(rate.toFloat())
        tts.setPitch(1.05f)
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) onEvent(id, "error")
    }

    fun stop() {
        if (ready) runCatching { tts.stop() }
    }

    fun shutdown() {
        shutDown = true
        main.removeCallbacksAndMessages(null)
        readyWaiters.clear()
        runCatching { tts.shutdown() }
    }

    private companion object {
        const val TAG = "MathBeeSpeech"
        const val LATE_VOICES_MS = 3_000L
    }
}
