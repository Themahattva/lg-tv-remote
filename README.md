# 📺 LG webOS Smart TV Web Remote & Chrome Extension

A modern, high-performance remote control application for LG Smart TVs running webOS (including webOS 24+). Built with Python (FastAPI + `bscpylgtv` engine), a sleek glassmorphic web UI, and a dedicated **Google Chrome Extension (Manifest V3)** with popup, side panel, and web link casting!

![LG TV Remote Banner](https://img.shields.io/badge/LG_webOS-24+-blue?logo=lg&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-yellow?logo=googlechrome&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **🌐 Google Chrome Extension (Manifest V3):**
  - **Toolbar Popup:** Access the entire tactile remote with one click without leaving your current browser tab.
  - **Chrome Side Panel:** Dock the remote on the right/left of Chrome to control the TV while browsing or working.
  - **Cast Current Tab / Links:** Instantly send any web page, article, or video URL directly into the TV's web browser.
  - **Context Menu:** Right-click any link or web page to select *"Cast link / page to LG TV 📺"*.
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

### 3. Running the Companion Server
```bash
python3 server.py
```
Open **[http://localhost:8765](http://localhost:8765)** in your web browser.

---

## 🧩 Installing the Chrome Extension

1. Open **Google Chrome** and go to `chrome://extensions`.
2. Turn on **Developer mode** (toggle switch in the top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select the `extension/` folder located in `/Users/mahattava/Developer/lg-tv-remote/extension`.
5. Pin the **LG TV Remote** icon to your Chrome toolbar!

Now you can control your TV, adjust volume, launch apps, and cast tabs directly from Chrome at any time!

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

---

## 📄 License
MIT License.
