#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <WebServer.h>

// ---- EDIT THESE THREE LINES ----
const char* ssid = "PP Iphone";                                // ← WiFi SSID
const char* password = "12345678";                             // ← WiFi password
const char* backendUrl = "http://172.20.10.2:8000/recognize";  // ← laptop IP

// XIAO ESP32-S3 Sense camera pins
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 10
#define SIOD_GPIO_NUM 40
#define SIOC_GPIO_NUM 39
#define Y9_GPIO_NUM 48
#define Y8_GPIO_NUM 11
#define Y7_GPIO_NUM 12
#define Y6_GPIO_NUM 14
#define Y5_GPIO_NUM 16
#define Y4_GPIO_NUM 18
#define Y3_GPIO_NUM 17
#define Y2_GPIO_NUM 15
#define VSYNC_GPIO_NUM 38
#define HREF_GPIO_NUM 47
#define PCLK_GPIO_NUM 13

WebServer server(80);
bool captureRequested = false;
String lastResult = "No captures yet. Press the button.";

uint8_t* lastJpeg = nullptr;   // new change
size_t lastJpegLen = 0;        // new change

// Camera setup — tuned for face recognition
void startCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Higher resolution + better JPEG quality = faces more findable
  config.frame_size = FRAMESIZE_UXGA;  // 1600x1200 (was SVGA 800x600)
  config.jpeg_quality = 10;            // lower = better (was 12)
  config.fb_count = 2;                 // double buffer for stable captures
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    while (true) delay(1000);
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);     // -2 to 2, slight lift
    s->set_contrast(s, 0);       // -2 to 2
    s->set_saturation(s, 0);     // -2 to 2
    s->set_whitebal(s, 1);       // auto white balance ON
    s->set_awb_gain(s, 1);       // auto white balance gain ON
    s->set_wb_mode(s, 0);        // 0=auto, 1=sunny, 2=cloudy, 3=office, 4=home
    s->set_exposure_ctrl(s, 1);  // auto exposure ON
    s->set_aec2(s, 1);           // better low-light exposure algorithm
    s->set_gain_ctrl(s, 1);      // auto gain ON
    s->set_bpc(s, 1);            // bad pixel correction
    s->set_wpc(s, 1);            // white pixel correction
    s->set_lenc(s, 1);           // lens correction
    s->set_hmirror(s, 0);        // set to 1 if your mounting has the camera flipped
    s->set_vflip(s, 0);          // set to 1 if upside down
  }

  Serial.println("Camera OK (UXGA, quality 10, sensor tuned).");
}

// Capture + send to laptop
void captureAndSend() {
  // Drop 2 stale frames so auto-exposure can settle
  for (int i = 0; i < 2; i++) {
    camera_fb_t* stale = esp_camera_fb_get();
    if (stale) esp_camera_fb_return(stale);
  }

  // Grab fresh
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    lastResult = "ERROR: camera capture failed";
    Serial.println(lastResult);
    return;
  }
  Serial.printf("Captured %u bytes, sending to backend...\n", fb->len);

  if (lastJpeg) {               // new change
    free(lastJpeg);             // new change
    lastJpeg = nullptr;         // new change
    lastJpegLen = 0;            // new change
  }                             // new change

  lastJpeg = (uint8_t*)malloc(fb->len);   // new change
  if (lastJpeg) {                         // new change
    memcpy(lastJpeg, fb->buf, fb->len);   // new change
    lastJpegLen = fb->len;                // new change
  }                                       // new change

  WiFiClient client;
  HTTPClient http;

  if (!http.begin(client, backendUrl)) {
    lastResult = "ERROR: http.begin failed";
    Serial.println(lastResult);
    esp_camera_fb_return(fb);
    return;
  }
  http.setConnectTimeout(5000);
  http.setTimeout(30000);  // bumped for larger UXGA uploads

  // Build multipart body
  String boundary = "----XIAOBoundary";
  String bodyStart = "--" + boundary + "\r\n"
                     + "Content-Disposition: form-data; name=\"image\"; filename=\"photo.jpg\"\r\n"
                     + "Content-Type: image/jpeg\r\n\r\n";
  String bodyEnd = "\r\n--" + boundary + "--\r\n";

  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  size_t totalLen = bodyStart.length() + fb->len + bodyEnd.length();
  uint8_t* body = (uint8_t*)ps_malloc(totalLen);
  if (!body) {
    lastResult = "ERROR: out of memory";
    Serial.println(lastResult);
    esp_camera_fb_return(fb);
    http.end();
    return;
  }

  memcpy(body, bodyStart.c_str(), bodyStart.length());
  memcpy(body + bodyStart.length(), fb->buf, fb->len);
  memcpy(body + bodyStart.length() + fb->len, bodyEnd.c_str(), bodyEnd.length());
  esp_camera_fb_return(fb);

  int code = http.POST(body, totalLen);
  free(body);

  Serial.printf("HTTP %d\n", code);
  if (code == 200) {
    lastResult = http.getString();
    Serial.println("Response: " + lastResult);
  } else if (code > 0) {
    lastResult = "Server error " + String(code) + ": " + http.getString();
    Serial.println(lastResult);
  } else {
    lastResult = "Connection failed: " + http.errorToString(code);
    Serial.println(lastResult);
  }

  http.end();
}

const char PAGE[] PROGMEM = R"=====(
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta charset="utf-8">
<title>FaceGuard — XIAO</title>
<style>
body{background:#0d0f12;color:#cdd6e8;font-family:system-ui;text-align:center;padding:2rem;margin:0}
h2{color:#00e5ff}
button{background:#00e5ff;color:#0d0f12;border:0;padding:1rem 2rem;border-radius:8px;
       font-size:1rem;font-weight:700;cursor:pointer;margin:0.5rem}
img{display:block;max-width:90%;width:420px;height:auto;margin:1rem auto;border-radius:12px;
    border:1px solid #2a3240;background:#151820} /* new change */
pre{background:#151820;padding:1rem;border-radius:8px;text-align:left;
    max-width:600px;margin:1rem auto;white-space:pre-wrap;word-break:break-word}
</style></head><body>
<h2>FaceGuard — XIAO ESP32-S3</h2>
<button onclick="snap()">Capture + Recognize</button>
<img id="photo" src="/last.jpg" alt="Last capture"> <!-- new change -->
<pre id="result">Loading...</pre>
<script>
async function snap(){
  document.getElementById('result').textContent = 'Capturing...';
  await fetch('/trigger');
  setTimeout(refresh, 6000);
}

async function refresh(){
  const r = await fetch('/result');
  document.getElementById('result').textContent = await r.text();

  const img = document.getElementById('photo');     // new change
  img.src = '/last.jpg?t=' + Date.now();            // new change
}

refresh();
</script>
</body></html>
)=====";

void handleRoot() {
  server.sendHeader("Content-Type", "text/html; charset=utf-8");
  server.send_P(200, "text/html", PAGE);
}
void handleTrigger() {
  captureRequested = true;
  server.send(200, "text/plain", "queued");
}
void handleResult() {
  server.send(200, "text/plain", lastResult);
}

void handleLastImage() {   // new change
  if (!lastJpeg || lastJpegLen == 0) {   // new change
    server.send(404, "text/plain", "No image captured yet");   // new change
    return;   // new change
  }   // new change

  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");   // new change
  server.sendHeader("Pragma", "no-cache");                                      // new change
  server.sendHeader("Expires", "0");                                            // new change
  server.send_P(200, "image/jpeg", (const char*)lastJpeg, lastJpegLen);        // new change
}   // new change

// Setup + loop
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== FaceGuard XIAO (local network) ===");

  startCamera();

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi failed. Restart.");
    while (true) delay(1000);
  }
  Serial.printf("\nXIAO IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("Backend: %s\n", backendUrl);

  server.on("/", handleRoot);
  server.on("/trigger", handleTrigger);
  server.on("/result", handleResult);
  server.on("/last.jpg", handleLastImage);   // new change
  server.begin();
  Serial.println("Ready.");
}

void loop() {
  server.handleClient();
  if (captureRequested) {
    captureRequested = false;
    captureAndSend();
  }
  delay(1);
}