#include <stdio.h>
#include <string.h>

#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "playtt_api.h"
#include "playtt_buffer.h"
#include "playtt_config.h"
#include "playtt_console.h"
#include "playtt_net.h"
#include "playtt_nvs.h"

static const char *TAG = "playtt_main";

static playtt_nvs_state_t s_state;
static playtt_event_buffer_t s_buffer;
static int64_t s_boot_time_us = 0;
static int64_t s_last_heartbeat_us = 0;
static int64_t s_last_press_a_us = 0;
static int64_t s_last_press_b_us = 0;
static bool s_side_a_down = false;
static bool s_side_b_down = false;
static bool s_boot_down = false;
static bool s_network_ready = false;
static bool s_time_synced = false;

static void led_set(bool on) {
  gpio_set_level(PLAYTT_GPIO_LED, on ? 1 : 0);
}

static void led_blink(void) {
  led_set(true);
  vTaskDelay(pdMS_TO_TICKS(80));
  led_set(false);
}

static bool debounce_side(int64_t *last_press_us) {
  int64_t now = esp_timer_get_time();
  if ((now - *last_press_us) < (PLAYTT_DEBOUNCE_MS * 1000)) {
    return false;
  }
  *last_press_us = now;
  return true;
}

static esp_err_t queue_press(const char *kind, const char *side, int delta) {
  playtt_score_event_t event = {0};
  if (!playtt_buffer_enqueue(&s_buffer, &s_state, kind, side, delta, &event)) {
    return ESP_FAIL;
  }

  ESP_LOGI(TAG, "queued seq=%ld kind=%s side=%s", (long)event.sequence, kind, side);
  led_blink();
  return playtt_buffer_flush(&s_state, &s_buffer);
}

static void handle_serial_input(void) {
  int ch = getchar();
  if (ch == EOF) {
    return;
  }

  if (ch == 'a') {
    queue_press("point", "a", 1);
  } else if (ch == 'b') {
    queue_press("point", "b", 1);
  } else if (ch == 'u') {
    queue_press("correction", "a", -1);
  }
}

static void gpio_init(void) {
  gpio_config_t output = {
      .pin_bit_mask = 1ULL << PLAYTT_GPIO_LED,
      .mode = GPIO_MODE_OUTPUT,
  };
  gpio_config(&output);
  led_set(false);

  gpio_config_t input = {
      .pin_bit_mask =
          (1ULL << PLAYTT_GPIO_SIDE_A) | (1ULL << PLAYTT_GPIO_SIDE_B) | (1ULL << PLAYTT_GPIO_BOOT),
      .mode = GPIO_MODE_INPUT,
      .pull_up_en = GPIO_PULLUP_ENABLE,
      .pull_down_en = GPIO_PULLDOWN_DISABLE,
      .intr_type = GPIO_INTR_DISABLE,
  };
  gpio_config(&input);
}

static void handle_buttons(void) {
  bool side_a = gpio_get_level(PLAYTT_GPIO_SIDE_A) == 0;
  bool side_b = gpio_get_level(PLAYTT_GPIO_SIDE_B) == 0;
  bool boot = gpio_get_level(PLAYTT_GPIO_BOOT) == 0;

  if (side_a && !s_side_a_down && debounce_side(&s_last_press_a_us)) {
    queue_press("point", "a", 1);
  }
  s_side_a_down = side_a;

  if (side_b && !s_side_b_down && debounce_side(&s_last_press_b_us)) {
    queue_press("point", "b", 1);
  }
  s_side_b_down = side_b;

  if (boot && !s_boot_down && debounce_side(&s_last_press_a_us)) {
    queue_press("point", "a", 1);
  }
  s_boot_down = boot;
}

static esp_err_t bootstrap_device(void) {
  if (!s_network_ready) {
    ESP_ERROR_CHECK(playtt_net_init());

    if (playtt_nvs_load(&s_state) != ESP_OK || !s_state.setup_complete) {
      if (!playtt_nvs_run_setup_wizard(&s_state)) {
        return ESP_FAIL;
      }
      ESP_ERROR_CHECK(playtt_nvs_save(&s_state));
    }

    if (playtt_net_connect(&s_state) != ESP_OK) {
      return ESP_FAIL;
    }

    s_network_ready = true;
  }

  if (!s_time_synced) {
    if (playtt_net_sync_time() != ESP_OK) {
      return ESP_FAIL;
    }
    s_time_synced = true;
  }

  if (!s_state.provisioned) {
    if (playtt_api_provision(&s_state) != ESP_OK) {
      return ESP_FAIL;
    }
  }

  if (playtt_api_get_config(&s_state) != ESP_OK) {
    ESP_LOGW(TAG, "Waiting for operator assignment in theplaytt.com dashboard...");
    return ESP_FAIL;
  }
  playtt_buffer_init(&s_buffer, &s_state);

  s_boot_time_us = esp_timer_get_time();
  s_last_heartbeat_us = s_boot_time_us;

  ESP_ERROR_CHECK(playtt_api_heartbeat(
      &s_state, (esp_timer_get_time() - s_boot_time_us) / 1000));

  printf("\nReady. Serial: a=point A, b=point B, u=undo A\n");
  printf("GPIO: %d=A, %d=B, BOOT=%d\n\n", PLAYTT_GPIO_SIDE_A, PLAYTT_GPIO_SIDE_B, PLAYTT_GPIO_BOOT);

  return ESP_OK;
}

void app_main(void) {
  ESP_LOGI(TAG, "PlayTT ESP32-S3 controller %s", PLAYTT_FIRMWARE_VERSION);
  ESP_ERROR_CHECK(playtt_console_init_interactive());
  ESP_ERROR_CHECK(playtt_nvs_init());
  gpio_init();

  while (bootstrap_device() != ESP_OK) {
    ESP_LOGE(TAG, "Setup incomplete. Retrying in 10 seconds...");
    vTaskDelay(pdMS_TO_TICKS(10000));
  }

  while (true) {
    handle_buttons();
    handle_serial_input();

    int64_t now = esp_timer_get_time();
    if ((now - s_last_heartbeat_us) >= (PLAYTT_HEARTBEAT_MS * 1000)) {
      playtt_api_heartbeat(&s_state, (now - s_boot_time_us) / 1000);
      s_last_heartbeat_us = now;
    }

    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
