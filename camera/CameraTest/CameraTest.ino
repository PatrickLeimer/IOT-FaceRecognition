#include "WiFi.h"
#include "esp_camera.h"
#include "esp_timer.h"
#include "img_converters.h"
#include "Arduino.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "driver/rtc_io.h"
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <FS.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* ssid = "Benjing's iPhone";
const char* password = "12345678";

AsyncWebServer server(80);
boolean takeNewPhoto = false;

void capturePhotoSaveSpiffs();
void sendToBackend();

const char* backendUrl = "https://montmorillonitic-nonlethal-bruce.ngrok-free.dev/recognize";

#define FILE_PHOTO "/photo.jpg"

#define PWDN_GPIO_NUM    -1
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM    21
#define SIOD_GPIO_NUM    26
#define SIOC_GPIO_NUM    27
#define Y9_GPIO_NUM      35
#define Y8_GPIO_NUM      34
#define Y7_GPIO_NUM      39
#define Y6_GPIO_NUM      36
#define Y5_GPIO_NUM      19
#define Y4_GPIO_NUM      18
#define Y3_GPIO_NUM       5
#define Y2_GPIO_NUM       4
#define VSYNC_GPIO_NUM   25
#define HREF_GPIO_NUM    23
#define PCLK_GPIO_NUM    22

// ... (keep your index_html as-is)
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@300;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
 
    :root {
      --bg: #0d0f12;
      --surface: #151820;
      --border: #1f2535;
      --accent: #00e5ff;
      --accent-dim: rgba(0, 229, 255, 0.12);
      --text: #cdd6e8;
      --muted: #4a5568;
      --mono: 'Share Tech Mono', monospace;
      --sans: 'Barlow', sans-serif;
    }
 
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem 3rem;
    }
 
    header {
      width: 100%;
      max-width: 720px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .cam-icon {
      width: 36px; height: 36px;
      background: var(--accent-dim);
      border: 1px solid var(--accent);
      border-radius: 8px;
      display: grid; place-items: center;
    }
    .cam-icon svg { width: 18px; height: 18px; stroke: var(--accent); fill: none; stroke-width: 1.8; }
    h2 {
      font-family: var(--mono);
      font-size: 1rem;
      color: var(--accent);
      letter-spacing: 0.08em;
    }
    .status-dot {
      margin-left: auto;
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
 
    .hint {
      font-size: 0.78rem;
      color: var(--muted);
      font-family: var(--mono);
      margin-bottom: 1.25rem;
    }
 
    .photo-wrapper {
      width: 100%;
      max-width: 720px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      margin-bottom: 1.5rem;
    }
    .photo-wrapper::before, .photo-wrapper::after {
      content: '';
      position: absolute;
      width: 14px; height: 14px;
      border-color: var(--accent);
      border-style: solid;
      opacity: 0.4;
    }
    .photo-wrapper::before { top: 8px; left: 8px; border-width: 1.5px 0 0 1.5px; }
    .photo-wrapper::after  { bottom: 8px; right: 8px; border-width: 0 1.5px 1.5px 0; }
 
    .vert { padding: 3rem 1.5rem; }
    .hori { padding: 1.5rem; }
    #container {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      transition: padding 0.3s ease;
    }
 
    #photo {
      max-width: 100%;
      border-radius: 6px;
      display: block;
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
 
    .controls {
      width: 100%;
      max-width: 720px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.75rem;
    }
    button {
      font-family: var(--mono);
      font-size: 0.72rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: 8px;
      padding: 0.75rem 0.5rem;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--muted);
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }
    button svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.8; }
    button:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
    button:active { transform: scale(0.96); }
    button.primary { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
 
    @media (max-width: 400px) {
      .controls { grid-template-columns: 1fr; }
      button { flex-direction: row; justify-content: center; padding: 0.7rem 1rem; }
    }
  </style>
</head>
<body>
 
  <header>
    <div class="cam-icon">
      <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
    </div>
    <h2>ESP32-CAM Last Photo</h2>
    <div class="status-dot"></div>
  </header>
 
  <p class="hint">It might take more than 5 seconds to capture a photo.</p>
 
  <div class="photo-wrapper">
    <div id="container" class="hori">
      <img src="saved-photo" id="photo" width="70%" alt="Captured photo">
    </div>
  </div>
 
  <div class="controls">
    <button onclick="rotatePhoto()">
      <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      Rotate
    </button>
    <button class="primary" onclick="capturePhoto()">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/></svg>
      Capture Photo
    </button>
    <button onclick="location.reload()">
      <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
      Refresh Page
    </button>
  </div>
 
</body>
<script>
  var deg = 0;
  function capturePhoto() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', "/capture", true);
    xhr.send();
  }
  function rotatePhoto() {
    var img = document.getElementById("photo");
    deg += 90;
    if(isOdd(deg/90)){ document.getElementById("container").className = "vert"; }
    else{ document.getElementById("container").className = "hori"; }
    img.style.transform = "rotate(" + deg + "deg)";
  }
  function isOdd(n) { return Math.abs(n % 2) == 1; }
</script>
</html>)rawliteral";

void setup() {
  Serial.begin(115200);
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
IPAddress dns1(8, 8, 8, 8);
IPAddress dns2(8, 8, 4, 4);
WiFi.config(WiFi.localIP(), WiFi.gatewayIP(), WiFi.subnetMask(), dns1, dns2);
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS mount failed");
    ESP.restart();
  }

  Serial.print("IP Address: http://");
  Serial.println(WiFi.localIP());

  camera_config_t config;
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
  // FIX: cap at SVGA regardless of PSRAM — UXGA is too large to upload reliably
  config.frame_size   = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
  config.fb_count     = psramFound() ? 2 : 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    ESP.restart();
  }

  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(200, "text/html", index_html);
  });

  server.on("/capture", HTTP_GET, [](AsyncWebServerRequest* request) {
    takeNewPhoto = true;
    request->send(200, "text/plain", "Processing...");
  });

  server.on("/saved-photo", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(SPIFFS, FILE_PHOTO, "image/jpeg");
  });

  server.begin();
}

void loop() {
  if (takeNewPhoto) {
    takeNewPhoto = false;
    capturePhotoSaveSpiffs();
    sendToBackend();
  }
  delay(1);
}

bool checkPhoto(fs::FS &fs) {
  File f = fs.open(FILE_PHOTO);
  unsigned int sz = f.size();
  return (sz > 100);
}

void capturePhotoSaveSpiffs() {
  camera_fb_t* fb = NULL;
  bool ok = false;
  do {
    Serial.println("Taking photo...");
    fb = esp_camera_fb_get();
    if (!fb) { Serial.println("Camera capture failed"); return; }

    File file = SPIFFS.open(FILE_PHOTO, FILE_WRITE);
    if (!file) {
      Serial.println("Failed to open file for writing");
    } else {
      file.write(fb->buf, fb->len);
      Serial.printf("Saved %u bytes to %s\n", fb->len, FILE_PHOTO);
    }
    file.close();
    esp_camera_fb_return(fb);
    ok = checkPhoto(SPIFFS);
  } while (!ok);
}

void sendToBackend() {
  File file = SPIFFS.open(FILE_PHOTO, FILE_READ);
  if (!file) { Serial.println("Failed to open photo"); return; }

  size_t fileSize = file.size();
  Serial.printf("Photo size: %u bytes\n", fileSize);
  Serial.printf("Free heap: %u bytes\n", ESP.getFreeHeap());

  uint8_t* buf = (uint8_t*) malloc(fileSize);
  if (!buf) { Serial.println("malloc failed for buf"); file.close(); return; }
  file.read(buf, fileSize);
  file.close();

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(15);  // 15 seconds for TLS handshake

  HTTPClient http;
  http.begin(client, backendUrl);
  http.setTimeout(30000);  // 30 seconds for the full request
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);  // follow any redirects

  String boundary = "----ESP32Boundary";
  String bodyStart = "--" + boundary + "\r\n"
                   + "Content-Disposition: form-data; name=\"image\"; filename=\"photo.jpg\"\r\n"
                   + "Content-Type: image/jpeg\r\n\r\n";
  String bodyEnd = "\r\n--" + boundary + "--\r\n";

  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("ngrok-skip-browser-warning", "true");

  size_t totalLen = bodyStart.length() + fileSize + bodyEnd.length();

  uint8_t* body = (uint8_t*) malloc(totalLen);
  if (!body) {
    Serial.println("malloc failed for body");
    free(buf);
    http.end();
    return;
  }

  memcpy(body, bodyStart.c_str(), bodyStart.length());
  memcpy(body + bodyStart.length(), buf, fileSize);
  memcpy(body + bodyStart.length() + fileSize, bodyEnd.c_str(), bodyEnd.length());
  free(buf);

  Serial.printf("Sending %u bytes to backend...\n", totalLen);
  Serial.printf("Free heap before POST: %u bytes\n", ESP.getFreeHeap());

  int httpCode = http.POST(body, totalLen);
  free(body);

  Serial.printf("HTTP response code: %d\n", httpCode);

  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    Serial.println("Response: " + response);
  } else if (httpCode > 0) {
    Serial.printf("Server returned: %d\n", httpCode);
    String response = http.getString();
    Serial.println("Body: " + response);
  } else {
    Serial.printf("Connection failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}