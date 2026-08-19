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
static bool s_scoring_ready = false;
static int s_last_level_a = -1;
static int s_last_level_b = -1;
static int s_last_level_boot = -1;
static int64_t s_last_gpio_diag_us = 0;

static int gpio_level_a(void) {
  return gpio_get_level(PLAYTT_GPIO_SIDE_A);
}

static int gpio_level_b(void) {
  return gpio_get_level(PLAYTT_GPIO_SIDE_B);
}

static int gpio_level_boot(void) {
  return gpio_get_level(PLAYTT_GPIO_BOOT);
}

static void log_gpio_levels(const char *reason) {
  int a = gpio_level_a();
  int b = gpio_level_b();
  int boot = gpio_level_boot();
  ESP_LOGI(TAG,
           "gpio %s A(GPIO%d)=%d %s B(GPIO%d)=%d %s BOOT(GPIO%d)=%d %s",
           reason,
           PLAYTT_GPIO_SIDE_A,
           a,
           a == 0 ? "PRESSED" : "idle",
           PLAYTT_GPIO_SIDE_B,
           b,
           b == 0 ? "PRESSED" : "idle",
           PLAYTT_GPIO_BOOT,
           boot,
           boot == 0 ? "PRESSED" : "idle");
}

static void poll_gpio_diagnostics(void) {
  int a = gpio_level_a();
  int b = gpio_level_b();
  int boot = gpio_level_boot();
  int64_t now = esp_timer_get_time();

  if (a != s_last_level_a || b != s_last_level_b || boot != s_last_level_boot) {
    log_gpio_levels("change");
    s_last_level_a = a;
    s_last_level_b = b;
    s_last_level_boot = boot;
  }

  if ((now - s_last_gpio_diag_us) >= (PLAYTT_GPIO_DIAG_MS * 1000)) {
    log_gpio_levels("poll");
    s_last_gpio_diag_us = now;
  }
}

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

static void gpio_diag_task(void *arg) {
  (void)arg;
  while (true) {
    poll_gpio_diagnostics();
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

static void handle_serial_input(void) {
  int ch = getchar();
  if (ch == EOF) {
    return;
  }

  if (ch == 'g' || ch == 'G') {
    log_gpio_levels("manual");
    return;
  }

  if (!s_scoring_ready) {
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

static void probe_candidate_pins(void) {
  const int pins[] = {4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21};
  printf("\nPin scan (pull-up, nothing should be 0 unless shorted to GND):\n");
  for (unsigned i = 0; i < sizeof(pins) / sizeof(pins[0]); i += 1) {
    int pin = pins[i];
    gpio_reset_pin(pin);
    gpio_set_direction(pin, GPIO_MODE_INPUT);
    gpio_set_pull_mode(pin, GPIO_PULLUP_ONLY);
    vTaskDelay(pdMS_TO_TICKS(2));
    int level = gpio_get_level(pin);
    printf("  GPIO%-2d = %d %s\n", pin, level, level == 0 ? "LOW (shorted or occupied)" : "HIGH (ok)");
  }
  printf("\n");
}

static void gpio_init(void) {
  probe_candidate_pins();

  gpio_reset_pin(PLAYTT_GPIO_SIDE_A);
  gpio_reset_pin(PLAYTT_GPIO_SIDE_B);
  gpio_reset_pin(PLAYTT_GPIO_BOOT);
  gpio_reset_pin(PLAYTT_GPIO_LED);

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

  printf("\nButton test: idle=1  pressed=0\n");
  printf("Red  -> GPIO%d (side A)\n", PLAYTT_GPIO_SIDE_A);
  printf("Blue -> GPIO%d (side B)\n", PLAYTT_GPIO_SIDE_B);
  printf("Hold a button. Type g to dump pin levels.\n\n");
  log_gpio_levels("init");
}

static void handle_buttons(void) {
  bool side_a = gpio_level_a() == 0;
  bool side_b = gpio_level_b() == 0;
  bool boot = gpio_level_boot() == 0;

  if (!s_scoring_ready) {
    s_side_a_down = side_a;
    s_side_b_down = side_b;
    s_boot_down = boot;
    return;
  }

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

    ESP_ERROR_CHECK(playtt_nvs_begin_boot(&s_state));

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

  printf("\nReady. Serial: a=point A, b=point B, u=undo A, g=gpio test\n");
  printf("GPIO: %d=A, %d=B, BOOT=%d\n\n", PLAYTT_GPIO_SIDE_A, PLAYTT_GPIO_SIDE_B, PLAYTT_GPIO_BOOT);
  s_scoring_ready = true;

  return ESP_OK;
}

void app_main(void) {
  ESP_LOGI(TAG, "PlayTT ESP32-S3 controller %s", PLAYTT_FIRMWARE_VERSION);
  ESP_ERROR_CHECK(playtt_console_init_interactive());
  ESP_ERROR_CHECK(playtt_nvs_init());
  gpio_init();
  xTaskCreate(gpio_diag_task, "gpio_diag", 4096, NULL, 5, NULL);

  while (bootstrap_device() != ESP_OK) {
    ESP_LOGE(TAG, "Setup incomplete. Retrying in 10 seconds...");
    for (int i = 0; i < 500; i += 1) {
      handle_buttons();
      handle_serial_input();
      vTaskDelay(pdMS_TO_TICKS(20));
    }
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
