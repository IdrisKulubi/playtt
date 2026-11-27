package com.theplaytt.tv

import android.app.Activity
import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * One-time setup with the remote: choose the venue, then the table this TV
 * sits at. Reached on first launch, or by pressing Back 5 times on the TV
 * screen.
 */
class SetupActivity : Activity() {
    private lateinit var settings: TvSettings
    private lateinit var heading: TextView
    private lateinit var subtitle: TextView
    private lateinit var list: LinearLayout
    private lateinit var footer: LinearLayout
    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var venues: List<Venue> = emptyList()
    private var showingTablesOf: Venue? = null

    data class Table(val id: String, val name: String)
    data class Venue(val id: String, val name: String, val tables: List<Table>)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = TvSettings(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        buildLayout()
        loadVenues()
    }

    private fun buildLayout() {
        val pad = dp(48)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, dp(36), pad, dp(24))
            setBackgroundColor(BACKGROUND)
        }

        heading = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 30f
            typeface = Typeface.DEFAULT_BOLD
        }
        subtitle = TextView(this).apply {
            setTextColor(Color.argb(170, 255, 255, 255))
            textSize = 18f
            setPadding(0, dp(6), 0, dp(20))
        }
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val scroll = ScrollView(this).apply {
            addView(list)
            isFillViewport = true
        }
        footer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(16), 0, 0)
        }

        column.addView(heading)
        column.addView(subtitle)
        column.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        column.addView(footer)
        setContentView(column)
    }

    private fun loadVenues() {
        showingTablesOf = null
        heading.text = "Set up this TV"
        subtitle.text = "Loading venues from ${settings.serverUrl}…"
        list.removeAllViews()
        renderFooter()

        val server = settings.serverUrl
        executor.execute {
            val result = runCatching { fetchVenues(server) }
            main.post {
                if (isFinishing) return@post
                result.onSuccess { loaded ->
                    venues = loaded
                    showVenues()
                }.onFailure {
                    heading.text = "Can't load venues"
                    subtitle.text = "Check the TV's internet connection and the server address."
                    list.removeAllViews()
                    addOption("Try again") { loadVenues() }.requestFocus()
                }
            }
        }
    }

    private fun showVenues() {
        showingTablesOf = null
        heading.text = "Which venue is this TV at?"
        val current = settings.venueName?.let { venue ->
            " Now: $venue · ${settings.tableName}."
        } ?: ""
        subtitle.text = "Use the arrows and OK on the remote.$current"
        list.removeAllViews()
        if (venues.isEmpty()) {
            subtitle.text = "No venues found on ${settings.serverUrl}."
        }
        var first: View? = null
        for (venue in venues) {
            val button = addOption("${venue.name}   ·   ${venue.tables.size} tables") {
                showTables(venue)
            }
            if (first == null) first = button
        }
        renderFooter()
        first?.requestFocus()
    }

    private fun showTables(venue: Venue) {
        showingTablesOf = venue
        heading.text = "Which table is this TV for?"
        subtitle.text = venue.name
        list.removeAllViews()
        var first: View? = null
        for (table in venue.tables) {
            val button = addOption(table.name) { chooseTable(venue, table) }
            if (first == null || table.id == settings.resourceId) first = button
        }
        addOption("← Other venues") { showVenues() }
        renderFooter()
        first?.requestFocus()
    }

    private fun chooseTable(venue: Venue, table: Table) {
        settings.saveTable(table.id, table.name, venue.name)
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
        )
        finish()
    }

    private fun renderFooter() {
        footer.removeAllViews()
        footer.addView(
            smallButton("Server: ${settings.serverUrl}") { editServer() },
        )
        if (settings.resourceId != null) {
            footer.addView(smallButton("Cancel") { backToTv() })
        }
        footer.addView(
            smallButton("Kiosk mode: ${if (isKioskEnabled()) "On" else "Off"}") {
                setKioskEnabled(!isKioskEnabled())
                renderFooter()
            },
        )
        // In kiosk mode Home leads back here, so this is the way to the TV's
        // own settings (Wi-Fi, display, updates).
        footer.addView(
            smallButton("Android settings") {
                runCatching { startActivity(Intent(Settings.ACTION_SETTINGS)) }
            },
        )
    }

    /**
     * Kiosk mode offers this app as a home screen, so it opens at boot and on
     * Home. Making it *the* home screen is one adb command (see README).
     */
    private val kioskHome get() = ComponentName(this, "$packageName.KioskHome")

    private fun isKioskEnabled(): Boolean =
        packageManager.getComponentEnabledSetting(kioskHome) ==
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED

    private fun setKioskEnabled(enabled: Boolean) {
        packageManager.setComponentEnabledSetting(
            kioskHome,
            if (enabled) {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
            },
            PackageManager.DONT_KILL_APP,
        )
    }

    private fun editServer() {
        val input = EditText(this).apply {
            setText(settings.serverUrl)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSelection(text.length)
        }
        AlertDialog.Builder(this)
            .setTitle("PlayTT server address")
            .setMessage("Leave as https://www.theplaytt.com unless you're testing.")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                settings.serverUrl = input.text.toString()
                loadVenues()
            }
            .setNeutralButton("Reset") { _, _ ->
                settings.serverUrl = BuildConfig.DEFAULT_SERVER_URL
                loadVenues()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun backToTv() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            when {
                showingTablesOf != null -> showVenues()
                settings.resourceId != null -> backToTv()
                // First setup: nothing to go back to; stay here.
            }
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean =
        keyCode == KeyEvent.KEYCODE_BACK || super.onKeyDown(keyCode, event)

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun addOption(label: String, onClick: () -> Unit): Button {
        val button = Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 22f
            gravity = Gravity.CENTER_VERTICAL or Gravity.START
            setPadding(dp(24), dp(14), dp(24), dp(14))
            setTextColor(Color.WHITE)
            background = focusBackground()
            stateListAnimator = null
            isFocusable = true
            setOnClickListener { onClick() }
        }
        list.addView(
            button,
            LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) },
        )
        return button
    }

    private fun smallButton(label: String, onClick: () -> Unit): Button =
        Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            setTextColor(Color.argb(200, 255, 255, 255))
            background = focusBackground()
            stateListAnimator = null
            setPadding(dp(18), dp(8), dp(18), dp(8))
            layoutParams = LinearLayout.LayoutParams(-2, -2).apply { marginEnd = dp(12) }
            setOnClickListener { onClick() }
        }

    /** Clear focus highlight: you must always see where the remote is. */
    private fun focusBackground(): StateListDrawable {
        fun shape(fill: Int, stroke: Int) = GradientDrawable().apply {
            cornerRadius = dp(12).toFloat()
            setColor(fill)
            setStroke(dp(3), stroke)
        }
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_focused), shape(ACCENT_DIM, ACCENT))
            addState(intArrayOf(android.R.attr.state_pressed), shape(ACCENT_DIM, ACCENT))
            addState(intArrayOf(), shape(SURFACE, Color.TRANSPARENT))
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        private val BACKGROUND = Color.rgb(7, 17, 28)
        private val SURFACE = Color.rgb(20, 32, 46)
        private val ACCENT = Color.rgb(0, 180, 255)
        private val ACCENT_DIM = Color.rgb(8, 58, 88)

        fun fetchVenues(server: String): List<Venue> {
            val connection = URL("$server/api/display/v1/setup").openConnection() as HttpURLConnection
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            try {
                if (connection.responseCode != 200) {
                    error("HTTP ${connection.responseCode}")
                }
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                return parseVenues(body)
            } finally {
                connection.disconnect()
            }
        }

        fun parseVenues(body: String): List<Venue> {
            val venues = JSONObject(body).getJSONObject("data").getJSONArray("venues")
            return (0 until venues.length()).map { index ->
                val venue = venues.getJSONObject(index)
                val tables = venue.getJSONArray("tables")
                Venue(
                    id = venue.getString("id"),
                    name = venue.getString("name"),
                    tables = (0 until tables.length()).map { tableIndex ->
                        val table = tables.getJSONObject(tableIndex)
                        Table(id = table.getString("id"), name = table.getString("name"))
                    },
                )
            }.filter { it.tables.isNotEmpty() }
        }
    }
}
