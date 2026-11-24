#include "playtt_portal.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lwip/sockets.h"
#include "playtt_net.h"
#include "playtt_nvs.h"
#include "playtt_status.h"

static const char *TAG = "playtt_portal";
static httpd_handle_t s_server = NULL;

/* ---------- tiny captive DNS: answer every A query with 192.168.4.1 ---------- */

static void dns_task(void *arg) {
  (void)arg;
  int sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
  if (sock < 0) {
    vTaskDelete(NULL);
    return;
  }
  struct sockaddr_in addr = {.sin_family = AF_INET, .sin_port = htons(53), .sin_addr.s_addr = htonl(INADDR_ANY)};
  if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
    close(sock);
    vTaskDelete(NULL);
    return;
  }

  uint8_t buf[512];
  while (true) {
    struct sockaddr_in from;
    socklen_t from_len = sizeof(from);
    int len = recvfrom(sock, buf, sizeof(buf) - 16, 0, (struct sockaddr *)&from, &from_len);
    if (len < 12) continue;

    /* Turn the query into a response with one answer pointing at us. */
    buf[2] = 0x81;           /* QR=1, opcode 0, RD=1 */
    buf[3] = 0x80;           /* RA=1, no error */
    buf[6] = 0x00;
    buf[7] = 0x01;           /* ANCOUNT = 1 */
    buf[8] = buf[9] = buf[10] = buf[11] = 0x00;
    const uint8_t answer[] = {0xC0, 0x0C, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x3C, 0x00, 0x04, 192, 168, 4, 1};
    memcpy(buf + len, answer, sizeof(answer));
    sendto(sock, buf, len + sizeof(answer), 0, (struct sockaddr *)&from, from_len);
  }
}

/* ---------- web pages ---------- */

static const char *PAGE_HEAD =
    "<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
    "<title>PlayTT setup</title><style>"
    "body{font:16px -apple-system,system-ui,sans-serif;margin:0;background:#f2f2f7;color:#111}"
    "main{max-width:420px;margin:0 auto;padding:24px 16px}h1{font-size:28px;margin:8px 0 4px}"
    "p{color:#666;margin:0 0 20px}form{background:#fff;border-radius:14px;padding:4px 16px}"
    "label{display:block;font-size:13px;color:#666;margin:14px 0 6px}"
    "input,select{width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #ddd;border-radius:10px}"
    "button{width:100%;margin:18px 0 14px;padding:13px;border:0;border-radius:12px;background:#0a84ff;color:#fff;font-size:16px;font-weight:600}"
    "</style></head><body><main>";

static esp_err_t send_root(httpd_req_t *req) {
  playtt_scan_result_t results[10];
  int count = playtt_net_scan(results, 10);

  httpd_resp_set_type(req, "text/html");
  httpd_resp_sendstr_chunk(req, PAGE_HEAD);
  httpd_resp_sendstr_chunk(req,
                           "<h1>PlayTT controller</h1><p>Choose the Wi-Fi this score controller should use. "
                           "Only 2.4 GHz networks work.</p><form method=post action=/save>"
                           "<label for=ssid>Network</label><input id=ssid name=ssid list=nets required maxlength=32 "
                           "autocomplete=off><datalist id=nets>");
  for (int i = 0; i < count; i += 1) {
    char option[96];
    /* SSIDs can contain quotes; drop them rather than break the markup. */
    char safe[33];
    int j = 0;
    for (int k = 0; results[i].ssid[k] && j < 32; k += 1) {
      char c = results[i].ssid[k];
      if (c != '"' && c != '<' && c != '>' && c != '&') safe[j++] = c;
    }
    safe[j] = '\0';
    snprintf(option, sizeof(option), "<option value=\"%s\">", safe);
    httpd_resp_sendstr_chunk(req, option);
  }
  httpd_resp_sendstr_chunk(req,
                           "</datalist><label for=pass>Password</label>"
                           "<input id=pass name=pass type=password maxlength=64 autocomplete=off>"
                           "<button type=submit>Save and connect</button></form></main></body></html>");
  return httpd_resp_sendstr_chunk(req, NULL);
}

static void url_decode(char *dest, const char *src, size_t dest_len) {
  size_t j = 0;
  for (size_t i = 0; src[i] && j + 1 < dest_len; i += 1) {
    if (src[i] == '+') {
      dest[j++] = ' ';
    } else if (src[i] == '%' && isxdigit((unsigned char)src[i + 1]) && isxdigit((unsigned char)src[i + 2])) {
      char hex[3] = {src[i + 1], src[i + 2], 0};
      dest[j++] = (char)strtol(hex, NULL, 16);
      i += 2;
    } else {
      dest[j++] = src[i];
    }
  }
  dest[j] = '\0';
}

static void restart_task(void *arg) {
  (void)arg;
  vTaskDelay(pdMS_TO_TICKS(1500));
  esp_restart();
}

static esp_err_t handle_save(httpd_req_t *req) {
  char body[256] = {0};
  int received = httpd_req_recv(req, body, sizeof(body) - 1);
  if (received <= 0) return ESP_FAIL;
  body[received] = '\0';

  char raw[160] = {0};
  playtt_network_t network = {0};
  if (httpd_query_key_value(body, "ssid", raw, sizeof(raw)) == ESP_OK) {
    url_decode(network.ssid, raw, sizeof(network.ssid));
  }
  memset(raw, 0, sizeof(raw));
  if (httpd_query_key_value(body, "pass", raw, sizeof(raw)) == ESP_OK) {
    url_decode(network.password, raw, sizeof(network.password));
  }

  size_t pass_len = strlen(network.password);
  httpd_resp_set_type(req, "text/html");
  httpd_resp_sendstr_chunk(req, PAGE_HEAD);
  if (network.ssid[0] == '\0' || (pass_len > 0 && pass_len < 8)) {
    httpd_resp_sendstr_chunk(req,
                             "<h1>Check the details</h1><p>Enter the network name, and a password of at least 8 "
                             "characters (or none for open Wi-Fi).</p><a href=/>Try again</a></main></body></html>");
    return httpd_resp_sendstr_chunk(req, NULL);
  }

  /* New network first; keep the previous ones as fallbacks. */
  playtt_nvs_state_t state;
  playtt_nvs_load(&state);
  playtt_network_t networks[PLAYTT_MAX_NETWORKS];
  int count = 0;
  networks[count++] = network;
  for (int i = 0; i < state.network_count && count < PLAYTT_MAX_NETWORKS; i += 1) {
    if (strcmp(state.networks[i].ssid, network.ssid) != 0) networks[count++] = state.networks[i];
  }
  playtt_nvs_set_networks(&state, networks, count);
  playtt_nvs_save(&state);
  ESP_LOGI(TAG, "Saved Wi-Fi '%s' from the setup hotspot.", network.ssid);

  httpd_resp_sendstr_chunk(req,
                           "<h1>Saved</h1><p>The controller is restarting and will join the new Wi-Fi. "
                           "You can reconnect your phone to your normal network.</p></main></body></html>");
  httpd_resp_sendstr_chunk(req, NULL);
  xTaskCreate(restart_task, "portal_restart", 2048, NULL, 5, NULL);
  return ESP_OK;
}

/* Any other URL (OS connectivity checks) goes to the form, which triggers the sign-in sheet. */
static esp_err_t handle_redirect(httpd_req_t *req, httpd_err_code_t err) {
  (void)err;
  httpd_resp_set_status(req, "302 Found");
  httpd_resp_set_hdr(req, "Location", "http://192.168.4.1/");
  return httpd_resp_send(req, NULL, 0);
}

esp_err_t playtt_portal_start(void) {
  if (s_server) return ESP_OK;

  char board[8] = {0};
  playtt_nvs_board_id(board, sizeof(board));
  char ssid[32];
  snprintf(ssid, sizeof(ssid), "PlayTT-Setup-%s", board);
  ESP_ERROR_CHECK(playtt_net_enable_ap(ssid));

  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.stack_size = 8192;
  if (httpd_start(&s_server, &config) != ESP_OK) {
    ESP_LOGE(TAG, "Could not start the setup web page.");
    return ESP_FAIL;
  }

  httpd_uri_t root = {.uri = "/", .method = HTTP_GET, .handler = send_root};
  httpd_uri_t save = {.uri = "/save", .method = HTTP_POST, .handler = handle_save};
  httpd_register_uri_handler(s_server, &root);
  httpd_register_uri_handler(s_server, &save);
  httpd_register_err_handler(s_server, HTTPD_404_NOT_FOUND, handle_redirect);

  xTaskCreate(dns_task, "portal_dns", 4096, NULL, 4, NULL);
  g_playtt_status.hotspot_active = true;
  return ESP_OK;
}
