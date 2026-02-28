<div align="center">

# 🌍 ENVCORE
### IoT-Based Environmental Monitoring System

![Status](https://img.shields.io/badge/Status-Live%20%26%20Deployed-brightgreen?style=for-the-badge)
![ESP32](https://img.shields.io/badge/Hardware-ESP32-orange?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql)
![Netlify](https://img.shields.io/badge/Frontend-Netlify-00C7B7?style=for-the-badge&logo=netlify)

**A full-stack IoT platform for real-time environmental data collection, storage, and visualization.**

[🚀 Live Dashboard](https://envcore-dashboard-dbms-tt.netlify.app) • [📡 API Docs](#-production-api-endpoints) • [🎬 Demo Video](#-demo-video) • [🌿 Branches](#-branch-structure)

</div>

---

## 📌 Project Vision

**ENVCORE** is a full-stack IoT Environmental Monitoring Platform designed to:

- 📡 Collect **real-time** environmental data (Temperature, Humidity, Air Quality)
- 🗄️ Store it in a structured **relational database** on the cloud
- 📊 **Visualize** trends and historical insights via an interactive dashboard
- ☁️ Enable **scalable cloud deployment** with auto-scaling infrastructure
- 🔔 Provide **real-time monitoring** with threshold-based AQI alerts

This project demonstrates end-to-end engineering across:

| Domain | Stack |
|--------|-------|
| Embedded Systems | ESP32, DHT11, MQ135 |
| Backend API | Node.js, Express.js |
| Database | PostgreSQL (Supabase Cloud) |
| Frontend | HTML5, CSS3, Chart.js |
| DevOps | Render, Netlify, Supabase |

---

## 🎬 Demo Video

> 📹 **Project Walkthrough Video**
>
> [![ENVCORE Demo](https://img.shields.io/badge/▶%20Watch%20on%20YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/YOUR_VIDEO_LINK_HERE)
>
> *(Replace the link above once the video is uploaded to YouTube)*

---

## 🖥️ Frontend UI — Screenshots

### Live Monitor — Smart Environmental Monitoring

> Real-time sensor dashboard with live data streaming from ESP32 via the cloud.

![ENVCORE Live Monitor](screenshots/envcore-live-monitor.png)

**UI Highlights:**
- 📍 **Location bar** — Shows *"Bhubaneswar Municipal Corporation, Odisha, India"* auto-detected
- 🟢 **LIVE indicator** — Pulsing green dot with real-time clock (HH:MM:SS)
- ⚠️ **Smart AQI Alert Banner** — Yellow warning bar: *"Air quality MODERATE: AQI 1091"*
- 🎯 **Health Score Gauge** — Circular donut gauge (score: **75 — GOOD**) with color-coded segments for Temperature, Humidity, and Air Quality
- 🃏 **Sensor Reading Cards** (3 interactive cards):
  - 🌡️ Temperature: **28.3°C** with min/avg/max + sparkline trend chart
  - 💧 Humidity: **43.8%** with min/avg/max + sparkline trend chart
  - 🌫️ Air Quality Index: **1101 — Moderate** (highlighted with yellow glow border) with min/avg/max
- 📈 **Real-Time Analytics** section with 3 live Chart.js time-series graphs:
  - Temperature over time (red fill area)
  - Humidity over time (cyan fill area)
  - Air Quality Index over time (green fill area)
- 🎛️ **Sensor Gauges** — 3 arc-style gauges at the bottom for Temperature, Humidity, and AQI with intuitive color coding

---

### Historical Data Dashboard

> Full historical analysis with date filtering, detailed data table, and CSV export.

![ENVCORE Historical Dashboard](screenshots/envcore-historical-dashboard.png)

**UI Highlights:**
- 📅 **Date Filter Bar** — View by Today / Yesterday / 3 Days Ago with a custom date picker
- 📤 **Download CSV** button for exporting all historical records
- 📊 **4 Summary Cards** at the top:
  - 🌡️ Temperature: **27.5°C** avg with min/max/timestamp
  - 💧 Humidity: **56.3%** avg with min/max/timestamp
  - 🌫️ Air Quality Index: **1454** avg with min/max/timestamp
  - 💚 ENV Health Score: **72** — GOOD
- 📈 **Temperature Over Time** graph (red)
- 📈 **Humidity Over Time** graph (cyan)
- 📈 **Air Quality Index Over Time** graph (green) — full width, clearly showing AQI drop from ~6000 → stabilizing ~1400 over time
- 📋 **Detailed Records Table** — Paginated (Page 1 of 5, showing 1–50 of **396 records**) with columns:
  - `#`, `Time`, `Temperature`, `Humidity`, `Air Quality`, `Health Score`
  - Color-coded AQI badges: 🔴 Poor / 🟡 Moderate / 🟢 Good

---

## 🧠 System Architecture

```
┌────────────────────────────────────────┐
│        SENSOR LAYER                    │
│   DHT11 (Temp + Humidity)              │
│   MQ135  (Air Quality Index)           │
└──────────────────┬─────────────────────┘
                   │
                   ▼  WiFi + HTTPS POST
┌────────────────────────────────────────┐
│        EDGE DEVICE                     │
│   ESP32 — WiFi + HTTP Client           │
└──────────────────┬─────────────────────┘
                   │
                   ▼  JSON Payload
┌────────────────────────────────────────┐
│        BACKEND (Render Cloud)          │
│   Node.js + Express REST API           │
└──────────────────┬─────────────────────┘
                   │
                   ▼  SQL Queries
┌────────────────────────────────────────┐
│        DATABASE (Supabase)             │
│   PostgreSQL — Cloud Hosted            │
└──────────────────┬─────────────────────┘
                   │
                   ▼  REST API Fetch
┌────────────────────────────────────────┐
│        FRONTEND (Netlify)              │
│   Dashboard — Charts, Alerts, Export  │
└────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
DBMS-Mini-Project/
│
├── backend/                    # ✅ Production backend (deployed on Render)
│   ├── backendespcode/
│   ├── controllers/
│   ├── routes/
│   ├── node_modules/
│   ├── .env
│   ├── db.js
│   ├── server.js
│   ├── server-postman.js
│   ├── package.json
│   └── package-lock.json
│
├── backend-test/               # 🧪 Phase 1 isolated test environment
│   ├── server-test.js
│   ├── db-test.js
│   ├── routes/
│   │     └── sensorRoutes-test.js
│   ├── controllers/
│   │     └── sensorController-test.js
│   └── results/                # 📸 Database test verification screenshots
│
├── CSV Files/                  # 📊 Exported sensor data CSV files
│
├── Database Scripts/           # 🗄️ SQL scripts for schema setup
│
├── DBMS Project SS/            # 🖼️ Project screenshots collection
│
├── Docs/                       # 📄 Project documentation
│
├── ESP 32 Codes/               # 🔌 All ESP32 Arduino sketches
│
├── frontend/                   # 🎨 Netlify deployed dashboard
│   ├── charts.js
│   ├── dashboard.css
│   ├── dashboard.html          # Historical data dashboard page
│   ├── dashboard.js
│   ├── index.html              # Live monitor page
│   ├── script.js
│   └── style.css
│
├── Research Papers/            # 📚 Reference research papers
│
├── screenshots/                # 📸 UI screenshots (used in this README)
│   ├── envcore-live-monitor.png
│   └── envcore-historical-dashboard.png
│
├── .gitattributes
├── LICENSE
└── README.md
```

> 💡 **To add screenshots:** Place the two frontend screenshots in a `screenshots/` folder in the repo root so they render correctly in this README.

---

## 🌿 Branch Structure

The project follows a structured **phase-based branching strategy**, with each branch representing a traceable development milestone:

| Branch | Last Updated | PR | Description |
|--------|-------------|-----|-------------|
| `phase-8-netlify-frontend-integration` | 20 hours ago | #5 | Final Netlify deployment + frontend polish |
| `phase-7-render-backend-integration` | Yesterday | — | Render cloud backend deployment |
| `phase-6-cloud-integration-and-deployment` | Yesterday | — | Full cloud stack integration |
| `phase-5-final-ui-update` | Yesterday | #4 | Final UI improvements and refinements |
| `phase-4-backend-integration` | 2 days ago | #2 | Production backend setup and integration |
| `phase-3-UI-Part2` | 2 days ago | — | Frontend UI Part 2 development |
| `phase-2-UI-Update` | 2 days ago | — | Frontend UI initial update |
| `phase-1-backend-test` | 2 days ago | — | Backend test and database validation |

> **Branching convention:** Each branch maps 1:1 to a project phase, making development history fully traceable and reviewable via GitHub pull requests.

---

## 🏗️ Development Phases

### 🟢 Phase 1 — Hardware + Backend Test Environment

Focused on validating the full sensor-to-database pipeline in isolation before cloud deployment.

**Goals:**
- Sensor integration with ESP32
- WiFi communication verification
- JSON transmission testing
- Database insertion validation
- PostgreSQL query verification

**Test Architecture:**
```
ESP32  →  backend-test (Node.js @ Port 6000)  →  PostgreSQL (iot_test_env)
```

**Test Database Schema:**
```sql
CREATE TABLE sensor_test_data (
    id          SERIAL PRIMARY KEY,
    temperature FLOAT,
    humidity    FLOAT,
    air_quality INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**ESP32 JSON Payload:**
```json
{
  "temperature": 27.4,
  "humidity": 61.2,
  "air_quality": 1432
}
```

**Phase 1 Verification Results:**

| Metric | Location |
|--------|---------|
| 🌡️ Temperature Data | `backend-test/results/` |
| 💧 Humidity Data | `backend-test/results/` |
| 🌫️ Air Quality Data | `backend-test/results/` |

---

### 🔵 Phase 2–3 — UI Development

Initial frontend dashboard built with HTML5, CSS3, and Chart.js, iterated across two phases.

---

### 🔵 Phase 4 — Production Backend

After Phase 1 validation, the backend was refactored into a production-ready structure.

**Backend Stack:**

| Package | Purpose |
|---------|---------|
| `Node.js` | Runtime |
| `Express.js` | REST API framework |
| `pg` (node-postgres) | PostgreSQL driver |
| `dotenv` | Environment variable management |
| `cors` | Cross-origin request handling |

**Environment Variables:**
```env
DATABASE_URL=postgresql://user:password@host:port/database
PORT=5000
```

---

### 🟣 Phase 5–6 — Cloud Deployment

| Service | Platform | Purpose |
|---------|----------|---------|
| Backend API | **Render** | Auto-deploy from GitHub |
| Database | **Supabase** | Managed PostgreSQL |
| Frontend | **Netlify** | Static site hosting |

**Netlify Configuration:**

| Setting | Value |
|---------|-------|
| Base Directory | `frontend` |
| Publish Directory | `.` |
| Build Command | *(empty)* |

---

### 🟡 Phase 7–8 — Final Frontend + Netlify Integration

Full Render backend + Netlify deployment with confirmed live data flow, polished UI, AQI alerts, health scores, and CSV export.

**Features Implemented:**

| Feature | Description |
|---------|-------------|
| 🌡️ Temperature Card | Live reading with min/avg/max + sparkline |
| 💧 Humidity Card | Live reading with min/avg/max + sparkline |
| 🌫️ AQI Card | Color-coded glow border (Clean/Moderate/Poor) |
| 🎯 Health Score Gauge | Circular donut gauge with composite score |
| 📈 Real-Time Analytics | 3 live Chart.js time-series graphs |
| 📊 Historical Dashboard | Full date-filtered history page |
| 📋 Data Table | Paginated records with color-coded AQI badges |
| 📤 CSV Export | Download all historical data as `.csv` |
| ⚠️ AQI Alert Banner | Top banner warning when AQI crosses thresholds |
| 🎛️ Sensor Gauges | Arc-style gauges for Temperature, Humidity, AQI |
| 📍 Location Detection | Auto-detected city shown in the header |
| 📱 Responsive Design | Mobile + desktop layouts |

---

## 📡 Production API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/update` | Insert new sensor reading from ESP32 |
| `GET` | `/api/latest` | Fetch the most recent reading |
| `GET` | `/api/history` | Fetch all historical readings |

---

## 🗄️ Database Design (Production)

```sql
CREATE TABLE sensor_data (
    id          SERIAL PRIMARY KEY,
    temperature FLOAT,
    humidity    FLOAT,
    air_quality INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 Full Data Flow

```
1.  ESP32 initializes and reads sensors
2.  ESP32 connects to WiFi network
3.  DHT11 provides Temperature + Humidity readings
4.  MQ135 provides Air Quality Index (AQI) reading
5.  ESP32 constructs JSON payload
6.  ESP32 sends HTTPS POST → Render Backend
7.  Backend validates and sanitizes data
8.  Data is inserted into Supabase PostgreSQL
9.  Frontend polls  GET /api/latest  → updates sensor cards
10. Frontend polls  GET /api/history → updates graphs + table
11. AQI threshold checked → alert banner shown if needed
12. LOOP repeats every 5 seconds
```

---

## 📈 System Flowchart

```
START
  │
  ▼
Initialize Sensors (DHT11 + MQ135)
  │
  ▼
Connect to WiFi
  │
  ├─── ✗ Failed → Retry with reconnection logic
  │
  ▼ ✓ Connected
Read DHT11 → Temperature, Humidity
  │
  ▼
Read MQ135 → Air Quality Index
  │
  ▼
Build JSON Payload
  │
  ▼
Send HTTPS POST to Render Backend
  │
  ├─── ✗ HTTP Error → Log & retry
  │
  ▼ ✓ 200 OK
Backend Validates & Inserts → Supabase PostgreSQL
  │
  ▼
Frontend Fetches /api/latest + /api/history
  │
  ▼
Render Graphs + Update Cards + AQI Alert Check
  │
  ▼
Wait 5 Seconds → LOOP ↑
```

---

## 🔐 Error Handling

| Scenario | Handling Strategy |
|----------|------------------|
| WiFi Disconnection | Auto-reconnect logic on ESP32 |
| HTTP Error Response | Validation + retry mechanism |
| Backend Cold Start | Cold start delay handling |
| CORS Issues | Configured CORS middleware |
| Secret Exposure | Environment variables via `.env` + Render secrets |

---

## 🚀 Final Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│  Netlify  — Frontend Dashboard                   │
│  https://envcore-dashboard-dbms-tt.netlify.app   │
└───────────────────┬──────────────────────────────┘
                    │  REST API (HTTPS)
                    ▼
┌──────────────────────────────────────────────────┐
│  Render  — Node.js Backend                       │
│  https://your-api.onrender.com                   │
└───────────────────┬──────────────────────────────┘
                    │  SQL (pg driver)
                    ▼
┌──────────────────────────────────────────────────┐
│  Supabase  — PostgreSQL Cloud DB                 │
│  Managed, auto-scaled, backed up                 │
└───────────────────┬──────────────────────────────┘
                    │  HTTPS POST (every 5s)
                    ▼
┌──────────────────────────────────────────────────┐
│  ESP32  — IoT Device                             │
│  DHT11 (Temp + Humidity) + MQ135 (AQI)          │
└──────────────────────────────────────────────────┘
```

---

## ✅ Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 🟢 Phase 1 | Backend Test Validation | ✅ Complete |
| 🟢 Phase 2–3 | UI Development | ✅ Complete |
| 🟢 Phase 4 | Production Backend | ✅ Complete |
| 🟢 Phase 5–6 | Cloud Deployment | ✅ Complete |
| 🟢 Phase 7–8 | Frontend + Netlify Integration | ✅ Complete |
| 🟡 Phase 9 | Advanced Analytics & ML | 🔄 Planned |

---

## 🎯 Future Improvements

- 🔔 **Push notifications** for AQI threshold breaches
- 📊 **Advanced analytics** — rolling averages, trend analysis
- 🧠 **Predictive ML model** for AQI forecasting
- 📱 **Mobile app** (React Native or Flutter)
- 🔐 **User authentication** system with role-based access
- 📡 **MQTT protocol** for lower-latency IoT messaging
- 🛰️ **Edge computing layer** for local data pre-processing

---

## 👨‍💻 Author

**Tapananshu Tripathy**
B.Tech — Computer Science & Engineering
KIIT University, Bhubaneswar, Odisha

---

<div align="center">

*Built with ❤️ as a DBMS Mini Project — demonstrating end-to-end IoT + cloud engineering.*

⭐ *If you found this helpful, consider starring the repo!*

</div>
