#include <WiFi.h>
#include "DHT.h"

#define DHTPIN 15
#define DHTTYPE DHT11

const char* ssid = "Saion";
const char* password = "Saion123";

DHT dht(DHTPIN, DHTTYPE);
WiFiServer server(80);

void setup() {
  Serial.begin(115200);
  dht.begin();

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting...");
  }

  Serial.println("Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  server.begin();
}

void loop() {
  WiFiClient client = server.available();

  if (client) {
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    client.println("HTTP/1.1 200 OK");
    client.println("Content-type:text/html");
    client.println();

    client.println("<!DOCTYPE html><html>");
    client.println("<head><meta http-equiv='refresh' content='3'>");
    client.println("<title>ESP32 DHT11 Server</title></head>");
    client.println("<body style='font-family:Arial;text-align:center;'>");
    client.println("<h2>ESP32 Environmental Monitor</h2>");
    client.print("<h3>Temperature: ");
    client.print(temperature);
    client.println(" °C</h3>");
    client.print("<h3>Humidity: ");
    client.print(humidity);
    client.println(" %</h3>");
    client.println("<p>Page refreshes every 3 seconds</p>");
    client.println("</body></html>");

    client.println();
    delay(1);
    client.stop();
  }
}
