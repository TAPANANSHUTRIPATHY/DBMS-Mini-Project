#include "DHT.h"

#define DHTPIN 15
#define DHTTYPE DHT11
#define MQ135_PIN 34   // Analog pin (ADC1 safe)

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();

  Serial.println("\n====================================");
  Serial.println("  ESP32 | DHT11 + MQ135 Test Mode   ");
  Serial.println("====================================");
  delay(2000);
}

void loop() {

  // ----------- Read DHT11 -----------
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // ----------- Read MQ135 -----------
  int mqRaw = analogRead(MQ135_PIN);

  // Convert raw ADC (0–4095) to voltage
  float voltage = mqRaw * (3.3 / 4095.0);

  Serial.println("\n----------- SENSOR DATA -----------");

  // ----------- DHT Output -----------
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 ERROR: Failed to read!");
  } else {
    Serial.print("Temperature : ");
    Serial.print(temperature);
    Serial.println(" °C");

    Serial.print("Humidity    : ");
    Serial.print(humidity);
    Serial.println(" %");
  }

  Serial.println();

  // ----------- MQ Output -----------
  Serial.print("MQ135 Raw Value  : ");
  Serial.println(mqRaw);

  Serial.print("MQ135 Voltage    : ");
  Serial.print(voltage, 3);
  Serial.println(" V");

  // Simple Air Quality Classification
  if (mqRaw < 800) {
    Serial.println("Air Quality      : CLEAN 🟢");
  }
  else if (mqRaw < 1800) {
    Serial.println("Air Quality      : MODERATE 🟡");
  }
  else {
    Serial.println("Air Quality      : POOR 🔴");
  }

  Serial.println("-----------------------------------");

  delay(3000);  // Update every 3 seconds
}