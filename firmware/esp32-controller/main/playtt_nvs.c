#include "playtt_nvs.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

#include "cJSON.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_random.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "playtt_config.h"

static const char *TAG = "playtt_nvs";

static void copy_str(char *dest, size_t dest_len, const char *src) {
  if (dest_len == 0) return;
  strncpy(dest, src ? src : "", dest_len - 1);
  dest[dest_len - 1] = '\0';
}

static void generate_boot_id(char *boot_id, size_t boot_id_len) {
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof(bytes));
  snprintf(boot_id,
           boot_id_len,
           "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
           bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
}

/* Keep the legacy single-network fields in sync with networks[0]. */
static void sync_primary(playtt_nvs_state_t *state) {
  if (state->network_count > 0) {
    copy_str(state->wifi_ssid, sizeof(state->wifi_ssid), state->networks[0].ssid);
    copy_str(state->wifi_password, sizeof(state->wifi_password), state->networks[0].password);
  } else {
    state->wifi_ssid[0] = '\0';
    state->wifi_password[0] = '\0';
  }
}

void playtt_nvs_board_id(char *out, size_t out_len) {
  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  snprintf(out, out_len, "%02x%02x%02x", mac[3], mac[4], mac[5]);
}

esp_err_t playtt_nvs_init(void) {
  esp_err_t err = nvs_flash_init();
  if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    err = nvs_flash_init();
  }
  return err;
}

static void load_networks(nvs_handle_t handle, playtt_nvs_state_t *state) {
  state->network_count = 0;

  size_t required = 0;
  if (nvs_get_str(handle, "wifi_list", NULL, &required) == ESP_OK && required > 1 && required < 2048) {
    char buffer[2048];
    if (nvs_get_str(handle, "wifi_list", buffer, &required) == ESP_OK) {
      cJSON *root = cJSON_Parse(buffer);
      cJSON *item = NULL;
      cJSON_ArrayForEach(item, root) {
        if (state->network_count >= PLAYTT_MAX_NETWORKS) break;
        cJSON *ssid = cJSON_GetObjectItem(item, "s");
        cJSON *password = cJSON_GetObjectItem(item, "p");
        if (!cJSON_IsString(ssid) || ssid->valuestring[0] == '\0') continue;
        playtt_network_t *network = &state->networks[state->network_count++];
        copy_str(network->ssid, sizeof(network->ssid), ssid->valuestring);
        copy_str(network->password, sizeof(network->password),
                 cJSON_IsString(password) ? password->valuestring : "");
      }
      cJSON_Delete(root);
    }
  }

  /* Devices set up before multi-network support only have the legacy keys. */
  if (state->network_count == 0) {
    char ssid[33] = {0};
    char password[65] = {0};
    size_t len = sizeof(ssid);
    if (nvs_get_str(handle, "wifi_ssid", ssid, &len) == ESP_OK && ssid[0] != '\0') {
      len = sizeof(password);
      nvs_get_str(handle, "wifi_password", password, &len);
      copy_str(state->networks[0].ssid, sizeof(state->networks[0].ssid), ssid);
      copy_str(state->networks[0].password, sizeof(state->networks[0].password), password);
      state->network_count = 1;
    }
  }

  sync_primary(state);
}

esp_err_t playtt_nvs_load(playtt_nvs_state_t *state) {
  memset(state, 0, sizeof(*state));
  copy_str(state->base_url, sizeof(state->base_url), PLAYTT_DEFAULT_BASE_URL);
  state->next_sequence = 1;

  nvs_handle_t handle;
  esp_err_t err = nvs_open("playtt", NVS_READONLY, &handle);
  if (err != ESP_OK) {
    generate_boot_id(state->boot_id, sizeof(state->boot_id));
    return err;
  }

  load_networks(handle, state);

  size_t required = sizeof(state->base_url);
  if (nvs_get_str(handle, "base_url", state->base_url, &required) != ESP_OK || state->base_url[0] == '\0') {
    copy_str(state->base_url, sizeof(state->base_url), PLAYTT_DEFAULT_BASE_URL);
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

  uint8_t flag = 0;
  nvs_get_u8(handle, "provisioned", &flag);
  state->provisioned = flag == 1;
  flag = 0;
  nvs_get_u8(handle, "setup_done", &flag);
  state->setup_complete = flag == 1;

  if (state->next_sequence <= 0) {
    state->next_sequence = 1;
  }

  nvs_close(handle);
  return ESP_OK;
}

static esp_err_t save_networks(nvs_handle_t handle, const playtt_nvs_state_t *state) {
  cJSON *list = cJSON_CreateArray();
  for (int i = 0; i < state->network_count; i += 1) {
    cJSON *item = cJSON_CreateObject();
    cJSON_AddStringToObject(item, "s", state->networks[i].ssid);
    cJSON_AddStringToObject(item, "p", state->networks[i].password);
    cJSON_AddItemToArray(list, item);
  }
  char *encoded = cJSON_PrintUnformatted(list);
  esp_err_t err = nvs_set_str(handle, "wifi_list", encoded ? encoded : "[]");
  cJSON_free(encoded);
  cJSON_Delete(list);
  return err;
}

esp_err_t playtt_nvs_save(const playtt_nvs_state_t *state) {
  nvs_handle_t handle;
  esp_err_t err = nvs_open("playtt", NVS_READWRITE, &handle);
  if (err != ESP_OK) {
    return err;
  }

  ESP_ERROR_CHECK(save_networks(handle, state));
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

esp_err_t playtt_nvs_begin_boot(playtt_nvs_state_t *state) {
  generate_boot_id(state->boot_id, sizeof(state->boot_id));
  state->next_sequence = 1;
  ESP_LOGI(TAG, "new boot %s sequence=1", state->boot_id);
  return playtt_nvs_save(state);
}

esp_err_t playtt_nvs_erase_all(void) {
  return nvs_flash_erase();
}

void playtt_nvs_set_networks(playtt_nvs_state_t *state, const playtt_network_t *networks, int count) {
  if (count > PLAYTT_MAX_NETWORKS) count = PLAYTT_MAX_NETWORKS;
  state->network_count = 0;
  for (int i = 0; i < count; i += 1) {
    if (networks[i].ssid[0] == '\0') continue;
    playtt_network_t *dest = &state->networks[state->network_count++];
    copy_str(dest->ssid, sizeof(dest->ssid), networks[i].ssid);
    copy_str(dest->password, sizeof(dest->password), networks[i].password);
  }
  sync_primary(state);
}

void playtt_nvs_prepare_registration(playtt_nvs_state_t *state,
                                     const char *enrollment_code,
                                     const char *base_url) {
  copy_str(state->enrollment_code, sizeof(state->enrollment_code), enrollment_code);
  if (base_url && base_url[0] != '\0') {
    copy_str(state->base_url, sizeof(state->base_url), base_url);
  }

  /* A new registration is a new device record server-side; old credentials are discarded. */
  state->device_id[0] = '\0';
  state->device_secret[0] = '\0';
  state->credential_version = 0;
  state->config_version = 0;
  state->provisioned = false;

  /* hardware_uid must be unique per registration, so mix the board id with a random suffix. */
  char board[8] = {0};
  playtt_nvs_board_id(board, sizeof(board));
  snprintf(state->hardware_uid, sizeof(state->hardware_uid), "esp32s3-%s-%04" PRIx32, board,
           (uint32_t)(esp_random() & 0xffff));

  state->setup_complete = state->network_count > 0 && state->enrollment_code[0] != '\0';
}
