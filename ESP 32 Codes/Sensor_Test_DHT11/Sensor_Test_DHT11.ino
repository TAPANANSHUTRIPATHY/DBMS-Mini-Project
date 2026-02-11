#include "DHT.h"
// Define the GPIO pin where the DHT11 is connected
#define DHTPIN 15  // GPIO 15
// Define the type of sensor you're using
#define DHTTYPE DHT11  // DHT11 sensor
// Initialize the DHT sensor
DHT dht(DHTPIN, DHTTYPE);
void setup() {
  // Start the serial communication to output data to the Serial Monitor
  Serial.begin(115200);
  // Initialize the DHT sensor
  dht.begin();
}
void loop() {
  // Wait a few seconds between measurements
  delay(2000);
  // Read the temperature as Celsius (default)
  float temperature = dht.readTemperature();
  // Read the humidity
  float humidity = dht.readHumidity();
  // Check if the readings are valid
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  // Print the temperature and humidity values to the Serial Monitor
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.print(" °C, ");
  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");
}