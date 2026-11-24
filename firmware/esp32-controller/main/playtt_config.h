#pragma once

#define PLAYTT_FIRMWARE_VERSION "esp32s3-v1.1.0"
#define PLAYTT_DEFAULT_BASE_URL "https://www.theplaytt.com"
#define PLAYTT_HEARTBEAT_MS 15000
#define PLAYTT_DEBOUNCE_MS 80
#define PLAYTT_HTTP_TIMEOUT_MS 15000
#define PLAYTT_MAX_EVENT_QUEUE 32
#define PLAYTT_HTTP_BODY_MAX 4096

#define PLAYTT_GPIO_SIDE_A 15
#define PLAYTT_GPIO_SIDE_B 16
#define PLAYTT_GPIO_LED 2
#define PLAYTT_GPIO_BOOT 0
/* Periodic pin-level log; kept slow so the USB log stays readable for the setup page. */
#define PLAYTT_GPIO_DIAG_MS 60000

/* Start the "PlayTT-Setup-xxxxxx" hotspot after this long without any saved Wi-Fi working. */
#define PLAYTT_HOTSPOT_AFTER_MS 120000
/* While the hotspot is on, how often to retry the saved networks. */
#define PLAYTT_HOTSPOT_RETRY_MS 180000
