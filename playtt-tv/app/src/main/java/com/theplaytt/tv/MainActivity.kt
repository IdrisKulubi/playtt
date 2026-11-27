package com.theplaytt.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast

/**
 * The TV screen: the PlayTT table page (scoreboard, idle screen, replays)
 * full-screen, kept on, and allowed to play replay clips straight from the
 * venue PC over the local network.
 */
class MainActivity : Activity() {
    private lateinit var settings: TvSettings
    private var webView: WebView? = null
    private lateinit var root: FrameLayout
    private lateinit var offlineView: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var pageFailed = false
    private var hint: Toast? = null
    private var backPresses = 0
    private var firstBackPressAt = 0L

    private val retry = Runnable { webView?.reload() }
    private val periodicReload = object : Runnable {
        override fun run() {
            // Picks up website updates and frees memory on a screen that runs for days.
            webView?.reload()
            handler.postDelayed(this, PERIODIC_RELOAD_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = TvSettings(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val pageUrl = settings.tvPageUrl()
        if (pageUrl == null) {
            openSetup()
            return
        }

        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        offlineView = TextView(this).apply {
            text = "Can't reach PlayTT. Retrying…"
            setTextColor(Color.argb(170, 255, 255, 255))
            textSize = 22f
            gravity = Gravity.CENTER
            visibility = View.GONE
        }
        setContentView(root)
        createWebView(pageUrl)
        root.addView(offlineView, FrameLayout.LayoutParams(-1, -1))
        handler.postDelayed(periodicReload, PERIODIC_RELOAD_MS)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(pageUrl: String) {
        // Debug builds only: lets chrome://inspect look inside the page.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val view = WebView(this)
        view.setBackgroundColor(Color.BLACK)
        view.isFocusable = false

        with(view.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Replays start by themselves (they're muted).
            mediaPlaybackRequiresUserGesture = false
            // The page is https; replay clips come from the venue PC over
            // http on the local network. The site only hands out venue-LAN
            // clip links (checked server-side), so allow exactly that.
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = "$userAgentString PlayTTTV/${BuildConfig.VERSION_NAME}"
        }

        val serverHost = Uri.parse(settings.serverUrl).host
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                // Stay on the PlayTT site; never wander off to other pages.
                return request.url.host != serverHost
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                pageFailed = false
            }

            override fun onPageFinished(view: WebView, url: String) {
                // An error page also "finishes"; keep the message up then.
                offlineView.visibility = if (pageFailed) View.VISIBLE else View.GONE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (request.isForMainFrame) {
                    pageFailed = true
                    offlineView.visibility = View.VISIBLE
                    handler.removeCallbacks(retry)
                    handler.postDelayed(retry, RETRY_MS)
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // The page crashed (e.g. low memory): rebuild it instead of exiting.
                root.removeView(view)
                view.destroy()
                webView = null
                createWebView(pageUrl)
                return true
            }
        }

        view.webChromeClient = object : WebChromeClient() {
            // WebView otherwise shows a grey "play" poster before each clip.
            override fun getDefaultVideoPoster(): Bitmap =
                Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
        }

        root.addView(view, 0, FrameLayout.LayoutParams(-1, -1))
        webView = view
        view.loadUrl(pageUrl)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }

    /**
     * Back doesn't close the app (a kiosk). Pressing it 5 times within
     * 4 seconds opens setup, to move this TV to another table.
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) {
                val now = System.currentTimeMillis()
                if (now - firstBackPressAt > SETUP_GESTURE_WINDOW_MS) {
                    firstBackPressAt = now
                    backPresses = 0
                }
                backPresses += 1
                val remaining = SETUP_GESTURE_PRESSES - backPresses
                if (remaining <= 0) {
                    backPresses = 0
                    openSetup()
                } else if (backPresses >= 2) {
                    hint?.cancel()
                    hint = Toast.makeText(this, "Press Back $remaining more times for setup", Toast.LENGTH_SHORT)
                        .also { it.show() }
                }
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun openSetup() {
        // Don't leave "Press Back…" covering the setup screen's buttons.
        hint?.cancel()
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    companion object {
        private const val RETRY_MS = 10_000L
        private const val PERIODIC_RELOAD_MS = 6 * 60 * 60 * 1000L
        private const val SETUP_GESTURE_PRESSES = 5
        private const val SETUP_GESTURE_WINDOW_MS = 4_000L
    }
}
