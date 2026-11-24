#include "playtt_net.h"

#include <string.h>
#include <time.h>

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/semphr.h"
#include "lwip/apps/sntp.h"

static const char *TAG = "playtt_net";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_CONNECT_TIMEOUT_PER_NETWORK_MS 15000

static EventGroupHandle_t s_wifi_event_group;
static SemaphoreHandle_t s_wifi_lock;
static esp_netif_t *s_sta_netif = NULL;
static esp_netif_t *s_ap_netif = NULL;
static volatile bool s_connected = false;
static bool s_net_initialized = false;
static bool s_wifi_started = false;
static bool s_sntp_started = false;
/* Off until a network is configured, so an empty config doesn't spin reconnects. */
static volatile bool s_auto_reconnect = false;
static char s_current_ssid[33] = {0};

static void wifi_event_handler(void *arg,
                               esp_event_base_t event_base,
                               int32_t event_id,
                               void *event_data) {
  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
    if (s_auto_reconnect) esp_wifi_connect();
  } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
    const wifi_event_sta_disconnected_t *disc = (const wifi_event_sta_disconnected_t *)event_data;
    if (s_connected) {
      ESP_LOGW(TAG, "Wi-Fi lost (reason=%d), reconnecting...", disc ? disc->reason : -1);
    }
    s_connected = false;
    xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    if (s_auto_reconnect) esp_wifi_connect();
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
  s_wifi_lock = xSemaphoreCreateMutex();
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());
  s_sta_netif = esp_netif_create_default_wifi_sta();

  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&cfg));
  ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));

  ESP_ERROR_CHECK(esp_event_handler_instance_register(
      WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
  ESP_ERROR_CHECK(esp_event_handler_instance_register(
      IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));

  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
  ESP_ERROR_CHECK(esp_wifi_start());
  s_wifi_started = true;

  s_net_initialized = true;
  return ESP_OK;
}

static bool try_network(const playtt_network_t *network) {
  wifi_config_t wifi_config = {0};
  strncpy((char *)wifi_config.sta.ssid, network->ssid, sizeof(wifi_config.sta.ssid) - 1);
  strncpy((char *)wifi_config.sta.password, network->password, sizeof(wifi_config.sta.password) - 1);

  s_auto_reconnect = false;
  esp_wifi_disconnect();
  xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
  s_auto_reconnect = true;

  strncpy(s_current_ssid, network->ssid, sizeof(s_current_ssid) - 1);
  ESP_LOGI(TAG, "Connecting to SSID '%s'...", network->ssid);
  esp_wifi_connect();

  EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
                                         WIFI_CONNECTED_BIT,
                                         pdFALSE,
                                         pdFALSE,
                                         pdMS_TO_TICKS(WIFI_CONNECT_TIMEOUT_PER_NETWORK_MS));
  return (bits & WIFI_CONNECTED_BIT) != 0;
}

esp_err_t playtt_net_connect(const playtt_nvs_state_t *state) {
  if (s_connected) {
    ESP_LOGI(TAG, "wifi ok");
    return ESP_OK;
  }

  if (state->network_count == 0) {
    ESP_LOGE(TAG, "No Wi-Fi saved. Use the admin 'Set up controller' page or the setup hotspot.");
    return ESP_FAIL;
  }

  xSemaphoreTake(s_wifi_lock, portMAX_DELAY);
  bool ok = false;
  for (int i = 0; i < state->network_count && !ok; i += 1) {
    ok = try_network(&state->networks[i]);
    if (!ok) {
      ESP_LOGW(TAG, "Could not join '%s' (check it is 2.4 GHz and the password).", state->networks[i].ssid);
    }
  }
  xSemaphoreGive(s_wifi_lock);

  if (!ok) {
    ESP_LOGE(TAG, "None of the %d saved Wi-Fi network(s) connected.", state->network_count);
    return ESP_FAIL;
  }

  ESP_LOGI(TAG, "wifi ok");
  return ESP_OK;
}

esp_err_t playtt_net_sync_time(void) {
  if (!s_sntp_started) {
    sntp_setoperatingmode(SNTP_OPMODE_POLL);
    sntp_setservername(0, "pool.ntp.org");
    sntp_init();
    s_sntp_started = true;
  }

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

void playtt_net_get_status(playtt_net_status_t *status) {
  memset(status, 0, sizeof(*status));
  status->connected = s_connected;
  strncpy(status->ssid, s_current_ssid, sizeof(status->ssid) - 1);
  if (!s_connected) return;

  wifi_ap_record_t ap = {0};
  if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK) {
    status->rssi = ap.rssi;
    strncpy(status->ssid, (const char *)ap.ssid, sizeof(status->ssid) - 1);
  }
  esp_netif_ip_info_t ip = {0};
  if (s_sta_netif && esp_netif_get_ip_info(s_sta_netif, &ip) == ESP_OK) {
    snprintf(status->ip, sizeof(status->ip), IPSTR, IP2STR(&ip.ip));
  }
}

int playtt_net_scan(playtt_scan_result_t *results, int max_results) {
  if (!s_wifi_started) return 0;

  /* A scan fails while the station is mid-connect, so pause reconnect attempts. */
  xSemaphoreTake(s_wifi_lock, portMAX_DELAY);
  bool was_connected = s_connected;
  if (!was_connected) {
    s_auto_reconnect = false;
    esp_wifi_disconnect();
    vTaskDelay(pdMS_TO_TICKS(200));
  }

  wifi_scan_config_t scan_config = {.show_hidden = false};
  int written = 0;
  if (esp_wifi_scan_start(&scan_config, true) == ESP_OK) {
    uint16_t count = 20;
    wifi_ap_record_t records[20];
    if (esp_wifi_scan_get_ap_records(&count, records) == ESP_OK) {
      for (int i = 0; i < count && written < max_results; i += 1) {
        if (records[i].primary > 14 || records[i].ssid[0] == '\0') continue; /* 2.4 GHz only */
        bool duplicate = false;
        for (int j = 0; j < written; j += 1) {
          if (strcmp(results[j].ssid, (const char *)records[i].ssid) == 0) duplicate = true;
        }
        if (duplicate) continue;
        strncpy(results[written].ssid, (const char *)records[i].ssid, sizeof(results[written].ssid) - 1);
        results[written].ssid[sizeof(results[written].ssid) - 1] = '\0';
        results[written].rssi = records[i].rssi;
        results[written].secure = records[i].authmode != WIFI_AUTH_OPEN;
        written += 1;
      }
    }
  } else {
    ESP_LOGW(TAG, "Wi-Fi scan could not start");
  }

  if (!was_connected) {
    s_auto_reconnect = true;
    esp_wifi_connect();
  }
  xSemaphoreGive(s_wifi_lock);
  return written;
}

esp_err_t playtt_net_enable_ap(const char *ssid) {
  if (!s_ap_netif) {
    s_ap_netif = esp_netif_create_default_wifi_ap();
  }
  wifi_config_t ap_config = {0};
  strncpy((char *)ap_config.ap.ssid, ssid, sizeof(ap_config.ap.ssid) - 1);
  ap_config.ap.ssid_len = strlen(ssid);
  ap_config.ap.channel = 1;
  ap_config.ap.max_connection = 2;
  ap_config.ap.authmode = WIFI_AUTH_OPEN;

  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
  ESP_LOGW(TAG, "Setup hotspot '%s' is on. Join it and open http://192.168.4.1", ssid);
  return ESP_OK;
}
