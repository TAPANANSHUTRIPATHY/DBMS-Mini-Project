#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "DHT.h"

/* ================= CONFIG ================= */

#define DHTPIN 15
#define DHTTYPE DHT11
#define MQ135_PIN 34

const char* ssid = "Saion";
const char* password = "Saion123";

// Cloud backend (Render)
const char* serverUrl = "https://dbms-mini-project-vgp4.onrender.com/api/update";

/* ========================================== */

DHT dht(DHTPIN, DHTTYPE);

/* ================= SETUP ================= */

void setup() {
  Serial.begin(115200);
  dht.begin();

  connectWiFi();
}

/* ================= WIFI CONNECT ================= */

void connectWiFi() {
  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("ESP IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Failed! Restarting...");
    ESP.restart();
  }
}

/* ================= MAIN LOOP ================= */

void loop() {

  // Reconnect WiFi if lost
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost. Reconnecting...");
    connectWiFi();
    return;
  }

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int mqRaw = analogRead(MQ135_PIN);

  // Convert raw (0–4095) to AQI scale (0–500)
  float airQuality = (mqRaw / 4095.0) * 500.0;

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT Read Failed!");
    delay(3000);
    return;
  }

  Serial.println("\n====== Sending Data ======");
  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print(" °C | Hum: ");
  Serial.print(humidity);
  Serial.print(" % | AQI: ");
  Serial.println(airQuality);

  sendToServer(temperature, humidity, airQuality);

  delay(5000);   // Send every 5 seconds
}

/* ================= SEND FUNCTION ================= */

void sendToServer(float temperature, float humidity, float airQuality) {

  WiFiClientSecure client;
  client.setInsecure();   // Required for HTTPS (Render)

  HTTPClient http;
  http.setTimeout(10000);  // 10 sec timeout

  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");

  String jsonData = "{";
  jsonData += "\"temperature\":" + String(temperature, 1) + ",";
  jsonData += "\"humidity\":" + String(humidity, 1) + ",";
  jsonData += "\"air_quality\":" + String(airQuality, 0);
  jsonData += "}";

  Serial.println("POST Payload:");
  Serial.println(jsonData);

  int httpResponseCode = http.POST(jsonData);

  Serial.print("HTTP Response Code: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode > 0) {
    Serial.println("Server Response:");
    Serial.println(http.getString());
  } else {
    Serial.print("Error: ");
    Serial.println(http.errorToString(httpResponseCode));
  }

  http.end();
}