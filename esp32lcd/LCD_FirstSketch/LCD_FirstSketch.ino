#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// =========================
// Wi-Fi and Firestore
// =========================
const char* ssid = "StevensiPhone";
const char* password = "abcdefgh";

const char* firestoreURL =
  "https://firestore.googleapis.com/v1/projects/face-recognition-b7c76/databases/(default)/documents/display/current?key=YOUR_API_KEY";

// =========================
// LCD
// =========================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// =========================
// GPIO pins
// =========================
const int checkPin = 25;          // pulses HIGH for 0.2 sec every check
const int recognizedLedPin = 26;  // stays HIGH for 5 sec on recognized

// =========================
// Timing
// =========================
const unsigned long pollInterval = 3000;   // 3 seconds
const unsigned long checkPulseMs = 200;    // 0.2 seconds
const unsigned long recognizedLedMs = 5000; // 5 seconds

unsigned long lastPollTime = 0;
bool recognizedLedActive = false;
unsigned long recognizedLedStart = 0;

// Track last displayed content to reduce flicker
String lastLine1 = "";
String lastLine2 = "";

// =========================
// Helper functions
// =========================
void printLine(int row, String text) {
  while (text.length() < 16) {
    text += " ";
  }
  lcd.setCursor(0, row);
  lcd.print(text.substring(0, 16));
}

void showLCD(String line1, String line2) {
  if (line1 == lastLine1 && line2 == lastLine2) {
    return;
  }

  lastLine1 = line1;
  lastLine2 = line2;

  printLine(0, line1);
  printLine(1, line2);
}

void triggerRecognizedLED() {
  digitalWrite(recognizedLedPin, HIGH);
  recognizedLedStart = millis();
  recognizedLedActive = true;
}

void pulseCheckPin() {
  digitalWrite(checkPin, HIGH);
  delay(checkPulseMs);
  digitalWrite(checkPin, LOW);
}

void handlePayload(const String& payload) {
  Serial.println("RAW PAYLOAD START");
  Serial.println(payload);
  Serial.println("RAW PAYLOAD END");

  DynamicJsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, payload);

  if (err) {
    Serial.print("JSON parse failed: ");
    Serial.println(err.c_str());
    showLCD("JSON parse", "failed");
    return;
  }

  if (!doc["fields"].is<JsonObject>()) {
    Serial.println("No valid 'fields' object in response.");
    showLCD("Bad response", "Check Serial");
    return;
  }

  String name = "Unknown";
  String status = "unknown";

  if (doc["fields"]["name"]["stringValue"].is<const char*>()) {
    name = String((const char*)doc["fields"]["name"]["stringValue"]);
  }

  if (doc["fields"]["status"]["stringValue"].is<const char*>()) {
    status = String((const char*)doc["fields"]["status"]["stringValue"]);
  }

  name.trim();
  status.trim();

  Serial.print("Parsed name: ");
  Serial.println(name);
  Serial.print("Parsed status: ");
  Serial.println(status);

  if (status == "recognized") {
    showLCD("Recognized:", name);
    triggerRecognizedLED();
  } else if (status == "unknown") {
    showLCD("Detecting...");
  } else if (status == "no_face") {
    showLCD("No face", "detected");
  } else {
    showLCD("Status:", status);
  }
}

void fetchFirestoreDocument() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected.");
    showLCD("WiFi lost", "");
    return;
  }

  pulseCheckPin();

  WiFiClientSecure client;
  client.setInsecure();  // testing only

  HTTPClient https;
  if (!https.begin(client, firestoreURL)) {
    Serial.println("HTTPS begin failed.");
    showLCD("HTTPS begin", "failed");
    return;
  }

  int httpCode = https.GET();
  Serial.print("HTTP code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String payload = https.getString();
    handlePayload(payload);
  } else {
    Serial.print("HTTP GET failed: ");
    Serial.println(httpCode);
    showLCD("HTTP error", String(httpCode));
  }

  https.end();
}

// =========================
// Setup
// =========================
void setup() {
  Serial.begin(115200);

  pinMode(checkPin, OUTPUT);
  pinMode(recognizedLedPin, OUTPUT);
  digitalWrite(checkPin, LOW);
  digitalWrite(recognizedLedPin, LOW);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();

  showLCD("Connecting...", "");

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
  showLCD("WiFi connected", "");
  delay(1000);
  showLCD("Waiting...", "");
}

// =========================
// Main loop
// =========================
void loop() {
  // Turn off recognized LED after 5 seconds
  if (recognizedLedActive && millis() - recognizedLedStart >= recognizedLedMs) {
    digitalWrite(recognizedLedPin, LOW);
    recognizedLedActive = false;
  }

  // Poll Firestore every 3 seconds
  if (millis() - lastPollTime >= pollInterval) {
    lastPollTime = millis();
    fetchFirestoreDocument();
  }
}