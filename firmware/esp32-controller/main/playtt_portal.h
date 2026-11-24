#pragma once

#include "esp_err.h"

/*
 * Last-resort setup hotspot. Started when no saved Wi-Fi works: the controller
 * opens "PlayTT-Setup-xxxxxx", phones that join get a sign-in page where a new
 * Wi-Fi network can be saved. Registration and table assignment are kept.
 */
esp_err_t playtt_portal_start(void);
