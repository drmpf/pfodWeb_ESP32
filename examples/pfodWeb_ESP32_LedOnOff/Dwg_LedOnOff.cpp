// Dwg_LedOnOff.cpp  file ==============
// generated by pfodWeb Designer Arduino Export V1.0.0
/*   
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

#include "Dwg_LedOnOff.h"
Dwg_LedOnOff dwg_LedOnOff;
pfodDrawing& mainDwg = dwg_LedOnOff;

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

static unsigned long dwgRefresh = 4000;

// return true if handled else false
// either handle cmd here or in main sketch
bool Dwg_LedOnOff::processDwgCmds() {
// byte dwgCmd = parserPtr->parseDwgCmd(); // pfodParse calls this automagically before calling this method
  if (!(*(parserPtr->getDwgCmd()))) {  // ==> getDwgCmd returned pointer to empty string
    return false; // not dwg cmd, not handled
  }
  if (parserPtr->dwgCmdEquals(cmd_c1)) { // handle touchZone cmd_c1
    parserPtr->printDwgCmdReceived(&Serial); // does nothing if passed NULL
    // add your cmd handling code here
    toggleLed();
    sendUpdate();
    return true;
  }

  // Serial.print("dwgCmd did not match:");Serial.println(cmd_c1);
  return false; // not handled
}

bool Dwg_LedOnOff::sendDwg() {
  if (!parserPtr->cmdEquals(*this)) {
    return false; // not this dwg's loadCmd
  }  // else
  if (parserPtr->isRefresh()) { // refresh just send update
    sendUpdate();
  } else {
    sendFullDrawing();
  }
  return true;
}

// all the indexed items are included here, edit as needed for updates
void Dwg_LedOnOff::sendIndexedItems() {
  if (ledOn) {
    dwgsPtr->rectangle().filled().centered().rounded().idx(idx_1).color(dwgsPtr->LIME).size(18,7).offset(25,12).send();
    dwgsPtr->label().idx(idx_2).color(dwgsPtr->RED).text("Led is On").bold().offset(25,12).center().decimals(2).send();
  } else { // led off  black button white label
    dwgsPtr->rectangle().filled().centered().rounded().idx(idx_1).color(dwgsPtr->BLACK).size(18,7).offset(25,12).send();
    dwgsPtr->label().idx(idx_2).color(dwgsPtr->WHITE).text("Led is Off").bold().offset(25,12).center().decimals(2).send();
  }
}
        
void Dwg_LedOnOff::sendFullDrawing() {
    // Start the drawing
    dwgsPtr->start(50, 25, dwgsPtr->BLUE);
    parserPtr->sendRefreshAndVersion(dwgRefresh); // sets version and refresh time for dwg pfodWeb processes this
    sendIndexedItems(); // send indexed items first so they are available for touchZone accesses        
    dwgsPtr->touchZone().cmd(cmd_c1).centered().size(18,7).offset(25,12).send();
    dwgsPtr->touchAction().cmd(cmd_c1).action(dwgsPtr->rectangle().filled().centered().rounded().idx(idx_1).color(dwgsPtr->GREY).size(17,6).offset(25,12)).send();
    dwgsPtr->end();
}
        
// only indexed items can be sent as an update
// all the indexed items are included here, edit as needed
void Dwg_LedOnOff::sendUpdate() {
    dwgsPtr->startUpdate();
    sendIndexedItems(); // send indexed items first so they are available for touchZone accesses        
    dwgsPtr->end();
}
// ============== end of Dwg_LedOnOff.cpp  file 
