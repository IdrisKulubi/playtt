#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"
#include "playtt_config.h"
#include "playtt_nvs.h"

typedef struct {
  char boot_id[40];
  int32_t sequence;
  char kind[16];
  char side[4];
  int32_t delta;
} playtt_score_event_t;

typedef struct {
  playtt_score_event_t events[PLAYTT_MAX_EVENT_QUEUE];
  char boot_id[40];
  int head;
  int tail;
  int count;
  int32_t next_sequence;
} playtt_event_buffer_t;

void playtt_buffer_init(playtt_event_buffer_t *buffer,
                        playtt_nvs_state_t *state);
bool playtt_buffer_enqueue(playtt_event_buffer_t *buffer,
                           playtt_nvs_state_t *state,
                           const char *kind,
                           const char *side,
                           int32_t delta,
                           playtt_score_event_t *out_event);
playtt_score_event_t *playtt_buffer_peek(playtt_event_buffer_t *buffer);
void playtt_buffer_ack(playtt_event_buffer_t *buffer);
int playtt_buffer_size(const playtt_event_buffer_t *buffer);
esp_err_t playtt_buffer_flush(playtt_nvs_state_t *state, playtt_event_buffer_t *buffer);
