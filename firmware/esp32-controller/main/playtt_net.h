#pragma once

#include "esp_err.h"

#include "playtt_nvs.h"

esp_err_t playtt_net_init(void);
esp_err_t playtt_net_connect(const playtt_nvs_state_t *state);
esp_err_t playtt_net_sync_time(void);
bool playtt_net_is_connected(void);
