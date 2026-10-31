package com.stalinpusparaj.mathbee

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Log
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebViewOutcomeReceiver
import androidx.webkit.WebViewStartUpConfig
import androidx.webkit.WebViewStartUpResult
import androidx.webkit.WebViewStartupException
import java.io.ByteArrayInputStream
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The whole app: one full-screen WebView showing the bundled web game from
 * https://appassets.androidplatform.net/web/ (WebViewAssetLoader, no INTERNET permission), plus the
 * native pieces the WebView lacks — text-to-speech, back, haptics, save/share/print, splash,
 * immersive mode, audio focus and renderer-crash recovery (docs/BUILD_PLAN.md §3).
 */
class MainActivity : ComponentActivity(), ShellBridge.Host {
    private lateinit var root: FrameLayout
    private var web: WebView? = null
    private var bridge: ShellBridge? = null
    private lateinit var focus: AudioFocus
    private val main = Handler(Looper.getMainLooper())

    private var webReady = false
    private var startedAt = 0L
    private var crashTimes: List<Long> = emptyList()
    private var cover: View? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pausedSent = false
    private var timersPaused = false
    private var pendingTimerPause: Runnable? = null

    /** Serves /web/ (and below) from assets/web/; MainActivity.Client rejects every other path and host. */
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(BridgeRules.ORIGIN_HOST)
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    /** Enabled while the web side handles back itself (it reports `canGoBack` with every route). */
    private val backCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() { bridge?.sendBack() }
    }

    private val saveTarget = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        bridge?.onSaveTarget(if (r.resultCode == Activity.RESULT_OK) r.data?.data else null)
    }

    private val chooseFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data))
        fileCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        startedAt = SystemClock.uptimeMillis()
        // the splash stays until the first screen has drawn (`ready`), never longer than 4 s
        splash.setKeepOnScreenCondition { !webReady && SystemClock.uptimeMillis() - startedAt < SPLASH_MAX_MS }
        enableEdgeToEdge()
        volumeControlStream = AudioManager.STREAM_MUSIC

        root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.cream)) }
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val d = resources.displayMetrics.density                       // device px → CSS px
            bridge?.sendInsets((bars.top / d).roundToInt(), (bars.right / d).roundToInt(),
                (max(bars.bottom, ime.bottom) / d).roundToInt(), (bars.left / d).roundToInt())
            insets
        }
        onBackPressedDispatcher.addCallback(this, backCallback)
        focus = AudioFocus(this) { state -> bridge?.sendLifecycle(state) }
        startWebView()
    }

    // ---------------------------------------------------------------- WebView

    /** Checks the WebView, warms Chromium up off the main thread (the splash covers it), then loads the game. */
    private fun startWebView() {
        val pkg = runCatching { WebViewCompat.getCurrentWebViewPackage(this) }.getOrNull()
        if (pkg == null || !BridgeRules.isWebViewSupported(pkg.versionName)) return showUpdateCover()
        val create = Runnable { if (!isDestroyed && web == null) createWebView() }
        try {
            WebViewCompat.startUpWebView(this, WebViewStartUpConfig.Builder(Executors.newSingleThreadExecutor()).build(),
                object : WebViewOutcomeReceiver<WebViewStartUpResult, WebViewStartupException> {
                    override fun onResult(result: WebViewStartUpResult) = runOnUiThread(create)
                    override fun onError(error: WebViewStartupException) = runOnUiThread(create)
                })
        } catch (e: Throwable) {
            create.run()                                                   // older WebView: start it the classic way
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView() {
        // both are needed for the bridge; WebView ≥ 111 has them, but a vendor build might not
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return showUpdateCover()
        val w = try { WebView(this) } catch (e: Throwable) { return showUpdateCover() }
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                                       // localStorage; IndexedDB is always on
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false                       // music and narration without a first tap
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100                                                 // the game has its own text-size setting
            setGeolocationEnabled(false)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(w.settings, false)
        }
        if (Build.VERSION.SDK_INT >= 29) w.isForceDarkAllowed = false
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)       // chrome://inspect in debug builds only
        w.setBackgroundColor(getColor(R.color.cream))
        w.overScrollMode = View.OVER_SCROLL_NEVER
        w.isVerticalScrollBarEnabled = false
        w.isHorizontalScrollBarEnabled = false
        // no text-selection menus or stray buzzes from long presses; haptics go through the bridge only
        w.isHapticFeedbackEnabled = false
        w.isLongClickable = false
        w.setOnLongClickListener { true }
        w.webViewClient = Client()
        w.webChromeClient = Chrome()

        val b = bridge ?: ShellBridge(this, this).also { bridge = it }
        b.attach(w)
        root.addView(w, 0, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        web = w
        if (timersPaused && lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) { w.resumeTimers(); timersPaused = false }
        ViewCompat.requestApplyInsets(root)
        w.loadUrl(BridgeRules.START_URL)
    }

    // lint does not see the override below through WebViewClientCompat; it is there and tested
    @SuppressLint("MissingOnRenderProcessGone")
    private inner class Client : WebViewClientCompat() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url
            if (url.scheme != "https" && url.scheme != "http") return null      // data:, blob: stay inside the page
            if (!BridgeRules.isServedPath(url.host, url.path)) return notFound()
            return assetLoader.shouldInterceptRequest(url) ?: notFound()
        }

        /** The game never leaves its bundled pages; any other URL is blocked. */
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            !BridgeRules.isAllowedNavigation(request.url.scheme, request.url.host)

        /**
         * A crashed or killed renderer cannot be reused. Recreate the WebView (progress is in IndexedDB),
         * at most twice a minute; after that show "Buzzy needs a tiny rest — Try again".
         */
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            if (BuildConfig.DEBUG) Log.w(TAG, "renderer gone, crashed=${detail.didCrash()}")
            root.removeView(view)
            view.destroy()
            if (view !== web) return true
            web = null
            bridge?.reset()
            backCallback.isEnabled = false
            setKeepAwake(false)
            webReady = true                                                // never hold the splash for a dead page
            crashTimes = BridgeRules.recentCrashes(crashTimes, SystemClock.uptimeMillis())
            if (BridgeRules.shouldRecreate(crashTimes)) createWebView() else showRetryCover()
            return true
        }
    }

    private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    private inner class Chrome : WebChromeClient() {
        /** Import opens the system picker for any file (Downloads and Drive often mislabel JSON); the web side validates it. */
        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            val pick = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
            return try {
                chooseFile.launch(pick)
                true
            } catch (e: ActivityNotFoundException) {
                fileCallback = null
                false
            }
        }

        override fun onPermissionRequest(request: PermissionRequest) = request.deny()   // no camera or microphone, ever

        override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
            callback?.invoke(origin, false, false)
        }

        override fun onConsoleMessage(message: ConsoleMessage): Boolean {
            if (BuildConfig.DEBUG) Log.println(
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.ERROR else Log.INFO,
                WEB_TAG, "${message.message()} (${message.sourceId()}:${message.lineNumber()})",
            )
            return true
        }
    }

    // ---------------------------------------------------------------- native covers

    private fun showRetryCover() = showCover(R.string.retry_title, R.string.retry_body) {
        crashTimes = emptyList()
        hideCover()
        createWebView()
    }

    /** Android System WebView is missing, too old (< 111) or lacks a needed feature. */
    private fun showUpdateCover() {
        webReady = true
        showCover(R.string.webview_title, R.string.webview_body) { recreate() }
    }

    private fun showCover(title: Int, body: Int, onTap: () -> Unit) {
        hideCover()
        val v = layoutInflater.inflate(R.layout.retry_cover, root, false)
        v.findViewById<TextView>(R.id.cover_title).setText(title)
        v.findViewById<TextView>(R.id.cover_body).setText(body)
        v.findViewById<Button>(R.id.cover_button).setOnClickListener { onTap() }
        ViewCompat.setOnApplyWindowInsetsListener(v) { view, insets ->
            val i = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(i.left, i.top, i.right, i.bottom)
            insets
        }
        root.addView(v, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        cover = v
        ViewCompat.requestApplyInsets(v)
    }

    private fun hideCover() {
        cover?.let { root.removeView(it) }
        cover = null
    }

    // ---------------------------------------------------------------- ShellBridge.Host

    override fun onWebReady() { webReady = true }

    override fun setBackEnabled(enabled: Boolean) { backCallback.isEnabled = enabled }

    override fun setKeepAwake(on: Boolean) {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun pickSaveTarget(filename: String, mime: String): Boolean = try {
        saveTarget.launch(
            Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mime)
                .putExtra(Intent.EXTRA_TITLE, filename),
        )
        true
    } catch (e: ActivityNotFoundException) {
        false
    }

    /** System print dialog for the current page (worksheets); "Save as PDF" is built in. */
    override fun print(jobName: String): Boolean {
        val w = web ?: return false
        val pm = getSystemService(PRINT_SERVICE) as PrintManager
        pm.print(jobName, w.createPrintDocumentAdapter(jobName),
            PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build())
        return true
    }

    /**
     * Through the window's decor view with FLAG_IGNORE_VIEW_SETTING, because the WebView itself has
     * haptics switched off. The system "touch feedback" setting is still honoured.
     */
    override fun haptic(style: String) {
        val v = window.decorView
        val confirm = if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
        val flag = HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING
        when (style) {
            "celebrate" -> {
                v.performHapticFeedback(confirm, flag)
                v.postDelayed({ v.performHapticFeedback(confirm, flag) }, 160)
            }
            "success" -> v.performHapticFeedback(confirm, flag)
            else -> v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP, flag)
        }
    }

    /** The web side saved everything after `lifecycle: pause`; timers can stop now. */
    override fun onFlushed() {
        pendingTimerPause?.let { main.removeCallbacks(it); it.run() }
    }

    /** Only after the child confirmed on the Bye-bye sheet. */
    override fun exitApp() = finish()

    // ---------------------------------------------------------------- lifecycle

    /**
     * Pause order matters (BUILD_PLAN §A3.20): ask the page to flush, say `lifecycle: pause`, stop
     * speech, pause the WebView; the process-wide JS timers stop only after `flushed` or 300 ms.
     */
    override fun onPause() {
        super.onPause()
        val w = web
        bridge?.speech?.stop()
        if (w != null) {
            w.evaluateJavascript("window.__mbFlush&&window.__mbFlush()", null)
            bridge?.sendLifecycle("pause")
            pausedSent = true
            w.onPause()
            val pauseTimers = Runnable {
                pendingTimerPause = null
                if (!lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                    web?.pauseTimers()
                    timersPaused = web != null
                }
            }
            pendingTimerPause?.let { main.removeCallbacks(it) }
            pendingTimerPause = pauseTimers
            main.postDelayed(pauseTimers, FLUSH_WAIT_MS)
        }
        setKeepAwake(false)
        focus.abandon()
    }

    override fun onResume() {
        super.onResume()
        pendingTimerPause?.let { main.removeCallbacks(it) }
        pendingTimerPause = null
        web?.let { w ->
            if (timersPaused) { w.resumeTimers(); timersPaused = false }
            w.onResume()
        }
        if (pausedSent) { bridge?.sendLifecycle("resume"); pausedSent = false }
        focus.acquire()
        bridge?.speech?.refreshVoices()                                    // a parent may have just installed a voice
        applyImmersive()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()                                     // re-applied after dialogs and the print UI
    }

    /** Full screen for the child; the bars come back briefly with a swipe from the edge. */
    private fun applyImmersive() {
        WindowCompat.getInsetsController(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        bridge?.shutdown()
        web?.let { root.removeView(it); it.destroy() }
        web = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "MathBee"
        private const val WEB_TAG = "MathBeeWeb"
        private const val SPLASH_MAX_MS = 4_000L
        private const val FLUSH_WAIT_MS = 300L
    }
}
