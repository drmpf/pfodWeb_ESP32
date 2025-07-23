/*
   ESP32_pfodWebServer.cpp
   (c)2025 Forward Computing and Control Pty. Ltd.
   NSW Australia, www.forward.com.au
   This code is not warranted to be fit for any purpose. You may only use it at your own risk.
   This generated code may be freely used for both private and commercial use
   provided this copyright is maintained.

*/
#include "ESP32_pfodWebServer.h"
#include <pfodParser.h>
// This library needs handle_pfodMainMenu to be defined in the sketch
extern void handle_pfodMainMenu(pfodParser & parser);

// debug control
// see https://www.forward.com.au/pfod/ArduinoProgramming/Serial_IO/index.html  for how to used BufferedOutput
// to prevent your sketch being held up by Serial
// or just used debugPtr = &Serial
static Print* debugPtr = NULL;  // local to this file

#include <NetworkClient.h>
#include <WebServer.h>
#include "ESP32_LittleFSsupport.h"
#include "pfodStreamString.h" // string class to capture parser json output 

// comment out this line to force reload every time for testing
// otherwise only reloads every 24hrs
#define cacheControlStr "max-age=86400"

static WebServer server(80);
pfodParser webParser;
pfodParser *webParserPtr = &webParser;


static void handleIndex();
static void handle_pfodWeb();
static void handle_pfodWebDebug();
static void printRequestArgs(Print *outPtr);
static void handleNotFound();
static bool loadFromFile(String path);
static void redirect(const char *url);
static void returnOK();
static void returnFail(String msg);
static bool sendHeaderAndTail(String & header, const char*tailPath);

static bool serverStarted = false;

void pfodWeb_setVersion(const char* version) {
  webParser.setVersion(version);
}

// Create a StringPrint object to capture JSON output
pfodStreamString jsonCapture;


//NOTE esp32 server automatically applies urlDecode to args before using names/values
static void handle_pfodWeb_page(bool _debug) {
  if (debugPtr) {
    debugPtr->print("Handling request with "); debugPtr->println(_debug ? "debug true" : "debug false");
  }

  bool isAjaxJsonRequest = false;
  String cmdStr = server.arg("cmd");
  cmdStr.trim();
  if (debugPtr) {
    debugPtr->print("cmdStr:"); debugPtr->println(cmdStr);
  }
  if (!cmdStr.isEmpty()) {
    isAjaxJsonRequest = true;
    if (debugPtr) {
      debugPtr->println("AJAX JSON request detected - returning JSON data");
    }
  }

  if (isAjaxJsonRequest) {
    jsonCapture.clear();
    jsonCapture.splitCmds = false; // don't interfer with | and }
    jsonCapture.print(cmdStr);
    if (debugPtr) {
      debugPtr->print(" parsing msg: '"); debugPtr->print(jsonCapture); debugPtr->println("'");
    }

    // add the json header after the inputMsg.
    // The parser will stop reading at the } terminating the input msg leaving this in the Stream_String
    jsonCapture.println(); jsonCapture.print('{');
    jsonCapture.print('"'); jsonCapture.print("cmd"); jsonCapture.print('"'); jsonCapture.print(':'); jsonCapture.println('[');
    jsonCapture.print('"');

    jsonCapture.splitCmds = true;
    handle_pfodMainMenu(webParser); // capture parser output as json
    jsonCapture.splitCmds = false;

    // close the cmd array
    jsonCapture.println('"');
    jsonCapture.print("]}");

    if (jsonCapture.length() > 0) {
      if (debugPtr) {
        debugPtr->print(" Returning JSON response:- ");
        debugPtr->println(jsonCapture); // print jsonCaptre
      }
      // Send JSON response with proper content type
      server.send(200, "application/json", jsonCapture);
      jsonCapture.clear();
    }

  } else { // Serve pfodWeb.html page for non-cmd requests
    if (_debug) {
      if (debugPtr) {
        debugPtr->println("Browser request detected - serving pfodWebDebug as html");
      }
      String newHeader = "";
      if (!sendHeaderAndTail(newHeader, "/pfodWebDebug.html")) {
        if (debugPtr) {
          debugPtr->println("Failed to load pfodWebDebug.html");
        }
        server.send(500, "text/plain", "pfodWebDebug.html file not found");
      }
    } else {
      if (debugPtr) {
        debugPtr->println("Browser request detected - serving pfodWeb as html");
      }
      String newHeader = "";
      if (!sendHeaderAndTail(newHeader, "/pfodWeb.html")) {
        if (debugPtr) {
          debugPtr->println("Failed to load pfodWeb.html");
        }
        server.send(500, "text/plain", "pfodWeb.html file not found");
      }
    }
  }
}

static void handle_pfodWebDebug() {
  if (debugPtr) {
    debugPtr->println("Handling /pfodWebDebug request");
    printRequestArgs(debugPtr);
  }
  handle_pfodWeb_page(true);
}

//NOTE esp32 server automatically applies urlDecode to args before using names/values
static void handle_pfodWeb() {
  if (debugPtr) {
    debugPtr->println("Handling /pfodWeb request");
    printRequestArgs(debugPtr);
  }
  handle_pfodWeb_page(false);
}

void ESP32_start_pfodWebServer(const char* version) {
  if (serverStarted) {
    return;
  }
  pfodWeb_setVersion(version);
  if (!initializeFS()) {
    Serial.println("LittleFS failed to start.");
    return;
  }
  showLittleFS_size(&Serial); // send to Serial to prevent itermixing with buffered debug
  Serial.println(" LittleFS File list:");
  listDir("/", &Serial);


  server.on("/", HTTP_GET, handleIndex);
  server.on("/index.html", handleIndex); // both GET and POST, to handle redirect after set time
  server.on("/pfodWeb", HTTP_GET, handle_pfodWeb);
  server.on("/pfodWebDebug", HTTP_GET, handle_pfodWebDebug);

  server.onNotFound(handleNotFound);
  (void)(returnOK); // to suppress compiler warning only
  (void)(returnFail); // to suppress compiler warning only
  (void)(redirect);  // to suppress compiler warning only

  server.begin();
  Serial.println("pfodWeb server started");
  serverStarted = true;
  jsonCapture.reserve(4096); // to minimize memory fragmation
  webParser.connect(&jsonCapture); // connect parser to capture output
}

void ESP32_handle_pfodWebServer() {
  if (!serverStarted) {
    Serial.println("Error: pfodWeb server not started.  Call ESP32_start_pfodWebServer() from setup()");
    return;
  }
  server.handleClient();
}

static void redirect(const char *url) {
  if (debugPtr) {
    debugPtr->print("Redirect to: ");    debugPtr->println(url);
  }
  server.sendHeader("Location", url);
  server.send(307);
}

static void returnOK() {
  if (debugPtr) {
    debugPtr->print("Return OK (empty plain text)");    debugPtr->println();
  }
  server.send(200, "text/plain", "");
}

static void returnFail(String msg) {
  msg += "\r\n";
  if (debugPtr) {
    debugPtr->print("Return Fail with msg: ");    debugPtr->println(msg);
  }
  server.send(500, "text/plain", msg);
}

static void printRequestArgs(Print * outPtr) {
  if (!outPtr) {
    return;
  }
  outPtr->print("URI: ");
  outPtr->print(server.uri());
  outPtr->print("   Method: ");
  outPtr->println((server.method() == HTTP_GET) ? "GET" : "POST");
  outPtr->print(" Arguments: ");
  outPtr->println(server.args());
  for (uint8_t i = 0; i < server.args(); i++) {
    outPtr->print(" NAME:");
    outPtr->print(server.argName(i));
    outPtr->print("   VALUE:");
    outPtr->println(server.arg(i));
  }
}

static void handleNotFound() {
  if (loadFromFile(server.uri())) {
    return;
  }
  if (debugPtr) {
    debugPtr->print("File Not found: ");    debugPtr->println(server.uri());
    printRequestArgs(debugPtr);
  }
  String message = "LittleFS \n\n";
  message += "URI: ";
  message += server.uri();
  message += "\nMethod: ";
  message += (server.method() == HTTP_GET) ? "GET" : "POST";
  message += "\nArguments: ";
  message += server.args();
  message += "\n";
  for (uint8_t i = 0; i < server.args(); i++) {
    message += " NAME:" + server.argName(i) + "\n VALUE:" + server.arg(i) + "\n";
  }
  server.send(404, "text/plain", message);
}

static bool sendHeaderAndTail(String & header, const char*tailPath) {
  if (debugPtr) {
    debugPtr->print(" sendHeaderAndTail.  tail File: "); debugPtr->println(tailPath);
    debugPtr->print(" header:"); debugPtr->println(header);
    debugPtr->println(" ======= ");
  }
  File dataFile = LittleFS.open(tailPath);

  if (!dataFile) {
    Serial.print(" Failed to open:"); Serial.println(tailPath);
    return false;
  }

  size_t fileSize = dataFile.size();
  NetworkClient currentClient = server.client();
  server.setContentLength(fileSize + header.length());
  String contentType = "text/html";
  const int code = 200;
  server.send(code, contentType, "");
  size_t headerSent = currentClient.write(header.c_str(), header.length());
  (void)(headerSent);
  size_t dataSent = currentClient.write(dataFile);
  if (dataSent != dataFile.size()) {
    if (debugPtr) {
      debugPtr->print(" Sent less data than expected from file: ");    debugPtr->println(tailPath);
    }
  }
  dataFile.close();
  return true;
}


static void handleIndex() {
  String newHeader = "";
  sendHeaderAndTail(newHeader, "/index.html");
}


// for .css, .js, and static .html .ico etc
static bool loadFromFile(String path) {
  if (debugPtr) {
    debugPtr->print("Load File: ");    debugPtr->println(path);
  }
  String dataType = "text/plain";
  if (path.endsWith("/")) {
    path += "index.html";
  }

  if (path.endsWith(".html")) {
    dataType = "text/html";
  } else if (path.endsWith(".css")) {
    dataType = "text/css";
  } else if (path.endsWith(".js")) {
    dataType = "application/javascript";
  } else if (path.endsWith(".ico")) {
    dataType = "image/x-icon";
  }

  File dataFile = LittleFS.open(path.c_str());

  if (!dataFile) {
    if (debugPtr) {
      debugPtr->print(" Failed to open: ");    debugPtr->println(path);
    }
    return false;
  }

#ifdef cacheControlStr
  server.sendHeader("Cache-Control", cacheControlStr); // 24hrs
#endif
  if (server.streamFile(dataFile, dataType) != dataFile.size()) {
    if (debugPtr) {
      debugPtr->print(" Sent less data than expected from file: ");    debugPtr->println(path);
    }
  }

  dataFile.close();
  return true;
}
