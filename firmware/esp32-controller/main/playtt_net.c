#include "playtt_net.h"

#include <string.h>
#include <time.h>

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "lwip/apps/sntp.h"

static const char *TAG = "playtt_net";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_CONNECT_TIMEOUT_MS 30000

static EventGroupHandle_t s_wifi_event_group;
static bool s_connected = false;
static bool s_net_initialized = false;
static bool s_wifi_started = false;

static void wifi_event_handler(void *arg,
                               esp_event_base_t event_base,
                               int32_t event_id,
                               void *event_data) {
  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
    esp_wifi_connect();
  } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
    const wifi_event_sta_disconnected_t *disc = (const wifi_event_sta_disconnected_t *)event_data;
    s_connected = false;
    ESP_LOGW(TAG, "Wi-Fi disconnected, reason=%d, retrying...", disc ? disc->reason : -1);
    esp_wifi_connect();
  } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
    s_connected = true;
    xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
  }
}

esp_err_t playtt_net_init(void) {
  if (s_net_initialized) {
    return ESP_OK;
  }

  s_wifi_event_group = xEventGroupCreate();
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());
  esp_netif_create_default_wifi_sta();

  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&cfg));

  ESP_ERROR_CHECK(esp_event_handler_instance_register(
      WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
  ESP_ERROR_CHECK(esp_event_handler_instance_register(
      IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));

  s_net_initialized = true;
  return ESP_OK;
}

esp_err_t playtt_net_connect(const playtt_nvs_state_t *state) {
  if (s_connected) {
    ESP_LOGI(TAG, "wifi ok");
    return ESP_OK;
  }

  wifi_config_t wifi_config = {0};
  strncpy((char *)wifi_config.sta.ssid, state->wifi_ssid, sizeof(wifi_config.sta.ssid) - 1);
  strncpy((char *)wifi_config.sta.password,
          state->wifi_password,
          sizeof(wifi_config.sta.password) - 1);

  xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);

  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

  if (s_wifi_started) {
    esp_wifi_connect();
  } else {
    ESP_ERROR_CHECK(esp_wifi_start());
    s_wifi_started = true;
  }

  ESP_LOGI(TAG, "Connecting to SSID '%s'...", state->wifi_ssid);

  EventBits_t bits = xEventGroupWaitBits(
      s_wifi_event_group,
      WIFI_CONNECTED_BIT,
      pdFALSE,
      pdFALSE,
      pdMS_TO_TICKS(WIFI_CONNECT_TIMEOUT_MS));

  if ((bits & WIFI_CONNECTED_BIT) == 0) {
    ESP_LOGE(TAG, "Failed to connect to Wi-Fi within %ds", WIFI_CONNECT_TIMEOUT_MS / 1000);
    ESP_LOGE(TAG, "Check SSID/password, use 2.4 GHz Wi-Fi, and router signal strength.");
    return ESP_FAIL;
  }

  ESP_LOGI(TAG, "wifi ok");
  return ESP_OK;
}

esp_err_t playtt_net_sync_time(void) {
  sntp_setoperatingmode(SNTP_OPMODE_POLL);
  sntp_setservername(0, "pool.ntp.org");
  sntp_init();

  for (int attempt = 0; attempt < 20; attempt += 1) {
    time_t now = 0;
    struct tm timeinfo = {0};
    time(&now);
    localtime_r(&now, &timeinfo);

    if (timeinfo.tm_year >= (2024 - 1900)) {
      ESP_LOGI(TAG, "sntp ok");
      return ESP_OK;
    }

    vTaskDelay(pdMS_TO_TICKS(500));
  }

  ESP_LOGE(TAG, "SNTP sync failed");
  return ESP_FAIL;
}

bool playtt_net_is_connected(void) {
  return s_connected;
}
