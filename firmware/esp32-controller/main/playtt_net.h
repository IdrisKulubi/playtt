#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

#include "playtt_nvs.h"

typedef struct {
  char ssid[33];
  int8_t rssi;
  bool secure;
} playtt_scan_result_t;

typedef struct {
  bool connected;
  char ssid[33];
  int8_t rssi;
  char ip[16];
} playtt_net_status_t;

esp_err_t playtt_net_init(void);
/* Tries each saved network in order until one connects. */
esp_err_t playtt_net_connect(const playtt_nvs_state_t *state);
esp_err_t playtt_net_sync_time(void);
bool playtt_net_is_connected(void);
void playtt_net_get_status(playtt_net_status_t *status);
/* Blocking scan; returns the number of results written (strongest first, de-duplicated). */
int playtt_net_scan(playtt_scan_result_t *results, int max_results);
/* Switch to AP+STA so the setup hotspot can run alongside station mode. */
esp_err_t playtt_net_enable_ap(const char *ssid);
