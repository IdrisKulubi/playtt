#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

typedef struct {
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
bool playtt_nvs_run_setup_wizard(playtt_nvs_state_t *state);
