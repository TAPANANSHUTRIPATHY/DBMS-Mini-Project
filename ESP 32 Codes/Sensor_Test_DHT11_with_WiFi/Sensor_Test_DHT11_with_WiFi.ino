#include <WiFi.h>
#include "DHT.h"

#define DHTPIN 15
#define DHTTYPE DHT11

const char* ssid = "Saion";
const char* password = "Saion123";

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting...");
  }

  Serial.println("Connected to WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print("  Humidity: ");
  Serial.println(humidity);

  delay(3000);
}
