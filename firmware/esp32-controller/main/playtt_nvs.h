#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

#define PLAYTT_MAX_NETWORKS 3

typedef struct {
  char ssid[33];
  char password[65];
} playtt_network_t;

typedef struct {
  /* Saved Wi-Fi networks, tried in order. networks[0] mirrors the legacy wifi_ssid/wifi_password keys. */
  playtt_network_t networks[PLAYTT_MAX_NETWORKS];
  int network_count;
  /* Legacy aliases of networks[0], kept so older code paths keep working. */
  char wifi_ssid[33];
  char wifi_password[65];
  char base_url[128];
  char enrollment_code[64];
  char device_id[64];
  char device_secret[128];
  char hardware_uid[64];
  char boot_id[40];
  int32_t credential_version;
  int32_t config_version;
  int32_t next_sequence;
  bool provisioned;
  bool setup_complete;
} playtt_nvs_state_t;

esp_err_t playtt_nvs_init(void);
esp_err_t playtt_nvs_load(playtt_nvs_state_t *state);
esp_err_t playtt_nvs_save(const playtt_nvs_state_t *state);
esp_err_t playtt_nvs_begin_boot(playtt_nvs_state_t *state);
esp_err_t playtt_nvs_erase_all(void);

/* Replace the saved networks (1..PLAYTT_MAX_NETWORKS, first is preferred). */
void playtt_nvs_set_networks(playtt_nvs_state_t *state, const playtt_network_t *networks, int count);

/*
 * Prepare a fresh registration: keeps Wi-Fi, clears old device credentials,
 * stores the new enrollment code and generates a new hardware UID.
 */
void playtt_nvs_prepare_registration(playtt_nvs_state_t *state,
                                     const char *enrollment_code,
                                     const char *base_url);

/* Stable per-board id derived from the Wi-Fi MAC, e.g. "a1b2c3". */
void playtt_nvs_board_id(char *out, size_t out_len);
