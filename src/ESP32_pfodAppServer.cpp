/*
   ESP32_pfodAppServer.cpp
   (c)2025 Forward Computing and Control Pty. Ltd.
   NSW Australia, www.forward.com.au
   This code is not warranted to be fit for any purpose. You may only use it at your own risk.
   This generated code may be freely used for both private and commercial use
   provided this copyright is maintained.
*/

#include "ESP32_pfodAppServer.h"
#include <pfodParser.h>
// This library needs handle_pfodMainMenu to be defined in the sketch
extern void handle_pfodMainMenu(pfodParser & parser);

// debug control
// see https://www.forward.com.au/pfod/ArduinoProgramming/Serial_IO/index.html  for how to used BufferedOutput
// to prevent your sketch being held up by Serial
// or just used debugPtr = &Serial 
static Print* debugPtr = &Serial; //NULL; // &Serial  // local to this file

#include <WiFi.h>
#include <WiFiClient.h>
// pfodESPBufferedClient included in pfodParser library
#include <pfodESPBufferedClient.h>

pfodParser parser; // always have this one // create a parser with menu version string to handle the pfod messages
void closeConnection(Stream * io);
pfodESPBufferedClient bufferedClient;

static const uint8_t MAX_CLIENTS = 4; // the default MUST BE AT LEAST 1 !!
static WiFiClient clients[MAX_CLIENTS]; // hold the currently open clients
static pfodParser *parserPtrs[MAX_CLIENTS]; // hold the parsers for each client
static pfodESPBufferedClient *bufferedClientPtrs[MAX_CLIENTS]; // hold the parsers for each client

static const int portNo = 4989; // What TCP port to listen on for connections.

static WiFiServer server(portNo);
static WiFiClient client;
static bool serverStarted = false;
static bool parsersInitialized = false;

static void initParsers() {
  if (parsersInitialized) {
    return;
  }
  // always have at least one
  parserPtrs[0] = &parser;
  bufferedClientPtrs[0] = &bufferedClient;

  // fill in the rest
  for (size_t i = 1; i < MAX_CLIENTS; i++) {
    parserPtrs[i] = new pfodParser();
    bufferedClientPtrs[i] = new pfodESPBufferedClient();
  }
  parsersInitialized = true;
}

void pfodApp_setVersion(const char* version) {
  initParsers();
  for (size_t i=0; i< MAX_CLIENTS; i++) {
   parserPtrs[i]->setVersion(version);
  }
}  

void ESP32_start_pfodAppServer(const char* version) {
  if (serverStarted) {
    return;
  }
  pfodApp_setVersion(version); // calls  initParsers();
  // Start the server
  server.begin();
  Serial.println("pfodApp Server started");
  // Print the IP address
  Serial.print(" on ");
  Serial.print(WiFi.localIP());
  Serial.print(":"); debugPtr->println(portNo);
  serverStarted = true;
}

bool validClient(WiFiClient & client) {
  return (client.connected());
}


void ESP32_handle_pfodAppServer() {
  if (!serverStarted) {
    Serial.println("Error: pfodApp server not started.  Call ESP32_start_pfodAppServer() from setup()");
    return;
  }
  if (server.hasClient()) { // new connection
    if (debugPtr) {
      debugPtr->print("new client:");
    }
    bool foundSlot = false;
    size_t i = 0;
    for (; i < MAX_CLIENTS; i++) {
      if (!validClient(clients[i])) { // this space if free
        foundSlot = true;
        clients[i] = server.accept(); // was previously server.available();
        parserPtrs[i]->connect(bufferedClientPtrs[i]->connect(&(clients[i]))); // sets new io stream to read from and write to
        break;
      }
    }
    if (!foundSlot) {
      WiFiClient newClient = server.accept(); // was previously server.available(); // get any new client and close it
      newClient.stop();
      if (debugPtr) {
        debugPtr->println(" NO Slots available");
      }
    } else {
      if (debugPtr) {
        debugPtr->println(i);
      }
    }
  }
  for (size_t i = 0; i < MAX_CLIENTS; i++) {
    if (validClient(clients[i])) {
      handle_pfodMainMenu(*parserPtrs[i]);
    }
  }
}

void closeConnection(Stream * io) {
  if (!io) {
    if (debugPtr) {
      debugPtr->println("closeConnection: Connection stream NULL");
    }
    return;
  }
  if (debugPtr) {
    debugPtr->print("closeConnection:");
  }
  bool foundSlot = false;
  size_t i = 0;
  for (; i < MAX_CLIENTS; i++) {
    if ((parserPtrs[i]->getPfodAppStream() == io) && validClient(clients[i])) {
      foundSlot = true;
      break;
    }
  }
  if (foundSlot) {
    if (debugPtr) {
      debugPtr->println(i);
    }
    // found match
    parserPtrs[i]->closeConnection(); // nulls io stream
    bufferedClientPtrs[i]->stop(); // clears client reference
    clients[i].stop();
  } else {
    if (debugPtr) {
      debugPtr->println(" Connection stream NOT found");
    }
  }
}
