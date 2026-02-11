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

  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");

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
    String request = client.readStringUntil('\r');
    client.flush();

    // If browser requests /data
    if (request.indexOf("GET /data") >= 0) {

      float humidity = dht.readHumidity();
      float temperature = dht.readTemperature();

      client.println("HTTP/1.1 200 OK");
      client.println("Content-Type: application/json");
      client.println();
      client.print("{\"temperature\":");
      client.print(temperature);
      client.print(",\"humidity\":");
      client.print(humidity);
      client.print("}");
      client.println();
    }

    else {
      // Serve main HTML page
      client.println("HTTP/1.1 200 OK");
      client.println("Content-Type: text/html");
      client.println();

      client.println("<!DOCTYPE html>");
      client.println("<html>");
      client.println("<head>");
      client.println("<title>ESP32 Live Monitor</title>");
      client.println("<style>");
      client.println("body { font-family: Arial; text-align: center; background:#f4f4f4; }");
      client.println(".card { background:white; padding:30px; margin:50px auto; width:300px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1);} ");
      client.println("h2 { margin-bottom:20px; }");
      client.println("</style>");
      client.println("</head>");
      client.println("<body>");
      client.println("<div class='card'>");
      client.println("<h2>ESP32 Live Environment</h2>");
      client.println("<h3>Temperature: <span id='temp'>--</span> °C</h3>");
      client.println("<h3>Humidity: <span id='hum'>--</span> %</h3>");
      client.println("</div>");

      client.println("<script>");
      client.println("function fetchData() {");
      client.println("fetch('/data')");
      client.println(".then(response => response.json())");
      client.println(".then(data => {");
      client.println("document.getElementById('temp').innerText = data.temperature;");
      client.println("document.getElementById('hum').innerText = data.humidity;");
      client.println("});");
      client.println("}");
      client.println("setInterval(fetchData, 2000);");
      client.println("fetchData();");
      client.println("</script>");

      client.println("</body>");
      client.println("</html>");
      client.println();
    }

    delay(1);
    client.stop();
  }
}
