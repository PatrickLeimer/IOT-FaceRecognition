# FaceGuard — IoT Face Recognition System

Real-time face recognition using an ESP32-CAM, a Python backend, Firebase, and a React dashboard.

```
ESP32-CAM  →  FastAPI Backend  →  Firebase Firestore + Storage
                                          ↓
                                   React Dashboard (live updates)
```

---

## Project Structure

```
├── backend/                    Python FastAPI server
│   ├── main.py                 API endpoints
│   ├── face_engine.py          Face detection & matching logic
│   ├── firebase_service.py     Firebase read/write
│   ├── config.py               Thresholds and constants
│   ├── requirements.txt        Python dependencies
│   └── serviceAccountKey.json  Firebase Admin SDK key (keep secret)
│
└── face-dashboard/             React web app
    ├── src/
    │   ├── pages/
    │   │   ├── LiveFeed.jsx    Real-time event stream
    │   │   ├── People.jsx      Manage enrolled users
    │   │   └── Enroll.jsx      Upload face photos
    │   ├── components/
    │   └── firebase.js         Firebase client config
    └── .env                    Backend URL config
```

---

## Prerequisites

### On your PC

| Tool | Purpose | Install |
|------|---------|---------|
| Python 3.9+ | Run the backend | python.org |
| Node.js 18+ | Run the React app | nodejs.org |
| VS Build Tools + CMake | Compile dlib (face recognition) | See below |

### Visual Studio Build Tools (Windows only — required for `face_recognition`)

1. Download from **visualstudio.microsoft.com/visual-cpp-build-tools/**
2. In the installer check **"Desktop development with C++"**
3. In the right sidebar also check **"C++ CMake tools for Windows"**
4. Install (~3–4 GB), then restart your terminal
5. Verify: `cmake --version`

> **Want to skip compiling?** Use a pre-built dlib wheel instead (see Backend Setup step 3).

### Firebase Project

1. Go to **console.firebase.google.com** → create a new project
2. Enable **Firestore Database** (Build → Firestore → Create in test mode)
3. Enable **Storage** (Build → Storage → Set up in test mode)
4. Get your **service account key**: Project Settings → Service Accounts → Generate new private key → save as `backend/serviceAccountKey.json`
5. Get your **web app config**: Project Settings → General → Add app (web icon) → copy the `firebaseConfig` object

---

## Running the Backend

### 1. Configure Firebase storage bucket

Open `backend/config.py` and confirm the storage bucket matches your Firebase project:

```python
FIREBASE_STORAGE_BUCKET = "your-project-id.firebasestorage.app"
```

### 2. Create a virtual environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> **Windows — if dlib fails to compile**, use a pre-built wheel instead:
> ```bash
> # Replace cp311 with your Python version (cp310, cp311, cp312)
> pip install https://github.com/z-mahmud22/Dlib_Windows_Python3.x/raw/main/dlib-19.24.1-cp311-cp311-win_amd64.whl
> pip install face-recognition
> pip install fastapi uvicorn[standard] numpy Pillow firebase-admin python-multipart
> ```

The `dlib` compile takes **5–10 minutes** — the wall of compiler output is normal.

### 4. Start the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Loaded 0 users with face data.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 5. Verify it works

```bash
curl http://localhost:8000/health
# → {"status":"ok","usersLoaded":0}
```

---

## Local Network Setup

The XIAO and your laptop must be on the **same WiFi network**. The XIAO POSTs to your laptop's LAN IP directly — no tunnel needed.

### 1. Find your laptop's IP

**Windows:**
```
ipconfig
```
Look for `IPv4 Address` under **Wireless LAN adapter Wi-Fi** — e.g. `192.168.1.42`.

**macOS:**
```bash
ipconfig getifaddr en0
```

### 2. Start the backend bound to all interfaces

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

The `--host 0.0.0.0` flag is what lets devices on the LAN reach the server (not just `localhost`).

### 3. Allow Python through the Windows Firewall

The first time you run uvicorn, Windows will show a security popup — click **"Allow access"** and make sure **Private networks** is checked.

### 4. Verify reachability from another device

From a phone on the **same WiFi**, open a browser and navigate to:
```
http://<laptop-ip>:8000/health
```
You should see `{"status":"ok","usersLoaded":0}`. If the page times out, check the firewall step above.

### 5. Set the IP in the frontend `.env`

Open `face-dashboard/.env` and set:
```
VITE_BACKEND_URL=http://192.168.1.42:8000
```
Replace `192.168.1.42` with the actual IP from step 1.

### 6. Set the IP in the XIAO firmware

The firmware has a `backendUrl` constant (or similar) — update it to match:
```cpp
const char* backendUrl = "http://192.168.1.42:8000/recognize";
```
Flash the board after changing it.

> **Classroom / university WiFi warning:** Many campus networks enable **AP isolation**, which blocks traffic between devices on the same SSID. If the XIAO can't reach the laptop even with the right IP, use a **phone hotspot** instead — connect both the laptop and the XIAO to the hotspot, then repeat the `ipconfig` step to get the new IP.

---

## Running the React Dashboard

### 1. Set the backend URL

Open `face-dashboard/.env`:

```
VITE_BACKEND_URL=http://192.168.1.42:8000
```

Replace `192.168.1.42` with your laptop's actual LAN IP (see Local Network Setup above).

### 2. Install and start

```bash
cd face-dashboard
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Enrolling Your First Person

The backend starts with 0 known faces — recognition won't work until you enroll someone.

**Option A — Use the web app:**
1. Go to `http://localhost:5173/enroll`
2. Drag and drop 5–10 photos of the person
3. Enter their name and click Enroll

**Option B — curl:**
```bash
curl -X POST http://localhost:8000/enroll \
  -F "name=Patrick" \
  -F "image=@/path/to/photo.jpg"
```

Repeat with different photos (different angles, lighting, expressions) for best accuracy. After enrolling, the backend reloads automatically — no restart needed.

---

## ESP32-CAM Setup

### Wiring

```
ESP32-CAM          I2C LCD (16x2)
---------          --------------
GPIO 14  ────────→ SDA
GPIO 15  ────────→ SCL
5V       ────────→ VCC
GND      ────────→ GND
```

### Arduino IDE setup

1. Add ESP32 board support: **File → Preferences → Additional boards URLs:**
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
2. Install via **Tools → Board → Boards Manager** → search "esp32"
3. Install libraries via **Tools → Manage Libraries:**
   - `ArduinoJson`
   - `LiquidCrystal I2C`

### Flash settings

- **Board:** AI Thinker ESP32-CAM
- **Port:** whichever COM port your FTDI shows up as
- **Upload Speed:** 115200

### Update these three lines before flashing

```cpp
const char* ssid      = "YOUR_WIFI_SSID";
const char* password  = "YOUR_WIFI_PASSWORD";
const char* backendUrl = "http://192.168.1.42:8000/recognize";
```

---

## Both Processes Running

You need two terminals running simultaneously:

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 — Backend | `backend/` | `uvicorn main:app --reload --host 0.0.0.0 --port 8000` |
| 2 — Frontend | `face-dashboard/` | `npm run dev` |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Check server status |
| `POST` | `/recognize` | Send an image, get back name + confidence |
| `POST` | `/enroll` | Enroll a new face photo |
| `POST` | `/correct/{event_id}` | Fix a misidentified event |
| `POST` | `/reload` | Reload face encodings from Firebase |
| `GET` | `/users` | List all enrolled users |

---

## Tuning Recognition Accuracy

Edit the threshold in `backend/config.py`:

```python
CONFIDENCE_THRESHOLD = 0.75   # raise if too many false matches
                               # lower if too many "needs review"
```

| Confidence | Status shown | Meaning |
|------------|-------------|---------|
| ≥ 0.75 | Recognized (green) | High confidence match |
| 0.50 – 0.74 | Needs Review (yellow) | Possible match, needs confirmation |
| < 0.50 | Unknown (red) | No match found |

Tips:
- Start with 5–10 enrolled photos per person
- Use varied lighting and angles when enrolling
- ESP32-CAM has a basic sensor — you may need to lower the threshold to ~0.65
- The "Needs Review" confirmation flow in the dashboard will also improve accuracy over time

---

## Troubleshooting

**`dlib` fails to install on Windows**
→ Make sure VS Build Tools with C++ workload and CMake tools are installed, then restart your terminal. Or use the pre-built wheel (see Backend Setup).

**`serviceAccountKey.json` error on startup**
→ Make sure the file is in the `backend/` folder and the path in `config.py` is `"serviceAccountKey.json"`.

**XIAO gets HTTP error / times out**
→ Face recognition takes 1–3 seconds. The firmware has a 15s timeout. If it still fails: (1) confirm the laptop IP in the firmware matches `ipconfig` output, (2) verify the backend is running with `--host 0.0.0.0`, (3) test `/health` from a phone browser on the same network, (4) if on campus WiFi try a phone hotspot instead (AP isolation).

**`usersLoaded: 0` after enrolling**
→ Click the "Reload Model" button in the dashboard nav, or call `POST /reload`.

**LCD shows garbage characters**
→ Wrong I2C address. Try `0x3F` instead of `0x27` in the LCD constructor: `LiquidCrystal_I2C lcd(0x3F, 16, 2)`.

**Images not showing in dashboard**
→ Firebase Storage is likely in private mode. In the Firebase console, go to Storage → Rules and set:
```
allow read: if true;
```
