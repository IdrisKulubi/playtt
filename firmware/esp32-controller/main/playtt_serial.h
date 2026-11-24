#pragma once

#include <stdbool.h>

#include "playtt_nvs.h"

/*
 * USB serial command channel.
 *
 * Machine protocol (used by the admin "Set up controller" page): send one JSON
 * object per line, e.g. {"cmd":"info"}. Each reply is one line:
 *   @@PLAYTT {"type":"info", ...}
 * Commands: info, scan, set_wifi, register, reboot, forget.
 *
 * Human shortcuts (no Enter needed): a / b = point, u = undo A, g = pin levels,
 * w = change Wi-Fi. Type "setup" + Enter for the guided setup.
 */
void playtt_serial_start(const playtt_nvs_state_t *live_state);

/* Returns true and fills `key` when a scoring shortcut (a, b, u) was pressed. */
bool playtt_serial_take_hotkey(char *key);
