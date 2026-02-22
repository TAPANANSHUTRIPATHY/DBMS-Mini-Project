# 🌍 DBMS Mini Project  
## IoT-Based Environmental Monitoring System

---

## 📌 Project Overview

This project is an IoT-based Environmental Monitoring System that collects real-time environmental data using ESP32 and stores it in a PostgreSQL database via a Node.js backend.

The system currently monitors:

- 🌡 Temperature (DHT11)
- 💧 Humidity (DHT11)
- 🌫 Air Quality (MQ135)
- 📡 WiFi-based Data Transmission
- 🗄 PostgreSQL Database Storage
- 🧪 Isolated Backend Test Environment

This repository represents the **Initial Development Phase (Phase 1)** focused on:

- Hardware integration  
- WiFi communication  
- Backend connectivity  
- Database storage validation  

---

# 🏗 System Architecture (Phase 1)

```
Sensors (DHT11 + MQ135)
        ↓
ESP32 (WiFi Enabled)
        ↓ HTTP POST (JSON)
Node.js Backend (Port 6000)
        ↓
PostgreSQL Database (iot_test_env)
```

---

# 🛠 Technology Stack

## 🔹 Hardware
- ESP32 Development Board
- DHT11 Temperature & Humidity Sensor
- MQ135 Gas Sensor
- Breadboard + Jumper Wires

## 🔹 Backend (Test Environment)
- Node.js
- Express.js
- PostgreSQL
- pg (node-postgres)
- CORS

## 🔹 Database
- PostgreSQL 18
- pgAdmin 4

## 🔹 Development Tools
- VS Code
- Arduino IDE

---

# 📂 Project Structure

```
DBMS-Mini-Project/
│
├── backend/                 # Main backend (future production version)
│
├── backend-test/            # Isolated backend test environment
│   ├── server-test.js
│   ├── db-test.js
│   ├── routes/
│   │     └── sensorRoutes-test.js
│   ├── controllers/
│   │     └── sensorController-test.js
│   └── results/             # Database test result screenshots
│
├── ESP 32 Codes/            # All ESP32 sketches
│
├── frontend/                # UI (under development)
│
└── README.md
```

---

# 🧪 Backend Test Environment (Phase 1)

An isolated backend (`backend-test`) was created to safely test ESP32 → Database communication without affecting the future production backend.

### 📌 Database Used

Database Name:
```
iot_test_env
```

### 📌 Table Structure

```sql
CREATE TABLE sensor_test_data (
    id SERIAL PRIMARY KEY,
    temperature FLOAT,
    humidity FLOAT,
    air_quality INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 📡 ESP32 → Backend Communication

The ESP32 sends sensor data in JSON format:

```json
{
  "temperature": 27.0,
  "humidity": 62.0,
  "air_quality": 1450
}
```

Backend receives the JSON payload and inserts it into PostgreSQL.

HTTP Response Code `200` confirms successful insertion.

---

# 📊 Backend-Test Results (Database Verification)

Below are verified database graph outputs from pgAdmin after inserting live sensor data.

---

## 🌡 Temperature Data Stored in PostgreSQL

![Temperature Graph](backend-test/results/pg%20admin%20backend%20test%20DHT%2011%20temperature%20graph.png)

---

## 💧 Humidity Data Stored in PostgreSQL

![Humidity Graph](backend-test/results/pg%20admin%20backend%20test%20DHT%2011%20humidity%20graph.png)

---

## 🌫 MQ135 Air Quality Data Stored in PostgreSQL

![Air Quality Graph](backend-test/results/pg%20admin%20backend%20test%20MQ135%20air%20quality%20graph.png)

---

# ✅ Current Implementation Status

✔ DHT11 sensor integration  
✔ MQ135 analog integration  
✔ WiFi communication working  
✔ ESP32 sending HTTP POST requests  
✔ Backend receiving JSON payload  
✔ PostgreSQL insertion verified  
✔ Database visualization validated  

---

# 🔄 Future Development (Upcoming Phases)

- 🌐 Production backend integration (merge backend-test into main backend)
- 📊 Real-time frontend dashboard (Chart.js)
- 📈 Live sensor graphs
- 🔔 Air quality alert system
- ☁ Cloud deployment
- 📱 Responsive UI
- 📤 CSV export functionality
- 🔐 Authentication & user management
- 📊 Historical analytics

---

# 🎯 Final Goal

To build a scalable full-stack IoT Environmental Monitoring Platform capable of:

- Real-time sensor tracking  
- Historical data storage  
- Data visualization & analytics  
- Scalable backend architecture  
- Cloud deployment readiness  

---

# 👨‍💻 Author

**Tapananshu Tripathy**  
B.Tech CSE  
KIIT University  

---

🟢 Phase 1 Complete  
🟡 Frontend Integration In Progress  
🔵 Full System Deployment Under Development  
