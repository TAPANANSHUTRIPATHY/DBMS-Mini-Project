#include <WiFi.h>
#include <WebServer.h>
#include "DHT.h"

#define DHTPIN 15
#define DHTTYPE DHT11
#define MQ135_PIN 34

const char* ssid = "Saion";
const char* password = "Saion123";

DHT dht(DHTPIN, DHTTYPE);
WebServer server(80);

float temperature = 0;
float humidity = 0;
int mqRaw = 0;

void handleRoot() {
  String html = "<!DOCTYPE html><html>";
  html += "<head><meta http-equiv='refresh' content='3'>";
  html += "<title>ESP32 Sensor Dashboard</title>";
  html += "<style>";
  html += "body{font-family:Arial;background:#0f172a;color:white;text-align:center;}";
  html += ".card{background:#111827;padding:20px;margin:20px auto;width:300px;border-radius:15px;box-shadow:0 0 15px cyan;}";
  html += "h1{color:cyan;}";
  html += "</style></head><body>";
  html += "<h1>ESP32 Live Sensor Dashboard</h1>";

  html += "<div class='card'>";
  html += "<h2>Temperature</h2>";
  html += "<p>" + String(temperature) + " °C</p>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>Humidity</h2>";
  html += "<p>" + String(humidity) + " %</p>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>MQ135 Raw Value</h2>";
  html += "<p>" + String(mqRaw) + "</p>";
  html += "</div>";

  html += "</body></html>";

  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.print("ESP IP Address: ");
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.begin();
}

void loop() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  mqRaw = analogRead(MQ135_PIN);

  server.handleClient();
  delay(2000);
}