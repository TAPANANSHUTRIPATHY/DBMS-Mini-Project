#include <Wire.h>
#include <Adafruit_BMP280.h>
#include "DHT.h"

#define DHTPIN 15
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
Adafruit_BMP280 bmp;

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Combined Sensor Test...");

  // Initialize DHT
  dht.begin();

  // Initialize I2C for ESP32 (SDA, SCL)
  Wire.begin(21, 22);

  // Try BMP280 address 0x76 first
  if (!bmp.begin(0x76)) {
    Serial.println("BMP280 not found at 0x76, trying 0x77...");
    
    // Try alternate address
    if (!bmp.begin(0x77)) {
      Serial.println("BMP280 not found! Check wiring.");
      while (1);
    }
  }

  Serial.println("BMP280 Initialized Successfully!");
  Serial.println("----------------------------------");
}

void loop() {

  float humidity = dht.readHumidity();
  float temperature_dht = dht.readTemperature();

  float temperature_bmp = bmp.readTemperature();
  float pressure = bmp.readPressure() / 100.0;  // Convert Pa to hPa
  float altitude = bmp.readAltitude(1013.25);

  Serial.println("------ SENSOR READINGS ------");

  // DHT11 Output
  if (isnan(humidity) || isnan(temperature_dht)) {
    Serial.println("DHT11 read failed!");
  } else {
    Serial.print("DHT11 Temperature: ");
    Serial.print(temperature_dht);
    Serial.println(" °C");

    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
  }

  // BMP280 Output
  Serial.print("BMP280 Temperature: ");
  Serial.print(temperature_bmp);
  Serial.println(" °C");

  Serial.print("Pressure: ");
  Serial.print(pressure);
  Serial.println(" hPa");

  Serial.print("Approx Altitude: ");
  Serial.print(altitude);
  Serial.println(" m");

  Serial.println("----------------------------------");
  Serial.println();

  delay(2000);
}
