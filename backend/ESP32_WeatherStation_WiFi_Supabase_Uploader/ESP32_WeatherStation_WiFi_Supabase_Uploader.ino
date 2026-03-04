#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "DHT.h"

/* ========= SENSOR CONFIG ========= */

#define DHTPIN 15
#define DHTTYPE DHT11
#define MQ135_PIN 34

DHT dht(DHTPIN, DHTTYPE);

/* ========= WIFI ========= */

const char* ssid = "Saion";
const char* password = "Saion123";

/* ========= SERVER ========= */

const char* serverUrl = "https://dbms-mini-project-vgp4.onrender.com/api/update";

/* ========= TIMERS ========= */

unsigned long lastReadTime = 0;
unsigned long lastSendTime = 0;
unsigned long lastRetryTime = 0;

const unsigned long readInterval = 3000;       // 3 sec
const unsigned long sendInterval = 300000;     // 5 min
const unsigned long retryInterval = 10000;     // retry every 10 sec

/* ========= SENSOR VALUES ========= */

float temperature = 0;
float humidity = 0;
float airQuality = 0;

/* ========= FLAGS ========= */

bool sendPending = false;

/* ================================= */

void setup() {

  Serial.begin(115200);
  dht.begin();

  connectWiFi();
}

/* ========= WIFI CONNECT ========= */

void connectWiFi() {

  Serial.println("Connecting to WiFi...");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  Serial.println(WiFi.localIP());
}

/* ========= MAIN LOOP ========= */

void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  unsigned long currentMillis = millis();

  /* ===== SENSOR READ EVERY 3 SEC ===== */

  if (currentMillis - lastReadTime >= readInterval) {

    lastReadTime = currentMillis;

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int mqRaw = analogRead(MQ135_PIN);

    float aqi = (mqRaw / 4095.0) * 500.0;

    if (!isnan(temp) && !isnan(hum)) {
      temperature = temp;
      humidity = hum;
      airQuality = aqi;
    }

    Serial.println("\n===== SENSOR DATA =====");
    Serial.print("Temp: ");
    Serial.print(temperature);
    Serial.print(" °C  Hum: ");
    Serial.print(humidity);
    Serial.print(" %  AQI: ");
    Serial.println(airQuality);
  }

  /* ===== 5 MIN SEND TRIGGER ===== */

  if (currentMillis - lastSendTime >= sendInterval) {

    sendPending = true;
    lastSendTime = currentMillis;
  }

  /* ===== RETRY LOGIC ===== */

  if (sendPending && (currentMillis - lastRetryTime >= retryInterval)) {

    lastRetryTime = currentMillis;

    Serial.println("\nTrying to send data...");

    bool success = sendToServer();

    if (success) {
      Serial.println("Data sent successfully!");
      sendPending = false;
    }
    else {
      Serial.println("Send failed. Will retry...");
    }
  }
}

/* ========= SEND FUNCTION ========= */

bool sendToServer() {

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.setTimeout(10000);

  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");

  String jsonData = "{";
  jsonData += "\"temperature\":" + String(temperature, 1) + ",";
  jsonData += "\"humidity\":" + String(humidity, 1) + ",";
  jsonData += "\"air_quality\":" + String(airQuality, 0);
  jsonData += "}";

  Serial.println("Payload:");
  Serial.println(jsonData);

  int httpResponseCode = http.POST(jsonData);

  Serial.print("HTTP Response: ");
  Serial.println(httpResponseCode);

  http.end();

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    return true;
  }

  return false;
}