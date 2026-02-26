#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

#define DHTPIN 15
#define DHTTYPE DHT11
#define MQ135_PIN 34

// 🔹 Replace with your WiFi credentials
const char* ssid = "Saion";
const char* password = "Saion123";

// 🔹 Replace with your laptop IP
const char* serverUrl = "http://10.46.209.33:6000/api/update";

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();

  Serial.println("\n====================================");
  Serial.println(" ESP32 IoT Test Mode Starting...");
  Serial.println("====================================");

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println("\nConnected to WiFi!");
  Serial.print("ESP IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {

  // ----------- Read Sensors -----------
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int mqRaw = analogRead(MQ135_PIN);

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("❌ DHT11 read failed!");
    delay(3000);
    return;
  }

  Serial.println("\n----------- SENSOR DATA -----------");
  Serial.print("Temperature : ");
  Serial.print(temperature);
  Serial.println(" °C");

  Serial.print("Humidity    : ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("MQ135 Raw   : ");
  Serial.println(mqRaw);
  Serial.println("-----------------------------------");

  // ----------- Send To Backend -----------
  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonData = "{";
    jsonData += "\"temperature\":" + String(temperature) + ",";
    jsonData += "\"humidity\":" + String(humidity) + ",";
    jsonData += "\"air_quality\":" + String(mqRaw);
    jsonData += "}";

    Serial.println("Sending JSON:");
    Serial.println(jsonData);

    int httpResponseCode = http.POST(jsonData);

    Serial.print("HTTP Response Code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Server Response: ");
      Serial.println(response);
    } else {
      Serial.println("Error sending data.");
    }

    http.end();
  } else {
    Serial.println("WiFi Disconnected!");
  }

  delay(5000);  // Send every 5 seconds
}