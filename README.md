# BikerAlert (Expo) — Driver/Cyclist proximity alerts

BikerAlert is a prototype that warns drivers and cyclists about nearby users via real‑time Socket.IO messages, map visualization, and image detection. This README summarizes the Expo implementation found in [expo_biker_alert/](expo_biker_alert). 

- Mobile app: [expo_biker_alert/App.tsx](expo_biker_alert/App.tsx) (registered in [expo_biker_alert/index.ts](expo_biker_alert/index.ts))
- Backend (Socket.IO): [backend/server.ts](backend/server.ts)

Core features (Expo app):
- Select role (Driver or Cyclist), start GPS tracking, and see your position on a map.
- Receives “alert” events from the backend and displays:
  - Directional message using heading-based calculation
    - [`calculateBearing`](expo_biker_alert/App.tsx) and [`determineRelativePosition`](expo_biker_alert/App.tsx)
  - Animated warning overlay and a temporary marker for the other user
  - Plays an alert sound 
- Sends periodic location “update” events to the server (500 ms) when tracking

Key technologies:
- Location: `expo-location`
- Maps: `react-native-maps`
- Real-time: `socket.io-client`

How it works (data flow):
1. App streams location updates (id, userType, latitude, longitude) on “update”.
2. Server emits “alert” events to nearby peers with fields: type, from, fromType, latitude, longitude, distance.
3. App computes relative direction with [`determineRelativePosition`](expo_biker_alert/App.tsx), shows an animated overlay, places a temporary marker, and plays a sound.

---

## Reproducibility

Prerequisites:
- Python 3.10+ and pip (for the backend)
- Node.js 18+ and npm (for the Expo app)
- iOS simulator/Xcode or Android emulator/Android Studio (or real devices with Expo Go)
- A local network where phone and server can reach each other

### 1) Start the backend (Python + Socket.IO)

From the backend folder (adjust path as needed):

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

Run the server (pick the stack your backend uses):

- FastAPI + python-socketio (ASGI):
  ```sh
  uvicorn app:app --host 0.0.0.0 --port 8080
  ```

Notes:
- Ensure CORS allows your app origin.
- The server should listen on the port the app expects (8080 by default).
- Event contract:
  - Client emits “update” with: `{ id, userType, latitude, longitude }`
  - Server emits “alert” with: `{ type, from, fromType, latitude, longitude, distance }`

### 2) Configure the mobile app

Set the Socket.IO endpoint in [expo_biker_alert/App.tsx](expo_biker_alert/App.tsx):

- `SOCKET_SERVER_URL` should point to your backend


### 3) Install and run the Expo app

From the repo root:

```sh
cd expo_biker_alert
npm install
npx expo start
```

- Open in iOS Simulator, Android Emulator, or scan the QR code with Expo Go on a device.
- Grant location permissions when prompted.

### 4) Test with two clients

- Launch the app on two devices/emulators.
- On one, select “Driver”; on the other, select “Cyclist”.
- Tap “Start Tracking” on both.
- Move (or simulate) positions so the backend emits “alert” events; you should see messages like:
  - “Cyclist to your right! Distance: 25m” or “Vehicle directly ahead! Distance: 40m”
- The alert overlay is animated and auto-hides after a short duration; the other user’s marker is also shown temporarily.





