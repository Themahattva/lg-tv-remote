# 📺 LG webOS Smart TV Web Remote

A modern, high-performance web-based remote control application for LG Smart TVs running webOS (including webOS 24+). Built with Python (FastAPI + `bscpylgtv` engine) and a sleek, glassmorphic responsive HTML5/CSS3 frontend.

![LG TV Remote Banner](https://img.shields.io/badge/LG_webOS-24+-blue?logo=lg&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-Realtime-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **Tactile D-Pad Navigation:** Circular directional controller (Up, Down, Left, Right, OK / Enter) with instant hardware feedback.
- **Audio & Volume Control:** Volume Up / Down rockers, real-time volume slider (0–100%), and one-click Mute toggle.
- **Channel & Media Playback:** Channel navigation plus Play, Pause, Stop, Rewind, and Fast-Forward controls.
- **Dynamic App Launcher:** Automatically queries installed apps directly from the TV (YouTube, Netflix, Prime Video, JioCinema, Spotify, Apple TV, HDMI inputs) with icons and one-click switching.
- **Magic Pointer Touchpad:** Move your laptop trackpad or mouse cursor to steer the on-screen pointer just like an LG Magic Remote.
- **Direct Digit Keypad (0–9):** For entering channel numbers or PINs directly.
- **Smart Tools:**
  - **On-Screen Toast Notifications:** Send instant message banners to the TV screen.
  - **Browser Launcher:** Open any website URL in the TV's built-in web browser.
  - **Wake-on-LAN Power-On:** Turn the TV on via network magic packet when in standby mode.
- **Full Keyboard Shortcuts:**
  - `▲` `▼` `◄` `►` : D-Pad navigation
  - `Enter` : OK / Select
  - `Esc` / `Backspace` : Back
  - `Space` : Play / Pause
  - `+` / `-` : Volume Up / Down
  - `M` : Mute / Unmute
  - `H` : Home Dashboard

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.10+
- LG Smart TV connected to the same local Wi-Fi or Ethernet network

### 2. Installation
```bash
git clone https://github.com/Themahattva/lg-tv-remote.git
cd lg-tv-remote

python3 -m pip install -r requirements.txt
```

### 3. Running the Server
```bash
python3 server.py
```
Open **[http://localhost:8765](http://localhost:8765)** in your web browser.

*(You can also access the remote from your phone or tablet on the same Wi-Fi by visiting `http://<your-laptop-ip>:8765`!)*

---

## ⚙️ Configuration

The app auto-detects LG TVs using UPnP/SSDP. You can also specify your TV's IP address and MAC address directly in `tv_config.json`:

```json
{
  "ip": "10.164.100.142",
  "mac": "84:a3:29:83:dd:de",
  "client_key": "e687b0e10830aa04651ab167ef0fb0ed"
}
```

On first run, an on-screen pairing prompt will appear on your TV. Click **Accept** on your TV remote once, and the pairing key is saved permanently.

---

## 🛠️ Tech Stack

- **Backend:** Python 3, FastAPI, Uvicorn, WebSockets, `bscpylgtv` (SSL/WSS signed JWT authentication)
- **Frontend:** Vanilla HTML5, CSS3 Glassmorphism, Vanilla JS with WebSocket real-time state synchronization

---

## 📄 License
MIT License. Feel free to use and customize for your smart home setup!
