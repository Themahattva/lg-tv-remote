import asyncio
import json
import logging
import os
import socket
from typing import Callable, Optional, Dict, Any, List

from bscpylgtv import WebOsClient
import bscpylgtv.buttons as btn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LGWebOSTV")

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "tv_config.json")
KEY_STORE_PATH = os.path.join(os.path.dirname(__file__), "bscpylgtv_key.sqlite")

DEFAULT_CONFIG = {
    "ip": "10.164.100.142",
    "mac": "84:a3:29:83:dd:de",
    "client_key": None
}

def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                return {**DEFAULT_CONFIG, **json.load(f)}
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()

def save_config(cfg: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)

def send_wake_on_lan(mac_address: str):
    clean_mac = mac_address.replace(":", "").replace("-", "")
    if len(clean_mac) != 12:
        raise ValueError(f"Invalid MAC address: {mac_address}")
    packet = bytes.fromhex("FF" * 6 + clean_mac * 16)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.sendto(packet, ("255.255.255.255", 9))
        logger.info(f"Wake-on-LAN magic packet sent to {mac_address}")

def discover_tv_ip(timeout: float = 2.5) -> Optional[dict]:
    msg = (
        'M-SEARCH * HTTP/1.1\r\n'
        'HOST: 239.255.255.250:1900\r\n'
        'MAN: "ssdp:discover"\r\n'
        'MX: 2\r\n'
        'ST: urn:lge-com:service:webos-second-screen:1\r\n\r\n'
    )
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    s.settimeout(timeout)
    s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    try:
        s.sendto(msg.encode(), ('239.255.255.250', 1900))
        while True:
            try:
                data, addr = s.recvfrom(65507)
                decoded = data.decode(errors='ignore')
                if 'webos' in decoded.lower():
                    mac = None
                    for line in decoded.splitlines():
                        if 'WAKEUP: MAC=' in line.upper():
                            parts = line.split('MAC=')
                            if len(parts) > 1:
                                mac = parts[1].split(';')[0].strip()
                    return {"ip": addr[0], "mac": mac}
            except socket.timeout:
                break
    except Exception as e:
        logger.error(f"SSDP discovery error: {e}")
    finally:
        s.close()
    return None

class LGTVManager:
    def __init__(self, ip: Optional[str] = None, mac: Optional[str] = None):
        cfg = load_config()
        self.ip = ip or cfg.get("ip", "10.164.100.142")
        self.mac = mac or cfg.get("mac", "84:a3:29:83:dd:de")
        self.client_key = cfg.get("client_key")
        
        self.client: Optional[WebOsClient] = None
        self.is_connected = False
        self.is_paired = False
        self.pairing_in_progress = False
        
        self.current_volume: int = 15
        self.is_muted: bool = False
        self.installed_apps: List[dict] = []
        self.current_app_id: Optional[str] = None
        self.model_info: Dict[str, Any] = {}
        
        self.listeners: List[Callable[[dict], Any]] = []
        self.worker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    def add_listener(self, fn: Callable[[dict], Any]):
        self.listeners.append(fn)

    def remove_listener(self, fn: Callable[[dict], Any]):
        if fn in self.listeners:
            self.listeners.remove(fn)

    async def broadcast_status(self, event_type: str, data: Any = None):
        payload = {
            "type": event_type,
            "ip": self.ip,
            "mac": self.mac,
            "connected": self.is_connected,
            "paired": self.is_paired,
            "pairing_in_progress": self.pairing_in_progress,
            "volume": self.current_volume,
            "muted": self.is_muted,
            "current_app": self.current_app_id,
            "model_info": self.model_info,
            "data": data
        }
        for fn in list(self.listeners):
            try:
                res = fn(payload)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.error(f"Listener error: {e}")

    def update_ip_mac(self, ip: str, mac: Optional[str] = None):
        self.ip = ip
        if mac:
            self.mac = mac
        cfg = load_config()
        cfg["ip"] = self.ip
        if mac:
            cfg["mac"] = self.mac
        save_config(cfg)

    async def start(self):
        if self.worker_task and not self.worker_task.done():
            return
        self.worker_task = asyncio.create_task(self._run_loop())

    async def stop(self):
        if self.worker_task:
            self.worker_task.cancel()
        if self.client:
            try:
                await self.client.disconnect()
            except Exception:
                pass
        self.is_connected = False
        self.is_paired = False
        await self.broadcast_status("disconnected")

    async def _run_loop(self):
        while True:
            try:
                logger.info(f"Connecting bscpylgtv client to TV at {self.ip}...")
                await self.broadcast_status("connecting")

                # Create bscpylgtv client
                self.client = await WebOsClient.create(
                    self.ip,
                    key_file_path=KEY_STORE_PATH,
                    client_key=self.client_key,
                    ping_interval=5,
                    ping_timeout=15,
                    timeout_connect=5
                )

                await self.client.connect()
                self.is_connected = True
                self.is_paired = True
                self.client_key = self.client.client_key

                # Save client key
                if self.client_key:
                    cfg = load_config()
                    cfg["client_key"] = self.client_key
                    cfg["ip"] = self.ip
                    cfg["mac"] = self.mac
                    save_config(cfg)

                logger.info("Successfully connected and paired with LG TV!")

                # Fetch TV initial state
                await self._refresh_state()
                await self.broadcast_status("paired")

                # Keep-alive loop / watch connection
                while self.client and self.client.is_connected():
                    await asyncio.sleep(2)
                    # Sync volume periodically
                    try:
                        v = await self.client.get_volume()
                        m = await self.client.get_muted()
                        if v != self.current_volume or m != self.is_muted:
                            self.current_volume = v
                            self.is_muted = m
                            await self.broadcast_status("volume_update")
                    except Exception:
                        pass

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Connection error with TV: {e}. Retrying in 4 seconds...")
                self.is_connected = False
                await self.broadcast_status("disconnected", str(e))
                await asyncio.sleep(4)

    async def _refresh_state(self):
        if not self.client:
            return
        try:
            self.current_volume = await self.client.get_volume()
        except Exception:
            pass
        try:
            self.is_muted = await self.client.get_muted()
        except Exception:
            pass
        try:
            self.current_app_id = await self.client.get_current_app()
        except Exception:
            pass
        try:
            apps = await self.client.get_apps()
            if apps:
                self.installed_apps = apps
                await self.broadcast_status("apps_loaded", self.installed_apps)
        except Exception:
            pass
        try:
            self.model_info = await self.client.get_software_info()
        except Exception:
            pass

    # Remote Commands
    async def send_key(self, key_name: str) -> bool:
        if not self.client or not self.client.is_connected():
            return False
        
        key_upper = key_name.upper()
        # Aliases
        key_map = {
            "OK": "ENTER",
            "SELECT": "ENTER",
            "BACK": "BACK",
            "RETURN": "BACK",
            "HOME": "HOME",
            "MENU": "MENU",
            "EXIT": "EXIT",
            "INFO": "INFO",
            "UP": "UP",
            "DOWN": "DOWN",
            "LEFT": "LEFT",
            "RIGHT": "RIGHT",
            "RED": "RED",
            "GREEN": "GREEN",
            "YELLOW": "YELLOW",
            "BLUE": "BLUE",
            "MUTE": "MUTE",
            "VOLUMEUP": "VOLUMEUP",
            "VOLUMEDOWN": "VOLUMEDOWN",
            "CHANNELUP": "CHANNELUP",
            "CHANNELDOWN": "CHANNELDOWN",
            "PLAY": "PLAY",
            "PAUSE": "PAUSE",
            "STOP": "STOP",
            "REWIND": "REWIND",
            "FASTFORWARD": "FASTFORWARD",
            "DASH": "DASH",
            "ASTERISK": "ASTERISK"
        }
        target = key_map.get(key_upper, key_upper)
        try:
            await self.client.button(target, checkValid=False)
            return True
        except Exception as e:
            logger.error(f"Error pressing button {target}: {e}")
            return False

    async def pointer_move(self, dx: int, dy: int, drag: int = 0):
        if self.client and self.client.is_connected():
            try:
                await self.client.move(dx, dy, drag=drag)
            except Exception:
                pass

    async def pointer_click(self):
        if self.client and self.client.is_connected():
            try:
                await self.client.click()
            except Exception:
                pass

    async def volume_up(self):
        if self.client and self.client.is_connected():
            await self.client.volume_up()
            self.current_volume = await self.client.get_volume()
            await self.broadcast_status("volume_update")

    async def volume_down(self):
        if self.client and self.client.is_connected():
            await self.client.volume_down()
            self.current_volume = await self.client.get_volume()
            await self.broadcast_status("volume_update")

    async def set_volume(self, volume: int):
        if self.client and self.client.is_connected():
            await self.client.set_volume(volume)
            self.current_volume = volume
            await self.broadcast_status("volume_update")

    async def set_mute(self, mute: bool):
        if self.client and self.client.is_connected():
            await self.client.set_mute(mute)
            self.is_muted = mute
            await self.broadcast_status("volume_update")

    async def toggle_mute(self):
        return await self.set_mute(not self.is_muted)

    async def channel_up(self):
        if self.client and self.client.is_connected():
            await self.client.channel_up()

    async def channel_down(self):
        if self.client and self.client.is_connected():
            await self.client.channel_down()

    async def play(self):
        if self.client and self.client.is_connected():
            await self.client.play()

    async def pause(self):
        if self.client and self.client.is_connected():
            await self.client.pause()

    async def stop(self):
        if self.client and self.client.is_connected():
            await self.client.stop()

    async def rewind(self):
        if self.client and self.client.is_connected():
            await self.client.rewind()

    async def fast_forward(self):
        if self.client and self.client.is_connected():
            await self.client.fast_forward()

    async def power_off(self):
        if self.client and self.client.is_connected():
            await self.client.power_off()

    async def power_on(self):
        if self.mac:
            send_wake_on_lan(self.mac)
            return True
        return False

    async def launch_app(self, app_id: str):
        if self.client and self.client.is_connected():
            await self.client.launch_app(app_id)
            self.current_app_id = app_id
            await self.broadcast_status("app_launched", app_id)

    async def close_app(self, app_id: str):
        if self.client and self.client.is_connected():
            await self.client.close_app(app_id)

    async def open_url(self, url: str):
        if self.client and self.client.is_connected():
            await self.client.open_url(url)

    async def send_toast(self, message: str, icon_url: Optional[str] = None):
        if self.client and self.client.is_connected():
            await self.client.send_message(message, icon_path=icon_url)

    async def get_apps(self):
        if self.client and self.client.is_connected():
            self.installed_apps = await self.client.get_apps()
        return self.installed_apps
