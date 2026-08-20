#include "playtt_console.h"

#include <fcntl.h>
#include <stdio.h>
#include <unistd.h>

#include "driver/usb_serial_jtag.h"
#include "driver/usb_serial_jtag_vfs.h"
#include "esp_err.h"
#include "sdkconfig.h"

esp_err_t playtt_console_init_interactive(void) {
#if CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG
  fflush(stdout);
  fsync(fileno(stdout));

  usb_serial_jtag_vfs_set_rx_line_endings(ESP_LINE_ENDINGS_CR);
  usb_serial_jtag_vfs_set_tx_line_endings(ESP_LINE_ENDINGS_CRLF);

  fcntl(fileno(stdout), F_SETFL, 0);
  fcntl(fileno(stdin), F_SETFL, 0);

  usb_serial_jtag_driver_config_t jtag_config = {
      .tx_buffer_size = 256,
      .rx_buffer_size = 256,
  };

  esp_err_t err = usb_serial_jtag_driver_install(&jtag_config);
  if (err != ESP_OK) {
    return err;
  }

  usb_serial_jtag_vfs_use_driver();
  setvbuf(stdin, NULL, _IONBF, 0);
#endif

  return ESP_OK;
}

void playtt_console_set_nonblocking(void) {
#if CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG
  fcntl(fileno(stdin), F_SETFL, O_NONBLOCK);
#endif
}
