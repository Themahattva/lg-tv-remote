// LG Smart TV Web Remote - Frontend Logic
(function () {
  let ws = null;
  let isConnected = false;
  let isPaired = false;
  let pairingActive = false;
  let currentVolume = 15;
  let isMuted = false;
  let apps = [];

  // DOM Elements
  const statusIndicator = document.getElementById("status-indicator");
  const statusText = document.getElementById("status-text");
  const tvIpDisplay = document.getElementById("tv-ip-display");
  const pairingBanner = document.getElementById("pairing-banner");
  
  const volDisplayNum = document.getElementById("vol-display-num");
  const volumeSlider = document.getElementById("volume-slider");
  const sliderVolVal = document.getElementById("slider-vol-val");
  const muteLabel = document.getElementById("mute-label");
  
  const appsContainer = document.getElementById("apps-container");
  const touchpadArea = document.getElementById("touchpad-area");
  
  // Settings Modal
  const settingsModal = document.getElementById("settings-modal");
  const btnSettingsOpen = document.getElementById("btn-settings-open");
  const btnSettingsClose = document.getElementById("btn-settings-close");
  const settingsIp = document.getElementById("settings-ip");
  const settingsMac = document.getElementById("settings-mac");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const btnDiscoverTv = document.getElementById("btn-discover-tv");

  // --- WebSocket Connection ---
  function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected to local remote server.");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    ws.onclose = () => {
      updateConnectionStatus(false, false, false);
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error("WS error", err);
    };
  }

  function handleServerMessage(msg) {
    if (msg.type === "init_state") {
      updateTvInfo(msg.ip, msg.mac);
      if (msg.model_info && msg.model_info.product_name) {
        const modelTitle = document.getElementById("tv-model-title");
        if (modelTitle) modelTitle.textContent = `LG Smart TV (${msg.model_info.product_name})`;
      }
      updateConnectionStatus(msg.connected, msg.paired, msg.pairing_in_progress);
      if (msg.volume !== undefined) updateVolume(msg.volume, msg.muted);
      if (msg.apps && msg.apps.length > 0) renderApps(msg.apps);
    } 
    else if (msg.type === "connecting") {
      statusText.textContent = "Connecting to TV...";
      statusIndicator.className = "status-dot";
    }
    else if (msg.type === "pairing_prompt") {
      updateConnectionStatus(true, false, true);
    }
    else if (msg.type === "paired") {
      updateConnectionStatus(true, true, false);
    }
    else if (msg.type === "disconnected") {
      updateConnectionStatus(false, isPaired, false);
    }
    else if (msg.type === "volume_update") {
      if (msg.volume !== undefined) updateVolume(msg.volume, msg.muted);
    }
    else if (msg.type === "apps_loaded") {
      if (msg.data) renderApps(msg.data);
    }
  }

  function updateTvInfo(ip, mac) {
    if (ip) {
      tvIpDisplay.textContent = `IP: ${ip}`;
      if (settingsIp) settingsIp.value = ip;
    }
    if (mac && settingsMac) {
      settingsMac.value = mac;
    }
  }

  function updateConnectionStatus(connected, paired, promptActive) {
    isConnected = connected;
    isPaired = paired;
    pairingActive = promptActive;

    if (pairingActive) {
      pairingBanner.style.display = "flex";
      statusText.textContent = "Pairing Prompt on TV";
      statusIndicator.className = "status-dot";
    } else {
      pairingBanner.style.display = "none";
      if (connected) {
        statusText.textContent = paired ? "Connected" : "Handshake OK";
        statusIndicator.className = "status-dot connected";
      } else {
        statusText.textContent = "Offline / Reconnecting";
        statusIndicator.className = "status-dot disconnected";
      }
    }
  }

  function updateVolume(val, muted) {
    currentVolume = val;
    isMuted = !!muted;
    volDisplayNum.textContent = currentVolume;
    volumeSlider.value = currentVolume;
    sliderVolVal.textContent = `${currentVolume}%`;
    muteLabel.textContent = isMuted ? "Unmute" : "Mute";
  }

  // --- API & WS Action Senders ---
  function sendWsCommand(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  async function postApi(endpoint, data = {}) {
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
    }
  }

  function sendKey(keyName) {
    // Send over WS for instant response
    sendWsCommand({ action: "key", key: keyName });
  }

  // --- Render Apps Grid ---
  function renderApps(appList) {
    apps = appList;
    if (!appsContainer) return;
    appsContainer.innerHTML = "";

    // Sort apps with priority (YouTube, Netflix, HDMI, Browser)
    const priority = ["youtube", "netflix", "prime", "apple", "hdmi", "browser"];
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

    sorted.forEach((app) => {
      const card = document.createElement("div");
      card.className = "app-card";
      card.title = `Launch ${app.title || app.id}`;

      let iconHtml = "";
      if (app.icon && app.icon.startsWith("http")) {
        const proxied = `/api/proxy-icon?url=${encodeURIComponent(app.icon)}`;
        iconHtml = `<img class="app-icon" src="${proxied}" alt="${app.title}" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'app-icon-placeholder\\'>${(app.title || 'A')[0]}</div>';">`;
      } else {
        const firstChar = (app.title || "A")[0].toUpperCase();
        iconHtml = `<div class="app-icon-placeholder">${firstChar}</div>`;
      }

      card.innerHTML = `
        ${iconHtml}
        <div class="app-title">${app.title || app.id}</div>
      `;

      card.addEventListener("click", () => {
        postApi("apps/launch", { app_id: app.id });
      });

      appsContainer.appendChild(card);
    });
  }

  // --- Remote Button Bindings ---
  document.querySelectorAll("[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-key");
      sendKey(key);
    });
  });

  // Power Buttons
  document.getElementById("btn-power-off")?.addEventListener("click", () => postApi("power/off"));
  document.getElementById("btn-power-off-secondary")?.addEventListener("click", () => postApi("power/off"));
  document.getElementById("btn-power-on")?.addEventListener("click", () => postApi("power/on"));
  document.getElementById("btn-wol-secondary")?.addEventListener("click", () => postApi("power/on"));

  // Volume & Mute
  document.getElementById("btn-vol-up")?.addEventListener("click", () => {
    sendWsCommand({ action: "volume_up" });
  });

  document.getElementById("btn-vol-down")?.addEventListener("click", () => {
    sendWsCommand({ action: "volume_down" });
  });

  document.getElementById("btn-toggle-mute")?.addEventListener("click", () => {
    sendWsCommand({ action: "mute" });
  });

  volumeSlider?.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    sliderVolVal.textContent = `${val}%`;
    volDisplayNum.textContent = val;
    sendWsCommand({ action: "volume_set", value: val });
  });

  // Channels
  document.getElementById("btn-ch-up")?.addEventListener("click", () => postApi("channel/up"));
  document.getElementById("btn-ch-down")?.addEventListener("click", () => postApi("channel/down"));

  // Media
  let isPlaying = true;
  document.getElementById("btn-play-pause")?.addEventListener("click", () => {
    if (isPlaying) {
      postApi("media/pause");
    } else {
      postApi("media/play");
    }
    isPlaying = !isPlaying;
  });
  document.getElementById("btn-rewind")?.addEventListener("click", () => postApi("media/rewind"));
  document.getElementById("btn-fastforward")?.addEventListener("click", () => postApi("media/fastforward"));
  document.getElementById("btn-stop")?.addEventListener("click", () => postApi("media/stop"));

  // Smart Tools (Toast & Browser)
  document.getElementById("btn-send-toast")?.addEventListener("click", () => {
    const msg = document.getElementById("toast-input")?.value;
    if (msg) postApi("toast", { message: msg });
  });

  document.getElementById("btn-open-url")?.addEventListener("click", () => {
    const url = document.getElementById("browser-url-input")?.value;
    if (url) postApi("browser/open", { url });
  });

  document.getElementById("btn-refresh-apps")?.addEventListener("click", async () => {
    const res = await fetch("/api/apps");
    const data = await res.json();
    if (data.apps) renderApps(data.apps);
  });

  // --- Magic Touchpad implementation ---
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  if (touchpadArea) {
    const handleMove = (clientX, clientY) => {
      const dx = Math.round((clientX - lastX) * 1.5);
      const dy = Math.round((clientY - lastY) * 1.5);
      lastX = clientX;
      lastY = clientY;

      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        sendWsCommand({ action: "pointer_move", dx, dy, drag: false });
      }
    };

    touchpadArea.addEventListener("mousedown", (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      handleMove(e.clientX, e.clientY);
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Touch support (for phones/tablets or Mac gestures)
    touchpadArea.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    }, { passive: true });

    touchpadArea.addEventListener("touchmove", (e) => {
      if (isDragging && e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    touchpadArea.addEventListener("touchend", () => {
      isDragging = false;
    });

    document.getElementById("btn-touchpad-click")?.addEventListener("click", () => {
      sendWsCommand({ action: "pointer_click" });
    });
  }

  // --- Navigation Tabs ---
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // --- Keyboard Shortcuts ---
  window.addEventListener("keydown", (e) => {
    // Skip if user is typing in an input field
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        sendKey("UP");
        break;
      case "ArrowDown":
        e.preventDefault();
        sendKey("DOWN");
        break;
      case "ArrowLeft":
        e.preventDefault();
        sendKey("LEFT");
        break;
      case "ArrowRight":
        e.preventDefault();
        sendKey("RIGHT");
        break;
      case "Enter":
        e.preventDefault();
        sendKey("ENTER");
        break;
      case "Backspace":
      case "Escape":
        e.preventDefault();
        sendKey("BACK");
        break;
      case "h":
      case "H":
        sendKey("HOME");
        break;
      case "m":
      case "M":
        sendWsCommand({ action: "mute" });
        break;
      case "+":
      case "=":
        sendWsCommand({ action: "volume_up" });
        break;
      case "-":
      case "_":
        sendWsCommand({ action: "volume_down" });
        break;
      case " ":
        e.preventDefault();
        if (isPlaying) {
          postApi("media/pause");
        } else {
          postApi("media/play");
        }
        isPlaying = !isPlaying;
        break;
    }
  });

  // --- Settings Modal Handlers ---
  btnSettingsOpen?.addEventListener("click", () => settingsModal.classList.add("active"));
  btnSettingsClose?.addEventListener("click", () => settingsModal.classList.remove("active"));

  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove("active");
  });

  btnSaveSettings?.addEventListener("click", async () => {
    const ip = settingsIp.value.trim();
    const mac = settingsMac.value.trim();
    if (!ip) return;
    btnSaveSettings.textContent = "Reconnecting...";
    await postApi("connect", { ip, mac });
    settingsModal.classList.remove("active");
    btnSaveSettings.textContent = "Save & Reconnect";
  });

  btnDiscoverTv?.addEventListener("click", async () => {
    btnDiscoverTv.textContent = "Scanning...";
    const res = await postApi("discover");
    if (res && res.found && res.device) {
      settingsIp.value = res.device.ip;
      if (res.device.mac) settingsMac.value = res.device.mac;
      alert(`Discovered LG TV at ${res.device.ip}!`);
    } else {
      alert("No LG TV found via SSDP broadcast. Please verify the IP manually.");
    }
    btnDiscoverTv.textContent = "Auto-Detect TV";
  });

  // Init WebSocket
  connectWebSocket();
})();
