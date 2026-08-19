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
  strncpy(buffer->boot_id, state->boot_id, sizeof(buffer->boot_id) - 1);
  buffer->next_sequence = state->next_sequence > 0 ? state->next_sequence : 1;
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
  strncpy(event.boot_id, state->boot_id, sizeof(event.boot_id) - 1);
  event.sequence = buffer->next_sequence;
  buffer->next_sequence += 1;
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

static void renumber_queued_events(playtt_nvs_state_t *state, playtt_event_buffer_t *buffer) {
  int32_t sequence = 1;
  int index = buffer->head;
  for (int i = 0; i < buffer->count; i += 1) {
    strncpy(buffer->events[index].boot_id, state->boot_id, sizeof(buffer->events[index].boot_id) - 1);
    buffer->events[index].sequence = sequence;
    sequence += 1;
    index = (index + 1) % PLAYTT_MAX_EVENT_QUEUE;
  }
  buffer->next_sequence = sequence;
  state->next_sequence = sequence;
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

    if (strcmp(playtt_api_last_error_code(), "SEQUENCE_GAP") == 0) {
      return ESP_ERR_INVALID_STATE;
    }

    vTaskDelay(pdMS_TO_TICKS(250 * (1 << attempt)));
  }

  return ESP_FAIL;
}

esp_err_t playtt_buffer_flush(playtt_nvs_state_t *state, playtt_event_buffer_t *buffer) {
  bool restarted_sequence = false;

  while (playtt_buffer_size(buffer) > 0) {
    playtt_score_event_t *event = playtt_buffer_peek(buffer);
    if (event == NULL) {
      break;
    }

    esp_err_t err = flush_one(state, event);
    if (err == ESP_ERR_INVALID_STATE) {
      if (restarted_sequence) {
        ESP_LOGE(TAG, "sequence gap persisted after boot reset");
        return ESP_FAIL;
      }

      ESP_LOGW(TAG, "sequence gap; starting a new boot sequence");
      ESP_ERROR_CHECK(playtt_nvs_begin_boot(state));
      strncpy(buffer->boot_id, state->boot_id, sizeof(buffer->boot_id) - 1);
      renumber_queued_events(state, buffer);
      restarted_sequence = true;
      continue;
    }

    if (err != ESP_OK) {
      return err;
    }

    playtt_buffer_ack(buffer);
  }

  return ESP_OK;
}
