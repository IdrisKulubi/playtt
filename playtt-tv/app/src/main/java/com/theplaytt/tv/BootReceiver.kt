package com.theplaytt.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Opens the TV screen when the TV turns on (and after the app is updated).
 * On Android 10+ this needs "display over other apps", granted once at
 * install: adb shell appops set com.theplaytt.tv SYSTEM_ALERT_WINDOW allow
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (
            intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
