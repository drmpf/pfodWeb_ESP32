/*   
   ESP32 basic pfod dwg server
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

#include <WiFi.h>
#include "ESP32_pfodWebServer.h"
#include "ESP32_pfodAppServer.h"

const char version[] = "V1"; // need non blank version for auto refresh

IPAddress staticIP; // use auto assigned ip. NOT recommended
//IPAddress staticIP(10,1,1,100); // use a static IP,
// =================== WiFi settings ===================
const char *ssid = "xxxxx";
const char *password = "xxxxxx";

int ledPin = BUILTIN_LED; //D9 on Dfrobot FireBeetle 2 ESP32-E
bool ledOn = false;

void setLedOn() {
  pinMode(ledPin,OUTPUT);
  digitalWrite(ledPin,HIGH);
  ledOn = true;
}
void setLedOff() {
  pinMode(ledPin,OUTPUT);
  digitalWrite(ledPin,LOW);
  ledOn = false;
}

void toggleLed() {
  if (ledOn) {
    setLedOff();
  } else {
    setLedOn();
  }
}

/**
   sets up WiFi
*/
static void setupWiFi() {
  Serial.print(F("WiFi setup -- "));
  WiFi.mode(WIFI_STA);
  if (((uint32_t)staticIP) != 0) {
    IPAddress gateway(staticIP[0], staticIP[1], staticIP[2], 1); // set gatway to ... 1
    Serial.print(F("Setting gateway to: "));
    Serial.println(gateway);
    IPAddress subnet(255, 255, 255, 0);
    WiFi.config(staticIP, gateway, subnet);
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to ");
  Serial.println(ssid);

  // Wait for connection
  uint8_t i = 0;
  while (WiFi.status() != WL_CONNECTED && i++ < 20) {  //wait 10 seconds
    delay(500);
  }
  if (i == 21) {
    Serial.print("Could not connect to ");
    Serial.println(ssid);
    while (1) {
      delay(500);
    }
  }
  Serial.print("Connected! IP address: ");
  Serial.println(WiFi.localIP());
}


void setup(void) {
  Serial.begin(115200); // set Serial for error msgs
  for (int i = 10; i > 0; i--) {
    Serial.print(i); Serial.print(' ');
    delay(500);
  }
  Serial.println();

  setupWiFi();

  ESP32_start_pfodWebServer(version);
  ESP32_start_pfodAppServer(version);
  Serial.println(" Setup finished.");
}

void loop(void) {
  ESP32_handle_pfodWebServer();
  ESP32_handle_pfodAppServer();
}
