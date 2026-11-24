#include "playtt_serial.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

#include "cJSON.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "playtt_config.h"
#include "playtt_net.h"
#include "playtt_status.h"

static const char *TAG = "playtt_serial";

#define LINE_MAX_LEN 1024

typedef enum {
  PROMPT_NONE = 0,
  PROMPT_WIFI_SSID,
  PROMPT_WIFI_PASSWORD,
  PROMPT_SETUP_SSID,
  PROMPT_SETUP_PASSWORD,
  PROMPT_SETUP_CODE,
} prompt_t;

static const playtt_nvs_state_t *s_live_state = NULL;
static QueueHandle_t s_hotkeys = NULL;
static prompt_t s_prompt = PROMPT_NONE;
static playtt_network_t s_pending_network;

/* ---------- replies ---------- */

static void reply(cJSON *root) {
  char *encoded = cJSON_PrintUnformatted(root);
  if (encoded) {
    printf("\n@@PLAYTT %s\n", encoded);
    fflush(stdout);
    cJSON_free(encoded);
  }
  cJSON_Delete(root);
}

static void reply_result(const char *type, bool ok, const char *message) {
  cJSON *root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "type", type);
  cJSON_AddBoolToObject(root, "ok", ok);
  if (message) cJSON_AddStringToObject(root, "message", message);
  reply(root);
}

static void restart_soon(void) {
  vTaskDelay(pdMS_TO_TICKS(400));
  esp_restart();
}

/* ---------- commands ---------- */

static void handle_info(void) {
  const playtt_nvs_state_t *state = s_live_state;
  playtt_net_status_t net;
  playtt_net_get_status(&net);
  char board[8] = {0};
  playtt_nvs_board_id(board, sizeof(board));

  cJSON *root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "type", "info");
  cJSON_AddStringToObject(root, "firmware", PLAYTT_FIRMWARE_VERSION);
  cJSON_AddStringToObject(root, "board", board);
  cJSON_AddStringToObject(root, "stage", playtt_stage_name(g_playtt_status.stage));
  cJSON_AddStringToObject(root, "lastError", g_playtt_status.last_error);
  cJSON_AddBoolToObject(root, "hotspot", g_playtt_status.hotspot_active);
  cJSON_AddNumberToObject(root, "uptimeSeconds", (double)(esp_timer_get_time() / 1000000));

  if (state) {
    cJSON_AddBoolToObject(root, "setupComplete", state->setup_complete);
    cJSON_AddBoolToObject(root, "registered", state->provisioned);
    cJSON_AddStringToObject(root, "deviceId", state->device_id);
    cJSON_AddStringToObject(root, "hardwareUid", state->hardware_uid);
    cJSON_AddStringToObject(root, "server", state->base_url);
    /* Network names only: saved passwords are never sent back out. */
    cJSON *networks = cJSON_AddArrayToObject(root, "networks");
    for (int i = 0; i < state->network_count; i += 1) {
      cJSON_AddItemToArray(networks, cJSON_CreateString(state->networks[i].ssid));
    }
  }

  cJSON *wifi = cJSON_AddObjectToObject(root, "wifi");
  cJSON_AddBoolToObject(wifi, "connected", net.connected);
  cJSON_AddStringToObject(wifi, "ssid", net.ssid);
  if (net.connected) {
    cJSON_AddNumberToObject(wifi, "rssi", net.rssi);
    cJSON_AddStringToObject(wifi, "ip", net.ip);
  }

  int64_t last_ok = g_playtt_status.last_heartbeat_ok_ms;
  if (last_ok > 0) {
    cJSON_AddNumberToObject(root, "secondsSinceHeartbeat", (double)((esp_timer_get_time() / 1000 - last_ok) / 1000));
  }
  reply(root);
}

static void handle_scan(void) {
  playtt_scan_result_t results[12];
  int count = playtt_net_scan(results, 12);
  cJSON *root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "type", "scan");
  cJSON *list = cJSON_AddArrayToObject(root, "networks");
  for (int i = 0; i < count; i += 1) {
    cJSON *item = cJSON_CreateObject();
    cJSON_AddStringToObject(item, "ssid", results[i].ssid);
    cJSON_AddNumberToObject(item, "rssi", results[i].rssi);
    cJSON_AddBoolToObject(item, "secure", results[i].secure);
    cJSON_AddItemToArray(list, item);
  }
  reply(root);
}

/* Reads [{"ssid","password"}...] into `out`; returns count, or -1 if invalid. */
static int parse_networks(cJSON *array, playtt_network_t *out) {
  if (!cJSON_IsArray(array)) return -1;
  int count = 0;
  cJSON *item = NULL;
  cJSON_ArrayForEach(item, array) {
    if (count >= PLAYTT_MAX_NETWORKS) break;
    cJSON *ssid = cJSON_GetObjectItem(item, "ssid");
    cJSON *password = cJSON_GetObjectItem(item, "password");
    if (!cJSON_IsString(ssid) || ssid->valuestring[0] == '\0' || strlen(ssid->valuestring) > 32) continue;
    const char *pass = cJSON_IsString(password) ? password->valuestring : "";
    if (strlen(pass) > 64 || (strlen(pass) > 0 && strlen(pass) < 8)) return -1;
    memset(&out[count], 0, sizeof(out[count]));
    strncpy(out[count].ssid, ssid->valuestring, sizeof(out[count].ssid) - 1);
    strncpy(out[count].password, pass, sizeof(out[count].password) - 1);
    count += 1;
  }
  return count;
}

static void handle_set_wifi(cJSON *root) {
  playtt_network_t networks[PLAYTT_MAX_NETWORKS];
  int count = parse_networks(cJSON_GetObjectItem(root, "networks"), networks);
  if (count <= 0) {
    reply_result("set_wifi", false, "Send 1-3 networks. Passwords must be 8-64 characters, or empty for open Wi-Fi.");
    return;
  }

  playtt_nvs_state_t state;
  playtt_nvs_load(&state);
  playtt_nvs_set_networks(&state, networks, count);
  if (playtt_nvs_save(&state) != ESP_OK) {
    reply_result("set_wifi", false, "Could not save to flash.");
    return;
  }
  reply_result("set_wifi", true, "Saved. Restarting to connect.");
  restart_soon();
}

static void handle_register(cJSON *root) {
  cJSON *code = cJSON_GetObjectItem(root, "enrollmentCode");
  if (!cJSON_IsString(code) || code->valuestring[0] == '\0' || strlen(code->valuestring) >= 64) {
    reply_result("register", false, "An enrollment code is required.");
    return;
  }

  playtt_nvs_state_t state;
  playtt_nvs_load(&state);

  cJSON *networks_json = cJSON_GetObjectItem(root, "networks");
  if (networks_json) {
    playtt_network_t networks[PLAYTT_MAX_NETWORKS];
    int count = parse_networks(networks_json, networks);
    if (count <= 0) {
      reply_result("register", false, "Wi-Fi details are invalid.");
      return;
    }
    playtt_nvs_set_networks(&state, networks, count);
  }
  if (state.network_count == 0) {
    reply_result("register", false, "Add a Wi-Fi network first.");
    return;
  }

  cJSON *server = cJSON_GetObjectItem(root, "server");
  const char *base_url = cJSON_IsString(server) && strncmp(server->valuestring, "http", 4) == 0 &&
                                 strlen(server->valuestring) < sizeof(state.base_url)
                             ? server->valuestring
                             : NULL;
  playtt_nvs_prepare_registration(&state, code->valuestring, base_url);

  if (playtt_nvs_save(&state) != ESP_OK) {
    reply_result("register", false, "Could not save to flash.");
    return;
  }

  cJSON *ack = cJSON_CreateObject();
  cJSON_AddStringToObject(ack, "type", "register");
  cJSON_AddBoolToObject(ack, "ok", true);
  cJSON_AddStringToObject(ack, "hardwareUid", state.hardware_uid);
  cJSON_AddStringToObject(ack, "message", "Saved. Restarting to register.");
  reply(ack);
  restart_soon();
}

static void handle_json(const char *line) {
  cJSON *root = cJSON_Parse(line);
  cJSON *cmd = root ? cJSON_GetObjectItem(root, "cmd") : NULL;
  if (!cJSON_IsString(cmd)) {
    reply_result("error", false, "Expected {\"cmd\": ...}");
    cJSON_Delete(root);
    return;
  }

  const char *name = cmd->valuestring;
  if (strcmp(name, "info") == 0) {
    handle_info();
  } else if (strcmp(name, "scan") == 0) {
    handle_scan();
  } else if (strcmp(name, "set_wifi") == 0) {
    handle_set_wifi(root);
  } else if (strcmp(name, "register") == 0) {
    handle_register(root);
  } else if (strcmp(name, "reboot") == 0) {
    reply_result("reboot", true, NULL);
    restart_soon();
  } else if (strcmp(name, "forget") == 0) {
    playtt_nvs_erase_all();
    reply_result("forget", true, "All settings erased. Restarting.");
    restart_soon();
  } else {
    reply_result("error", false, "Unknown command.");
  }
  cJSON_Delete(root);
}

/* ---------- human prompts ---------- */

static void prompt(const char *text, prompt_t next) {
  s_prompt = next;
  printf("%s", text);
  fflush(stdout);
}

static void handle_prompt_answer(const char *line) {
  switch (s_prompt) {
    case PROMPT_WIFI_SSID:
    case PROMPT_SETUP_SSID:
      if (line[0] == '\0') {
        printf("Cancelled.\n");
        s_prompt = PROMPT_NONE;
        return;
      }
      memset(&s_pending_network, 0, sizeof(s_pending_network));
      strncpy(s_pending_network.ssid, line, sizeof(s_pending_network.ssid) - 1);
      prompt("Wi-Fi password: ", s_prompt == PROMPT_WIFI_SSID ? PROMPT_WIFI_PASSWORD : PROMPT_SETUP_PASSWORD);
      return;

    case PROMPT_WIFI_PASSWORD: {
      strncpy(s_pending_network.password, line, sizeof(s_pending_network.password) - 1);
      playtt_nvs_state_t state;
      playtt_nvs_load(&state);
      /* New network first; keep the others as fallbacks. */
      playtt_network_t networks[PLAYTT_MAX_NETWORKS];
      int count = 0;
      networks[count++] = s_pending_network;
      for (int i = 0; i < state.network_count && count < PLAYTT_MAX_NETWORKS; i += 1) {
        if (strcmp(state.networks[i].ssid, s_pending_network.ssid) != 0) networks[count++] = state.networks[i];
      }
      playtt_nvs_set_networks(&state, networks, count);
      playtt_nvs_save(&state);
      s_prompt = PROMPT_NONE;
      printf("\nWi-Fi saved. Restarting...\n");
      restart_soon();
      return;
    }

    case PROMPT_SETUP_PASSWORD:
      strncpy(s_pending_network.password, line, sizeof(s_pending_network.password) - 1);
      prompt("Enrollment code (from theplaytt.com > Devices > Add device): ", PROMPT_SETUP_CODE);
      return;

    case PROMPT_SETUP_CODE: {
      if (line[0] == '\0') {
        printf("Cancelled.\n");
        s_prompt = PROMPT_NONE;
        return;
      }
      playtt_nvs_state_t state;
      playtt_nvs_load(&state);
      playtt_nvs_set_networks(&state, &s_pending_network, 1);
      playtt_nvs_prepare_registration(&state, line, NULL);
      playtt_nvs_save(&state);
      s_prompt = PROMPT_NONE;
      printf("\nSaved. Restarting to register...\n");
      restart_soon();
      return;
    }

    case PROMPT_NONE:
    default:
      return;
  }
}

static void handle_text(const char *line) {
  if (strcmp(line, "setup") == 0) {
    printf("\n=== PlayTT setup ===\n");
    prompt("Wi-Fi name (2.4 GHz): ", PROMPT_SETUP_SSID);
  } else if (strcmp(line, "info") == 0) {
    handle_info();
  } else if (line[0] != '\0') {
    printf("Commands: setup, info. Shortcuts: a, b, u, g, w.\n");
  }
}

/* ---------- reader task ---------- */

static void serial_task(void *arg) {
  (void)arg;
  static char line[LINE_MAX_LEN];
  size_t len = 0;

  while (true) {
    int ch = getchar();
    if (ch == EOF) {
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }

    if (ch == '\r' || ch == '\n') {
      if (len == 0 && s_prompt == PROMPT_NONE) continue;
      line[len] = '\0';
      if (s_prompt != PROMPT_NONE) {
        handle_prompt_answer(line);
      } else if (line[0] == '{') {
        handle_json(line);
      } else {
        handle_text(line);
      }
      len = 0;
      continue;
    }

    /* Single-key shortcuts only when nothing else is being typed. */
    if (len == 0 && s_prompt == PROMPT_NONE) {
      char lower = (char)tolower(ch);
      if (lower == 'a' || lower == 'b' || lower == 'u' || lower == 'g') {
        if (s_hotkeys) xQueueSend(s_hotkeys, &lower, 0);
        continue;
      }
      if (lower == 'w') {
        printf("\n=== Change Wi-Fi (registration is kept) ===\n");
        prompt("New Wi-Fi name (2.4 GHz): ", PROMPT_WIFI_SSID);
        continue;
      }
    }

    if (len < LINE_MAX_LEN - 1) {
      line[len++] = (char)ch;
    } else {
      ESP_LOGW(TAG, "Input line too long; discarded.");
      len = 0;
    }
  }
}

void playtt_serial_start(const playtt_nvs_state_t *live_state) {
  s_live_state = live_state;
  s_hotkeys = xQueueCreate(8, sizeof(char));
  xTaskCreate(serial_task, "playtt_serial", 8192, NULL, 4, NULL);
}

bool playtt_serial_take_hotkey(char *key) {
  return s_hotkeys && xQueueReceive(s_hotkeys, key, 0) == pdTRUE;
}
