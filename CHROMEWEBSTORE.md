# Chrome Web Store Listing — LG Smart TV Remote

*Last Updated: 2026-10-24*

---

## 1. Store Metadata

- **Extension Name:** LG Smart TV Remote
- **Short Description:** Control your LG webOS Smart TV directly from Chrome: volume, D-Pad, apps, playback, and cast tab URLs.
- **Category:** Productivity / Smart Home
- **Default Language:** English
- **Version:** 1.0.0

---

## 2. Detailed Description

Take control of your LG webOS Smart TV directly from your Google Chrome browser!

Whether you want to adjust the TV volume, pause a movie, launch YouTube/Netflix, or cast the webpage/video you are currently browsing straight to the TV screen, the LG Smart TV Remote Chrome Extension makes it instantaneous.

### Key Features:
- **Instant Browser Access:** Control your TV from a sleek dropdown popup or dock it in Chrome's modern Side Panel while working.
- **Cast Active Tab / Links:** One-click casting sends any web link or current Chrome tab directly to your LG TV web browser.
- **Hardware-Level D-Pad Navigation:** Tactile Up, Down, Left, Right, OK, Back, Home, and Menu buttons with keyboard arrow support.
- **Audio & Media Control:** Volume rockers, precise volume percentage slider (0–100%), instant mute toggle, and Play/Pause/Skip controls.
- **Quick App Launcher:** Switch to YouTube, Netflix, Prime Video, Spotify, Apple TV, or HDMI inputs with a single tap.
- **Magic Pointer Touchpad:** Move the TV on-screen cursor directly from your trackpad or mouse.
- **On-Screen Toast Notifications:** Send quick message banners to the TV display.

*Note: Requires the lightweight local companion server (`python3 server.py`) running on your computer to communicate with the TV over your local network.*

---

## 3. Permissions Justifications

| Permission | Justification |
| :--- | :--- |
| `tabs` | Needed to retrieve the current active tab's URL when the user clicks "Cast Tab" or uses the right-click menu to cast a webpage to their LG TV. |
| `sidePanel` | Allows the user to dock the remote in Chrome's native Side Panel for persistent multitasking while browsing. |
| `storage` | Stores user interface preferences (such as last active tab and volume increments) locally. |
| `contextMenus` | Adds a right-click option ("Cast link / page to LG TV") to easily send any link to the TV web browser. |
| `host_permissions` (`http://localhost:8765/*`, `ws://localhost:8765/*`) | Communicates with the local Python backend server that bridges commands to the LG TV over secure WebSockets. |

---

## 4. Privacy & Data Use

- **Data Collection:** None. The extension does not collect, track, or transmit any user data, browsing history, or analytics to external servers.
- **Local Network Use:** All commands (volume, buttons, app launch) are sent strictly to your local machine (`http://localhost:8765`) and your LG TV over your private home Wi-Fi network.

---

## 5. How to Load in Developer Mode

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `extension/` folder in this repository.
5. Pin the extension to your Chrome toolbar and enjoy!
