#ifndef ESP32_PFOD_WEB_SERVER_H
#define ESP32_PFOD_WEB_SERVER_H

#include <Arduino.h>
/*   
   ESP32_pfodWebServer.h
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

void ESP32_start_pfodWebServer(const char* version); // call this from startup()
void ESP32_handle_pfodWebServer();  // call this each loop()
void pfodWeb_setVersion(const char* version);
#endif
