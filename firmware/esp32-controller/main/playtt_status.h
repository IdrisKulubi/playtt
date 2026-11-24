#pragma once

#include <stdbool.h>
#include <stdint.h>

/* Live device state shared between the main loop and the USB/hotspot setup channels. */
typedef enum {
  PLAYTT_STAGE_NOT_SET_UP = 0,
  PLAYTT_STAGE_CONNECTING_WIFI,
  PLAYTT_STAGE_SYNCING_TIME,
  PLAYTT_STAGE_REGISTERING,
  PLAYTT_STAGE_WAITING_ASSIGNMENT,
  PLAYTT_STAGE_READY,
  PLAYTT_STAGE_ERROR,
} playtt_stage_t;

typedef struct {
  volatile playtt_stage_t stage;
  /* Last error code reported by the PlayTT server (e.g. DEVICE_REVOKED), empty if none. */
  char last_error[48];
  volatile bool hotspot_active;
  volatile int64_t last_heartbeat_ok_ms;
} playtt_status_t;

extern playtt_status_t g_playtt_status;

const char *playtt_stage_name(playtt_stage_t stage);
