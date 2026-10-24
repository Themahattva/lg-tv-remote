import asyncio
import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import requests

from tv_client import LGTVManager, discover_tv_ip, load_config, save_config

tv = LGTVManager()
active_websockets: List[WebSocket] = []

async def tv_event_listener(event: dict):
    dead = []
    for ws in active_websockets:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in active_websockets:
            active_websockets.remove(ws)

@asynccontextmanager
async def lifespan(app: FastAPI):
    tv.add_listener(tv_event_listener)
    await tv.start()
    yield
    await tv.stop()

app = FastAPI(title="LG Smart TV Web Remote", lifespan=lifespan)

# Request Models
class KeyRequest(BaseModel):
    key: str

class VolumeRequest(BaseModel):
    volume: int

class ToastRequest(BaseModel):
    message: str

class LaunchRequest(BaseModel):
    app_id: str

class UrlRequest(BaseModel):
    url: str

class ConnectRequest(BaseModel):
    ip: str
    mac: Optional[str] = None

# API Routes
@app.get("/api/status")
async def get_status():
    return {
        "ip": tv.ip,
        "mac": tv.mac,
        "connected": tv.is_connected,
        "paired": tv.is_paired,
        "pairing_in_progress": tv.pairing_in_progress,
        "volume": tv.current_volume,
        "muted": tv.is_muted,
        "current_app": tv.current_app_id,
        "model_info": tv.model_info,
        "apps": tv.installed_apps
    }

@app.post("/api/connect")
async def connect_tv(req: ConnectRequest):
    tv.update_ip_mac(req.ip, req.mac)
    await tv.stop()
    await tv.start()
    return {"status": "reconnecting", "ip": req.ip}

@app.post("/api/discover")
async def discover_tv():
    loop = asyncio.get_running_loop()
    found = await loop.run_in_executor(None, discover_tv_ip)
    if found:
        return {"found": True, "device": found}
    return {"found": False, "message": "No LG TV discovered on SSDP"}

@app.post("/api/key")
async def press_key(req: KeyRequest):
    success = await tv.send_key(req.key)
    return {"key": req.key, "success": success}

@app.post("/api/power/on")
async def power_on():
    sent = await tv.power_on()
    return {"sent_wake_on_lan": sent}

@app.post("/api/power/off")
async def power_off():
    await tv.power_off()
    return {"status": "power_off_sent"}

@app.post("/api/volume/up")
async def vol_up():
    await tv.volume_up()
    return {"volume": tv.current_volume}

@app.post("/api/volume/down")
async def vol_down():
    await tv.volume_down()
    return {"volume": tv.current_volume}

@app.post("/api/volume/set")
async def set_vol(req: VolumeRequest):
    await tv.set_volume(req.volume)
    return {"volume": tv.current_volume}

@app.post("/api/volume/mute")
async def toggle_mute():
    await tv.toggle_mute()
    return {"muted": tv.is_muted}

@app.post("/api/channel/up")
async def ch_up():
    await tv.channel_up()
    return {"status": "ok"}

@app.post("/api/channel/down")
async def ch_down():
    await tv.channel_down()
    return {"status": "ok"}

@app.post("/api/media/play")
async def media_play():
    await tv.play()
    return {"status": "ok"}

@app.post("/api/media/pause")
async def media_pause():
    await tv.pause()
    return {"status": "ok"}

@app.post("/api/media/stop")
async def media_stop():
    await tv.stop()
    return {"status": "ok"}

@app.post("/api/media/rewind")
async def media_rewind():
    await tv.rewind()
    return {"status": "ok"}

@app.post("/api/media/fastforward")
async def media_ff():
    await tv.fast_forward()
    return {"status": "ok"}

@app.get("/api/apps")
async def list_apps():
    apps = await tv.get_apps()
    return {"apps": apps}

@app.post("/api/apps/launch")
async def launch_app(req: LaunchRequest):
    await tv.launch_app(req.app_id)
    return {"launched": req.app_id}

@app.post("/api/toast")
async def send_toast(req: ToastRequest):
    await tv.send_toast(req.message)
    return {"toast": req.message}

@app.post("/api/browser/open")
async def open_url(req: UrlRequest):
    await tv.open_url(req.url)
    return {"url": req.url}

@app.get("/api/proxy-icon")
async def proxy_icon(url: str):
    try:
        r = requests.get(url, verify=False, timeout=3)
        return Response(content=r.content, media_type=r.headers.get("content-type", "image/png"))
    except Exception:
        raise HTTPException(status_code=404, detail="Image not found")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    # Send state immediately
    await websocket.send_json({
        "type": "init_state",
        "ip": tv.ip,
        "mac": tv.mac,
        "connected": tv.is_connected,
        "paired": tv.is_paired,
        "pairing_in_progress": tv.pairing_in_progress,
        "volume": tv.current_volume,
        "muted": tv.is_muted,
        "current_app": tv.current_app_id,
        "model_info": tv.model_info,
        "apps": tv.installed_apps
    })
    try:
        while True:
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                action = cmd.get("action")
                if action == "key":
                    await tv.send_key(cmd.get("key"))
                elif action == "pointer_move":
                    await tv.pointer_move(cmd.get("dx", 0), cmd.get("dy", 0), int(cmd.get("drag", 0)))
                elif action == "pointer_click":
                    await tv.pointer_click()
                elif action == "volume_set":
                    await tv.set_volume(int(cmd.get("value", 15)))
                elif action == "volume_up":
                    await tv.volume_up()
                elif action == "volume_down":
                    await tv.volume_down()
                elif action == "mute":
                    await tv.toggle_mute()
            except Exception:
                pass
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Remote UI static files not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8765, reload=False)
