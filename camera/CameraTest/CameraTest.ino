// ============================================================================
// FaceGuard Firmware — Freenove ESP32-WROVER CAM Board
// Browser shows: button + last captured photo + recognition result
// ============================================================================
// Arduino IDE:
//   Board:     "ESP32 Wrover Module"
//   Partition: "Huge APP (3MB No OTA/1MB SPIFFS)"
// ============================================================================

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>

// ---- EDIT THESE ----
const char* ssid       = "PP Iphone";
const char* password   = "12345678";
const char* backendUrl = "http://172.20.10.2:8000/recognize";
// --------------------

// Freenove ESP32-WROVER CAM pins
#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM   21
#define SIOD_GPIO_NUM   26
#define SIOC_GPIO_NUM   27
#define Y9_GPIO_NUM     35
#define Y8_GPIO_NUM     34
#define Y7_GPIO_NUM     39
#define Y6_GPIO_NUM     36
#define Y5_GPIO_NUM     19
#define Y4_GPIO_NUM     18
#define Y3_GPIO_NUM      5
#define Y2_GPIO_NUM      4
#define VSYNC_GPIO_NUM  25
#define HREF_GPIO_NUM   23
#define PCLK_GPIO_NUM   22

WebServer server(80);
bool captureRequested = false;
String lastResult = "No captures yet.";

// Holds a copy of the last captured JPEG so the browser can display it
uint8_t* lastJpeg    = nullptr;
size_t   lastJpegLen = 0;

void startCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
  config.fb_count     = 2;
  config.grab_mode    = CAMERA_GRAB_LATEST;
  config.fb_location  = CAMERA_FB_IN_PSRAM;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed");
    while (true) delay(1000);
  }
  Serial.println("Camera OK");
}

void captureAndSend() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    lastResult = "ERROR: capture failed";
    Serial.println(lastResult);
    return;
  }
  Serial.printf("Captured %u bytes\n", fb->len);

  // Save a copy for the browser to display later
  if (lastJpeg) { free(lastJpeg); lastJpeg = nullptr; lastJpegLen = 0; }
  lastJpeg = (uint8_t*)ps_malloc(fb->len);
  if (lastJpeg) {
    memcpy(lastJpeg, fb->buf, fb->len);
    lastJpegLen = fb->len;
  }

  WiFiClient client;
  HTTPClient http;
  http.begin(client, backendUrl);
  http.setTimeout(30000);

  String boundary = "----ESP32Boundary";
  String head = "--" + boundary + "\r\n"
              + "Content-Disposition: form-data; name=\"image\"; filename=\"photo.jpg\"\r\n"
              + "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  size_t total = head.length() + fb->len + tail.length();
  uint8_t* body = (uint8_t*)ps_malloc(total);
  if (!body) {
    lastResult = "ERROR: out of memory";
    Serial.println(lastResult);
    esp_camera_fb_return(fb);
    http.end();
    return;
  }
  memcpy(body, head.c_str(), head.length());
  memcpy(body + head.length(), fb->buf, fb->len);
  memcpy(body + head.length() + fb->len, tail.c_str(), tail.length());
  esp_camera_fb_return(fb);

  int code = http.POST(body, total);
  free(body);

  if (code == 200) {
    lastResult = http.getString();
  } else {
    lastResult = "HTTP " + String(code) + ": " + http.errorToString(code);
  }
  Serial.println(lastResult);
  http.end();
}

const char PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FaceGuard</title>
<style>
body{background:#111;color:#eee;font-family:system-ui;text-align:center;padding:2rem;margin:0}
h2{color:#00e5ff;margin-bottom:1rem}
button{background:#00e5ff;color:#111;border:0;padding:1rem 2rem;border-radius:8px;
       font-size:1rem;font-weight:700;cursor:pointer}
img{max-width:95%;border-radius:12px;margin:1rem auto;display:block;border:1px solid #333;
    background:#222;min-height:80px}
pre{background:#222;padding:1rem;border-radius:8px;max-width:600px;margin:1rem auto;
    text-align:left;white-space:pre-wrap;word-break:break-word}
.hint{color:#666;font-size:0.8rem;margin-top:0.4rem}
</style></head><body>
<h2>FaceGuard - ESP32 CAM</h2>
<button onclick="snap()">Capture and Recognize</button>
<p class="hint">Image appears below after a few seconds</p>
<img id="photo" src="/last.jpg" alt="No photo yet">
<pre id="r">Ready.</pre>
<script>
async function snap(){
  document.getElementById('r').textContent='Capturing...';
  await fetch('/trigger');
  setTimeout(refresh, 6000);
}
async function refresh(){
  const r=await fetch('/result');
  document.getElementById('r').textContent=await r.text();
  // Cache-bust so the browser pulls the new image
  document.getElementById('photo').src = '/last.jpg?t=' + Date.now();
}
refresh();
</script></body></html>
)HTML";

void handleRoot() {
  server.sendHeader("Content-Type", "text/html; charset=utf-8");
  server.send_P(200, "text/html", PAGE);
}

void handleTrigger() {
  captureRequested = true;
  server.send(200, "text/plain", "ok");
}

void handleResult() {
  server.send(200, "text/plain", lastResult);
}

void handleLastImage() {
  if (!lastJpeg || lastJpegLen == 0) {
    server.send(404, "text/plain", "No image yet");
    return;
  }
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.sendHeader("Pragma", "no-cache");
  server.sendHeader("Expires", "0");
  server.send_P(200, "image/jpeg", (const char*)lastJpeg, lastJpegLen);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== FaceGuard Freenove WROVER CAM ===");

  startCamera();

  WiFi.begin(ssid, password);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  server.on("/",         handleRoot);
  server.on("/trigger",  handleTrigger);
  server.on("/result",   handleResult);
  server.on("/last.jpg", handleLastImage);
  server.begin();
  Serial.println("Ready.");
}

void loop() {
  server.handleClient();
  if (captureRequested) { captureRequested = false; captureAndSend(); }
  delay(1);
}