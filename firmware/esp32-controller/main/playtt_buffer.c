#include "playtt_buffer.h"

#include <string.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "playtt_api.h"

static const char *TAG = "playtt_buffer";

void playtt_buffer_init(playtt_event_buffer_t *buffer,
                        playtt_nvs_state_t *state) {
  memset(buffer, 0, sizeof(*buffer));
  strncpy(buffer->events[0].boot_id, state->boot_id, sizeof(buffer->events[0].boot_id) - 1);
  buffer->next_sequence = state->next_sequence;
}

bool playtt_buffer_enqueue(playtt_event_buffer_t *buffer,
                           playtt_nvs_state_t *state,
                           const char *kind,
                           const char *side,
                           int32_t delta,
                           playtt_score_event_t *out_event) {
  if (buffer->count >= PLAYTT_MAX_EVENT_QUEUE) {
    ESP_LOGE(TAG, "event buffer full");
    return false;
  }

  playtt_score_event_t event = {0};
  strncpy(event.boot_id, buffer->events[0].boot_id, sizeof(event.boot_id) - 1);
  event.sequence = buffer->next_sequence;
  buffer->next_sequence += 1;
  state->next_sequence = buffer->next_sequence;
  strncpy(event.kind, kind, sizeof(event.kind) - 1);
  strncpy(event.side, side, sizeof(event.side) - 1);
  event.delta = delta;

  buffer->events[buffer->tail] = event;
  buffer->tail = (buffer->tail + 1) % PLAYTT_MAX_EVENT_QUEUE;
  buffer->count += 1;

  if (out_event != NULL) {
    *out_event = event;
  }

  return true;
}

playtt_score_event_t *playtt_buffer_peek(playtt_event_buffer_t *buffer) {
  if (buffer->count == 0) {
    return NULL;
  }

  return &buffer->events[buffer->head];
}

void playtt_buffer_ack(playtt_event_buffer_t *buffer) {
  if (buffer->count == 0) {
    return;
  }

  buffer->head = (buffer->head + 1) % PLAYTT_MAX_EVENT_QUEUE;
  buffer->count -= 1;
}

int playtt_buffer_size(const playtt_event_buffer_t *buffer) {
  return buffer->count;
}

static esp_err_t flush_one(playtt_nvs_state_t *state, playtt_score_event_t *event) {
  for (int attempt = 0; attempt < 5; attempt += 1) {
    playtt_api_response_t response = {0};
    esp_err_t err = playtt_api_post_event(state,
                                          event->sequence,
                                          event->kind,
                                          event->side,
                                          event->delta,
                                          &response);

    if (err == ESP_OK) {
      ESP_LOGI(TAG,
               "sent seq=%ld kind=%s side=%s duplicate=%s",
               (long)event->sequence,
               event->kind,
               event->side,
               response.duplicate ? "true" : "false");
      return ESP_OK;
    }

    vTaskDelay(pdMS_TO_TICKS(250 * (1 << attempt)));
  }

  return ESP_FAIL;
}

esp_err_t playtt_buffer_flush(playtt_nvs_state_t *state, playtt_event_buffer_t *buffer) {
  while (playtt_buffer_size(buffer) > 0) {
    playtt_score_event_t *event = playtt_buffer_peek(buffer);
    if (event == NULL) {
      break;
    }

    esp_err_t err = flush_one(state, event);
    if (err != ESP_OK) {
      return err;
    }

    playtt_buffer_ack(buffer);
  }

  return ESP_OK;
}
