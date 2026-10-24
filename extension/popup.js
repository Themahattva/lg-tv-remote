// LG TV Remote - Chrome Extension Popup & Side Panel Logic
(function () {
  const SERVER_BASE = "http://localhost:8765";
  const WS_URL = "ws://localhost:8765/ws";

  let ws = null;
  let isConnected = false;
  let currentVolume = 15;
  let isMuted = false;

  // Elements
  const statusDot = document.getElementById("ext-status-dot");
  const statusText = document.getElementById("ext-status-text");
  const offlineBanner = document.getElementById("ext-offline-banner");
  const extTitle = document.getElementById("ext-title");

  const volNum = document.getElementById("vol-num");
  const volSlider = document.getElementById("vol-slider");
  const volSliderVal = document.getElementById("vol-slider-val");
  const muteLabel = document.getElementById("mute-label");
  const appsList = document.getElementById("apps-list");
  const touchpadArea = document.getElementById("touchpad-area");

  const btnCastTab = document.getElementById("btn-cast-tab");
  const btnSidePanel = document.getElementById("btn-side-panel");

  // WebSocket connection
  function connectWs() {
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        offlineBanner.style.display = "none";
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleMessage(msg);
        } catch (err) {}
      };
      ws.onclose = () => {
        updateStatus(false);
        offlineBanner.style.display = "block";
        setTimeout(connectWs, 2500);
      };
      ws.onerror = () => {
        updateStatus(false);
        offlineBanner.style.display = "block";
      };
    } catch (e) {
      updateStatus(false);
      offlineBanner.style.display = "block";
    }
  }

  function handleMessage(msg) {
    if (msg.type === "init_state") {
      updateStatus(msg.connected);
      if (msg.model_info?.product_name) {
        extTitle.textContent = `LG TV (${msg.model_info.product_name})`;
      }
      if (msg.volume !== undefined) updateVolume(msg.volume, msg.muted);
      if (msg.apps && msg.apps.length > 0) renderApps(msg.apps);
    } else if (msg.type === "volume_update") {
      if (msg.volume !== undefined) updateVolume(msg.volume, msg.muted);
    } else if (msg.type === "apps_loaded") {
      if (msg.data) renderApps(msg.data);
    } else if (msg.type === "paired") {
      updateStatus(true);
    } else if (msg.type === "disconnected") {
      updateStatus(false);
    }
  }

  function updateStatus(connected) {
    isConnected = connected;
    if (connected) {
      statusText.textContent = "Connected";
      statusDot.className = "status-dot connected";
      offlineBanner.style.display = "none";
    } else {
      statusText.textContent = "Offline / Waiting";
      statusDot.className = "status-dot disconnected";
    }
  }

  function updateVolume(val, muted) {
    currentVolume = val;
    isMuted = !!muted;
    volNum.textContent = currentVolume;
    volSlider.value = currentVolume;
    volSliderVal.textContent = `${currentVolume}%`;
    muteLabel.textContent = isMuted ? "Unmute" : "Mute";
  }

  function sendWs(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  async function postApi(endpoint, body = {}) {
    try {
      const res = await fetch(`${SERVER_BASE}/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      offlineBanner.style.display = "block";
    }
  }

  function sendKey(keyName) {
    sendWs({ action: "key", key: keyName });
  }

  // Cast Current Tab to LG TV
  btnCastTab?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        btnCastTab.textContent = "Casting...";
        await postApi("browser/open", { url: tab.url });
        btnCastTab.textContent = "Cast Tab ✓";
        setTimeout(() => {
          btnCastTab.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
              <polyline points="17 2 12 7 7 2"></polyline>
            </svg>
            Cast Tab
          `;
        }, 1500);
      }
    } catch (err) {
      console.error("Cast tab error:", err);
    }
  });

  // Open in Side Panel
  btnSidePanel?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId && chrome.sidePanel) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close(); // Close popup when side panel opens
      }
    } catch (err) {
      console.error("Side panel open error:", err);
    }
  });

  // Render Apps
  function renderApps(apps) {
    if (!appsList) return;
    appsList.innerHTML = "";

    const priority = ["youtube", "netflix", "prime", "apple", "hdmi", "browser", "spotify"];
    const sorted = [...apps].sort((a, b) => {
      const aId = (a.id || "").toLowerCase();
      const bId = (b.id || "").toLowerCase();
      const aP = priority.findIndex(p => aId.includes(p));
      const bP = priority.findIndex(p => bId.includes(p));
      if (aP !== -1 && bP !== -1) return aP - bP;
      if (aP !== -1) return -1;
      if (bP !== -1) return 1;
      return (a.title || "").localeCompare(b.title || "");
    });

    sorted.slice(0, 15).forEach((app) => {
      const item = document.createElement("div");
      item.className = "app-item";
      item.title = app.title || app.id;

      let iconSrc = `${SERVER_BASE}/api/proxy-icon?url=${encodeURIComponent(app.icon || "")}`;
      if (!app.icon || !app.icon.startsWith("http")) {
        iconSrc = "icons/icon-48.png";
      }

      item.innerHTML = `
        <img src="${iconSrc}" alt="${app.title}" onerror="this.src='icons/icon-48.png'">
        <span>${app.title || app.id}</span>
      `;

      item.addEventListener("click", () => {
        postApi("apps/launch", { app_id: app.id });
      });

      appsList.appendChild(item);
    });
  }

  // Key buttons
  document.querySelectorAll("[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sendKey(btn.getAttribute("data-key"));
    });
  });

  // Power
  document.getElementById("btn-power-on")?.addEventListener("click", () => postApi("power/on"));
  document.getElementById("btn-power-off")?.addEventListener("click", () => postApi("power/off"));

  // Volume
  document.getElementById("btn-vol-up")?.addEventListener("click", () => sendWs({ action: "volume_up" }));
  document.getElementById("btn-vol-down")?.addEventListener("click", () => sendWs({ action: "volume_down" }));
  document.getElementById("btn-toggle-mute")?.addEventListener("click", () => sendWs({ action: "mute" }));

  volSlider?.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    volSliderVal.textContent = `${val}%`;
    volNum.textContent = val;
    sendWs({ action: "volume_set", value: val });
  });

  // Channel
  document.getElementById("btn-ch-up")?.addEventListener("click", () => postApi("channel/up"));
  document.getElementById("btn-ch-down")?.addEventListener("click", () => postApi("channel/down"));

  // Media
  let isPlaying = true;
  document.getElementById("btn-play-pause")?.addEventListener("click", () => {
    if (isPlaying) postApi("media/pause");
    else postApi("media/play");
    isPlaying = !isPlaying;
  });
  document.getElementById("btn-rewind")?.addEventListener("click", () => postApi("media/rewind"));
  document.getElementById("btn-fastforward")?.addEventListener("click", () => postApi("media/fastforward"));
  document.getElementById("btn-stop")?.addEventListener("click", () => postApi("media/stop"));

  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.getAttribute("data-tab"));
      if (target) target.classList.add("active");
    });
  });

  // Touchpad
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  if (touchpadArea) {
    touchpadArea.addEventListener("mousedown", (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = Math.round((e.clientX - lastX) * 1.5);
      const dy = Math.round((e.clientY - lastY) * 1.5);
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        sendWs({ action: "pointer_move", dx, dy, drag: 0 });
      }
    });

    window.addEventListener("mouseup", () => { isDragging = false; });
    document.getElementById("btn-touchpad-click")?.addEventListener("click", () => sendWs({ action: "pointer_click" }));
  }

  // Tools
  document.getElementById("btn-send-toast")?.addEventListener("click", () => {
    const msg = document.getElementById("toast-msg")?.value;
    if (msg) postApi("toast", { message: msg });
  });

  document.getElementById("btn-open-tv-url")?.addEventListener("click", () => {
    const url = document.getElementById("tv-url")?.value;
    if (url) postApi("browser/open", { url });
  });

  // Keyboard navigation
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); sendKey("UP"); break;
      case "ArrowDown": e.preventDefault(); sendKey("DOWN"); break;
      case "ArrowLeft": e.preventDefault(); sendKey("LEFT"); break;
      case "ArrowRight": e.preventDefault(); sendKey("RIGHT"); break;
      case "Enter": e.preventDefault(); sendKey("ENTER"); break;
      case "Backspace":
      case "Escape": e.preventDefault(); sendKey("BACK"); break;
      case "h":
      case "H": sendKey("HOME"); break;
      case "m":
      case "M": sendWs({ action: "mute" }); break;
      case "+":
      case "=": sendWs({ action: "volume_up" }); break;
      case "-":
      case "_": sendWs({ action: "volume_down" }); break;
    }
  });

  // Initial connect
  connectWs();
})();
