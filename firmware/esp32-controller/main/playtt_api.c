#include "playtt_api.h"

#include <stdio.h>
#include <string.h>

#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "playtt_config.h"

static const char *TAG = "playtt_api";

static char s_request_body[512];
static char s_response_body[PLAYTT_HTTP_BODY_MAX];
static playtt_api_response_t s_work_response;
static char s_url[256];
static char s_auth_header[256];
static char s_last_error_code[48];

const char *playtt_api_last_error_code(void) {
  return s_last_error_code;
}

static void capture_error_code(const char *body) {
  s_last_error_code[0] = '\0';
  if (body == NULL || body[0] == '\0') {
    return;
  }

  cJSON *root = cJSON_Parse(body);
  if (root == NULL) {
    return;
  }

  cJSON *code = cJSON_GetObjectItem(root, "code");
  if (cJSON_IsString(code) && code->valuestring != NULL) {
    strncpy(s_last_error_code, code->valuestring, sizeof(s_last_error_code) - 1);
  }

  cJSON_Delete(root);
}

static esp_err_t http_event_handler(esp_http_client_event_t *evt) {
  static int output_len = 0;

  switch (evt->event_id) {
    case HTTP_EVENT_ON_DATA:
      if (output_len + evt->data_len >= PLAYTT_HTTP_BODY_MAX) {
        return ESP_FAIL;
      }
      memcpy(s_response_body + output_len, evt->data, evt->data_len);
      output_len += evt->data_len;
      s_response_body[output_len] = '\0';
      break;
    case HTTP_EVENT_ON_FINISH:
      output_len = 0;
      break;
    case HTTP_EVENT_DISCONNECTED:
      output_len = 0;
      break;
    default:
      break;
  }

  return ESP_OK;
}

static esp_err_t playtt_api_request(playtt_nvs_state_t *state,
                                    const char *method,
                                    const char *path,
                                    const char *body,
                                    bool authenticated,
                                    playtt_api_response_t *response) {
  snprintf(s_url, sizeof(s_url), "%s%s", state->base_url, path);

  memset(s_response_body, 0, sizeof(s_response_body));
  s_last_error_code[0] = '\0';
  if (response != NULL) {
    memset(response, 0, sizeof(*response));
  }

  esp_http_client_config_t config = {
      .url = s_url,
      .method = strcmp(method, "POST") == 0 ? HTTP_METHOD_POST : HTTP_METHOD_GET,
      .timeout_ms = PLAYTT_HTTP_TIMEOUT_MS,
      .event_handler = http_event_handler,
      .crt_bundle_attach = esp_crt_bundle_attach,
  };

  esp_http_client_handle_t client = esp_http_client_init(&config);
  if (client == NULL) {
    return ESP_FAIL;
  }

  esp_http_client_set_header(client, "Content-Type", "application/json");

  if (authenticated) {
    snprintf(s_auth_header,
             sizeof(s_auth_header),
             "Device %s %s",
             state->device_id,
             state->device_secret);
    esp_http_client_set_header(client, "Authorization", s_auth_header);
  }

  if (body != NULL) {
    esp_http_client_set_post_field(client, body, strlen(body));
  }

  esp_err_t err = esp_http_client_perform(client);
  if (err != ESP_OK) {
    esp_http_client_cleanup(client);
    return err;
  }

  int status = esp_http_client_get_status_code(client);
  if (response != NULL) {
    response->status_code = status;
    strncpy(response->response, s_response_body, sizeof(response->response) - 1);
  }

  esp_http_client_cleanup(client);

  if (status < 200 || status >= 300) {
    capture_error_code(s_response_body);
    ESP_LOGE(TAG, "HTTP %d for %s: %s", status, path, s_response_body);
    return ESP_FAIL;
  }

  return ESP_OK;
}

esp_err_t playtt_api_provision(playtt_nvs_state_t *state) {
  snprintf(s_request_body,
           sizeof(s_request_body),
           "{\"enrollmentCode\":\"%s\",\"hardwareUid\":\"%s\",\"firmwareVersion\":\"%s\"}",
           state->enrollment_code,
           state->hardware_uid,
           PLAYTT_FIRMWARE_VERSION);

  memset(&s_work_response, 0, sizeof(s_work_response));
  esp_err_t err = playtt_api_request(
      state, "POST", "/api/device/v1/provision", s_request_body, false, &s_work_response);
  if (err != ESP_OK) {
    return err;
  }

  cJSON *root = cJSON_Parse(s_work_response.response);
  if (root == NULL) {
    return ESP_FAIL;
  }

  cJSON *data = cJSON_GetObjectItem(root, "data");
  cJSON *device_id = data ? cJSON_GetObjectItem(data, "deviceId") : NULL;
  cJSON *secret = data ? cJSON_GetObjectItem(data, "secret") : NULL;
  cJSON *cred_version = data ? cJSON_GetObjectItem(data, "credentialVersion") : NULL;

  if (!cJSON_IsString(device_id) || !cJSON_IsString(secret)) {
    cJSON_Delete(root);
    return ESP_FAIL;
  }

  strncpy(state->device_id, device_id->valuestring, sizeof(state->device_id) - 1);
  strncpy(state->device_secret, secret->valuestring, sizeof(state->device_secret) - 1);
  state->credential_version =
      cJSON_IsNumber(cred_version) ? cred_version->valueint : 1;
  state->provisioned = true;

  cJSON_Delete(root);
  ESP_LOGI(TAG, "provisioned device %s", state->device_id);
  return playtt_nvs_save(state);
}

esp_err_t playtt_api_get_config(playtt_nvs_state_t *state) {
  memset(&s_work_response, 0, sizeof(s_work_response));
  esp_err_t err =
      playtt_api_request(state, "GET", "/api/device/v1/config", NULL, true, &s_work_response);
  if (err != ESP_OK) {
    return err;
  }

  cJSON *root = cJSON_Parse(s_work_response.response);
  if (root == NULL) {
    return ESP_FAIL;
  }

  cJSON *data = cJSON_GetObjectItem(root, "data");
  cJSON *config_version = data ? cJSON_GetObjectItem(data, "configVersion") : NULL;
  cJSON *role = data ? cJSON_GetObjectItem(data, "role") : NULL;

  if (cJSON_IsNumber(config_version)) {
    state->config_version = config_version->valueint;
    playtt_nvs_save(state);
  }

  ESP_LOGI(TAG,
           "config v%d role=%s",
           state->config_version,
           cJSON_IsString(role) ? role->valuestring : "unknown");

  cJSON_Delete(root);
  return ESP_OK;
}

esp_err_t playtt_api_heartbeat(playtt_nvs_state_t *state, int64_t uptime_ms) {
  snprintf(s_request_body,
           sizeof(s_request_body),
           "{\"bootId\":\"%s\",\"firmwareVersion\":\"%s\",\"uptimeMs\":%lld,"
           "\"appliedConfigVersion\":%ld}",
           state->boot_id,
           PLAYTT_FIRMWARE_VERSION,
           (long long)uptime_ms,
           (long)state->config_version);

  memset(&s_work_response, 0, sizeof(s_work_response));
  esp_err_t err = playtt_api_request(
      state, "POST", "/api/device/v1/heartbeat", s_request_body, true, &s_work_response);
  if (err != ESP_OK) {
    return err;
  }

  ESP_LOGI(TAG, "heartbeat ok");
  return playtt_api_poll_commands(state);
}

esp_err_t playtt_api_poll_commands(playtt_nvs_state_t *state) {
  memset(&s_work_response, 0, sizeof(s_work_response));
  esp_err_t err =
      playtt_api_request(state, "GET", "/api/device/v1/commands", NULL, true, &s_work_response);
  if (err != ESP_OK) {
    return err;
  }

  cJSON *root = cJSON_Parse(s_work_response.response);
  if (root == NULL) {
    return ESP_OK;
  }

  cJSON *data = cJSON_GetObjectItem(root, "data");
  cJSON *commands = data ? cJSON_GetObjectItem(data, "commands") : NULL;
  if (!cJSON_IsArray(commands)) {
    cJSON_Delete(root);
    return ESP_OK;
  }

  cJSON *command = NULL;
  cJSON_ArrayForEach(command, commands) {
    cJSON *id = cJSON_GetObjectItem(command, "id");
    cJSON *attempt_count = cJSON_GetObjectItem(command, "attemptCount");
    if (!cJSON_IsString(id)) {
      continue;
    }

    int attempt = cJSON_IsNumber(attempt_count) ? attempt_count->valueint : 1;
    snprintf(s_request_body,
             sizeof(s_request_body),
             "{\"idempotencyKey\":\"ack:%s:%d\",\"success\":true,"
             "\"result\":{\"appliedConfigVersion\":%ld}}",
             id->valuestring,
             attempt,
             (long)state->config_version);

    char ack_path[128];
    snprintf(ack_path, sizeof(ack_path), "/api/device/v1/commands/%s/ack", id->valuestring);
    playtt_api_request(state, "POST", ack_path, s_request_body, true, NULL);
    ESP_LOGI(TAG, "ack command %s", id->valuestring);
  }

  cJSON_Delete(root);
  return ESP_OK;
}

esp_err_t playtt_api_post_event(playtt_nvs_state_t *state,
                                int32_t sequence,
                                const char *kind,
                                const char *side,
                                int delta,
                                playtt_api_response_t *response) {
  snprintf(s_request_body,
           sizeof(s_request_body),
           "{\"bootId\":\"%s\",\"sequence\":%ld,\"kind\":\"%s\",\"side\":\"%s\",\"delta\":%d}",
           state->boot_id,
           (long)sequence,
           kind,
           side,
           delta);

  esp_err_t err = playtt_api_request(
      state, "POST", "/api/device/v1/events", s_request_body, true, response != NULL ? response : &s_work_response);
  if (err != ESP_OK) {
    return err;
  }

  playtt_api_response_t *parsed = response != NULL ? response : &s_work_response;
  if (parsed->response[0] != '\0') {
    cJSON *root = cJSON_Parse(parsed->response);
    if (root != NULL) {
      cJSON *data = cJSON_GetObjectItem(root, "data");
      cJSON *duplicate = data ? cJSON_GetObjectItem(data, "duplicate") : NULL;
      parsed->duplicate = cJSON_IsTrue(duplicate);
      cJSON_Delete(root);
    }
  }

  state->next_sequence = sequence + 1;
  playtt_nvs_save(state);
  return ESP_OK;
}
