package com.stalinpusparaj.mathbee

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager

/**
 * Audio focus for the game's music and sounds (USAGE_GAME / CONTENT_TYPE_MUSIC).
 * Held while the app is in the foreground and given back on pause. When another app takes focus
 * (a phone call, a timer, navigation), the web side is told so it can pause or lower the music:
 * `onChange` receives "pause", "duck", "unduck" or "resume" (the web `lifecycle` states).
 */
class AudioFocus(context: Context, private val onChange: (state: String) -> Unit) {
    private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var held = false
    /** What we last told the web side because of focus (null = nothing outstanding). */
    private var lost: String? = null

    private val listener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (change == AudioManager.AUDIOFOCUS_LOSS) held = false
                lost = "pause"
                onChange("pause")
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                lost = "duck"
                onChange("duck")
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                held = true
                when (lost) {
                    "pause" -> onChange("resume")
                    "duck" -> onChange("unduck")
                }
                lost = null
            }
        }
    }

    private val request: AudioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build(),
        )
        .setWillPauseWhenDucked(false)
        .setAcceptsDelayedFocusGain(true)
        .setOnAudioFocusChangeListener(listener)
        .build()

    /**
     * Called from onResume. During a call focus is delayed: the music stays paused and resumes on
     * the later AUDIOFOCUS_GAIN. A refused request leaves it paused until the next resume.
     */
    fun acquire() {
        if (held) return
        val r = runCatching { audio.requestAudioFocus(request) }.getOrDefault(AudioManager.AUDIOFOCUS_REQUEST_FAILED)
        held = r != AudioManager.AUDIOFOCUS_REQUEST_FAILED
        if (r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) lost = null
        else { lost = "pause"; onChange("pause") }
    }

    /** Called from onPause: the app is going to the background and plays nothing there. */
    fun abandon() {
        runCatching { audio.abandonAudioFocusRequest(request) }
        held = false
        lost = null
    }
}
