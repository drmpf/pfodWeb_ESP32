#ifndef ESP32_PFODAPP_SERVER_H
#define ESP32_PFODAPP_SERVER_H
#include <Arduino.h>
/*   
   ESP32_pfodAppServer.h
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

void ESP32_start_pfodAppServer(const char* version);
void ESP32_handle_pfodAppServer();
void pfodApp_setVersion(const char* version);
#endif
