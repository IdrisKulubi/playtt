package com.theplaytt.tv

import android.content.Context

/** What this TV shows: one table at one venue, from one PlayTT server. */
class TvSettings(context: Context) {
    private val prefs = context.getSharedPreferences("playtt_tv", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER, null) ?: BuildConfig.DEFAULT_SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER, normalizeServerUrl(value)).apply()

    val resourceId: String? get() = prefs.getString(KEY_RESOURCE, null)
    val tableName: String? get() = prefs.getString(KEY_TABLE_NAME, null)
    val venueName: String? get() = prefs.getString(KEY_VENUE_NAME, null)

    fun saveTable(resourceId: String, tableName: String, venueName: String) {
        prefs.edit()
            .putString(KEY_RESOURCE, resourceId)
            .putString(KEY_TABLE_NAME, tableName)
            .putString(KEY_VENUE_NAME, venueName)
            .apply()
    }

    fun clearTable() {
        prefs.edit().remove(KEY_RESOURCE).remove(KEY_TABLE_NAME).remove(KEY_VENUE_NAME).apply()
    }

    fun tvPageUrl(): String? = resourceId?.let {
        "$serverUrl/pod/tv?resourceId=${android.net.Uri.encode(it)}"
    }

    companion object {
        private const val KEY_SERVER = "server_url"
        private const val KEY_RESOURCE = "resource_id"
        private const val KEY_TABLE_NAME = "table_name"
        private const val KEY_VENUE_NAME = "venue_name"

        /** "theplaytt.com/" -> "https://theplaytt.com"; keeps http for local testing. */
        fun normalizeServerUrl(value: String): String {
            val trimmed = value.trim().trimEnd('/')
            return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                trimmed
            } else {
                "https://$trimmed"
            }
        }
    }
}
