#include "playtt_nvs.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

#include "esp_log.h"
#include "esp_random.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "playtt_config.h"

static const char *TAG = "playtt_nvs";

static void read_line(const char *prompt, char *buffer, size_t buffer_len) {
  printf("%s", prompt);
  fflush(stdout);

  if (fgets(buffer, buffer_len, stdin) == NULL) {
    buffer[0] = '\0';
    return;
  }

  size_t len = strlen(buffer);
  while (len > 0 && (buffer[len - 1] == '\n' || buffer[len - 1] == '\r')) {
    buffer[len - 1] = '\0';
    len--;
  }
}

static void generate_boot_id(char *boot_id, size_t boot_id_len) {
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof(bytes));
  snprintf(
      boot_id,
      boot_id_len,
      "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
      bytes[0],
      bytes[1],
      bytes[2],
      bytes[3],
      bytes[4],
      bytes[5],
      bytes[6],
      bytes[7],
      bytes[8],
      bytes[9],
      bytes[10],
      bytes[11],
      bytes[12],
      bytes[13],
      bytes[14],
      bytes[15]);
}

esp_err_t playtt_nvs_init(void) {
  esp_err_t err = nvs_flash_init();
  if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    err = nvs_flash_init();
  }
  return err;
}

esp_err_t playtt_nvs_load(playtt_nvs_state_t *state) {
  nvs_handle_t handle;
  esp_err_t err = nvs_open("playtt", NVS_READONLY, &handle);
  if (err != ESP_OK) {
    return err;
  }

  size_t required = sizeof(state->wifi_ssid);
  err = nvs_get_str(handle, "wifi_ssid", state->wifi_ssid, &required);
  if (err != ESP_OK) {
    nvs_close(handle);
    return err;
  }

  required = sizeof(state->wifi_password);
  ESP_ERROR_CHECK(nvs_get_str(handle, "wifi_password", state->wifi_password, &required));

  required = sizeof(state->base_url);
  if (nvs_get_str(handle, "base_url", state->base_url, &required) != ESP_OK) {
    strncpy(state->base_url, PLAYTT_DEFAULT_BASE_URL, sizeof(state->base_url) - 1);
  }

  required = sizeof(state->enrollment_code);
  nvs_get_str(handle, "enroll_code", state->enrollment_code, &required);

  required = sizeof(state->device_id);
  nvs_get_str(handle, "device_id", state->device_id, &required);

  required = sizeof(state->device_secret);
  nvs_get_str(handle, "device_secret", state->device_secret, &required);

  required = sizeof(state->hardware_uid);
  nvs_get_str(handle, "hardware_uid", state->hardware_uid, &required);

  required = sizeof(state->boot_id);
  if (nvs_get_str(handle, "boot_id", state->boot_id, &required) != ESP_OK) {
    generate_boot_id(state->boot_id, sizeof(state->boot_id));
  }

  nvs_get_i32(handle, "cred_version", &state->credential_version);
  nvs_get_i32(handle, "cfg_version", &state->config_version);
  nvs_get_i32(handle, "next_seq", &state->next_sequence);

  uint8_t provisioned = 0;
  nvs_get_u8(handle, "provisioned", &provisioned);
  state->provisioned = provisioned == 1;

  uint8_t setup_complete = 0;
  nvs_get_u8(handle, "setup_done", &setup_complete);
  state->setup_complete = setup_complete == 1;

  if (state->next_sequence <= 0) {
    state->next_sequence = 1;
  }

  nvs_close(handle);
  return ESP_OK;
}

esp_err_t playtt_nvs_save(const playtt_nvs_state_t *state) {
  nvs_handle_t handle;
  esp_err_t err = nvs_open("playtt", NVS_READWRITE, &handle);
  if (err != ESP_OK) {
    return err;
  }

  ESP_ERROR_CHECK(nvs_set_str(handle, "wifi_ssid", state->wifi_ssid));
  ESP_ERROR_CHECK(nvs_set_str(handle, "wifi_password", state->wifi_password));
  ESP_ERROR_CHECK(nvs_set_str(handle, "base_url", state->base_url));
  ESP_ERROR_CHECK(nvs_set_str(handle, "enroll_code", state->enrollment_code));
  ESP_ERROR_CHECK(nvs_set_str(handle, "device_id", state->device_id));
  ESP_ERROR_CHECK(nvs_set_str(handle, "device_secret", state->device_secret));
  ESP_ERROR_CHECK(nvs_set_str(handle, "hardware_uid", state->hardware_uid));
  ESP_ERROR_CHECK(nvs_set_str(handle, "boot_id", state->boot_id));
  ESP_ERROR_CHECK(nvs_set_i32(handle, "cred_version", state->credential_version));
  ESP_ERROR_CHECK(nvs_set_i32(handle, "cfg_version", state->config_version));
  ESP_ERROR_CHECK(nvs_set_i32(handle, "next_seq", state->next_sequence));
  ESP_ERROR_CHECK(nvs_set_u8(handle, "provisioned", state->provisioned ? 1 : 0));
  ESP_ERROR_CHECK(nvs_set_u8(handle, "setup_done", state->setup_complete ? 1 : 0));

  err = nvs_commit(handle);
  nvs_close(handle);
  return err;
}

esp_err_t playtt_nvs_erase_all(void) {
  return nvs_flash_erase();
}

bool playtt_nvs_run_setup_wizard(playtt_nvs_state_t *state) {
  memset(state, 0, sizeof(*state));
  strncpy(state->base_url, PLAYTT_DEFAULT_BASE_URL, sizeof(state->base_url) - 1);
  generate_boot_id(state->boot_id, sizeof(state->boot_id));
  state->next_sequence = 1;

  printf("\n=== PlayTT ESP32 setup ===\n");
  printf("Default API: %s\n\n", PLAYTT_DEFAULT_BASE_URL);

  read_line("Wi-Fi SSID: ", state->wifi_ssid, sizeof(state->wifi_ssid));
  read_line("Wi-Fi password: ", state->wifi_password, sizeof(state->wifi_password));
  read_line("Enrollment code (from theplaytt.com/operator/devices): ",
            state->enrollment_code,
            sizeof(state->enrollment_code));

  char base_url_override[128] = {0};
  read_line("Base URL override (Enter for default): ",
            base_url_override,
            sizeof(base_url_override));
  if (base_url_override[0] != '\0') {
    strncpy(state->base_url, base_url_override, sizeof(state->base_url) - 1);
  }

  read_line("Hardware UID (Enter for auto): ", state->hardware_uid, sizeof(state->hardware_uid));
  if (state->hardware_uid[0] == '\0') {
    snprintf(
        state->hardware_uid,
        sizeof(state->hardware_uid),
        "esp32s3-%08" PRIx32,
        (uint32_t)esp_random());
  }

  if (state->wifi_ssid[0] == '\0' || state->enrollment_code[0] == '\0') {
    ESP_LOGE(TAG, "Wi-Fi SSID and enrollment code are required.");
    return false;
  }

  state->setup_complete = true;
  return true;
}
