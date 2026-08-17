#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "playtt_config.h"
#include "playtt_nvs.h"

#include "esp_err.h"

typedef struct {
  char response[PLAYTT_HTTP_BODY_MAX];
  int status_code;
  bool duplicate;
} playtt_api_response_t;

esp_err_t playtt_api_provision(playtt_nvs_state_t *state);
esp_err_t playtt_api_get_config(playtt_nvs_state_t *state);
esp_err_t playtt_api_heartbeat(playtt_nvs_state_t *state, int64_t uptime_ms);
esp_err_t playtt_api_poll_commands(playtt_nvs_state_t *state);
esp_err_t playtt_api_post_event(playtt_nvs_state_t *state,
                                int32_t sequence,
                                const char *kind,
                                const char *side,
                                int delta,
                                playtt_api_response_t *response);
