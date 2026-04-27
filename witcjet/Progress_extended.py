"""
Расширенный Progress.py с поддержкой кастомных виджетов
Интегрирует WidgetSystem для управления виджетами
"""

from TikTokLive import TikTokLiveClient
from TikTokLive.events import GiftEvent
from flask import Flask, jsonify, send_from_directory, abort, request, Response
from obs_widget_system import widget_system, setup_widget_routes
import re
import urllib.parse
import subprocess
import logging
import sys
import importlib
import shutil
import threading as _threading
import socket
import os
import threading
import time

USERNAME = "danulo.kruz"
# User-preferred default external IP to display
DEFAULT_IP = '159.224.180.180'

gift_data = {"rose": 0, "tiktok": 0}
timer_config = {
    "duration": 120, # 2 minutes
    "pause": 10,     # 10 seconds post-round
    "start_time": time.time(),
    "is_paused": False
}

app = Flask(__name__)

# Настроить виджет-систему
setup_widget_routes(app)

# runtime-configured target (can be set via /set-url)
target_config = {
    'url': None,
    'username': None,
    'type': None  # 'profile' | 'live' | 'short'
}

# Flag to prevent widget/gift processing until tunnel & delay complete
processing_enabled = False

@app.route("/")
def index():
    # Serve the extracted HTML file so widgets can be managed separately
    base = os.path.abspath(os.path.dirname(__file__))
    return send_from_directory(base, 'prog.html')


@app.route('/prog')
def prog():
    base = os.path.abspath(os.path.dirname(__file__))
    return send_from_directory(base, 'prog.html')


@app.route('/vip')
def vip():
    base = os.path.abspath(os.path.dirname(__file__))
    return send_from_directory(base, 'vip.html')


@app.route('/widget/<widget_name>')
def serve_custom_widget(widget_name):
    """Подать кастомный виджет по имени"""
    base = os.path.abspath(os.path.dirname(__file__))
    widget_file = f'{widget_name}.html'
    
    try:
        return send_from_directory(base, widget_file)
    except:
        return jsonify({"error": "Widget not found"}), 404


@app.route("/api/widget")
def widget():
    global gift_data
    # If processing isn't enabled yet, return neutral/default values so frontend
    # appears idle while the tunnel/warmup completes.
    if not processing_enabled:
        return jsonify({
            "left_percent": 50,
            "right_percent": 50,
            "rose_count": 0,
            "tiktok_count": 0,
            "timer_text": "STARTING...",
            "is_paused": True
        })
    now = time.time()
    elapsed = now - timer_config["start_time"]
    
    # Logic for round reset
    if not timer_config["is_paused"]:
        if elapsed >= timer_config["duration"]:
            timer_config["is_paused"] = True
            timer_config["start_time"] = now
            remaining = 0
        else:
            remaining = max(0, int(timer_config["duration"] - elapsed))
    else:
        if elapsed >= timer_config["pause"]:
            # RESET EVERYTHING
            gift_data = {"rose": 0, "tiktok": 0}
            timer_config["is_paused"] = False
            timer_config["start_time"] = now
            remaining = timer_config["duration"]
        else:
            remaining = 0

    # Format timer text
    if timer_config["is_paused"]:
        timer_text = "FINISH!"
    else:
        mins, secs = divmod(remaining, 60)
        timer_text = f"{mins:02d}:{secs:02d}"

    # Calculate percentages
    total = gift_data["rose"] + gift_data["tiktok"]
    if total > 0:
        left_percent = (gift_data["rose"] / total) * 100
        right_percent = (gift_data["tiktok"] / total) * 100
    else:
        left_percent = 50
        right_percent = 50

    return jsonify({
        "left_percent": left_percent,
        "right_percent": right_percent,
        "rose_count": gift_data["rose"],
        "tiktok_count": gift_data["tiktok"],
        "timer_text": timer_text,
        "is_paused": timer_config["is_paused"]
    })


@app.route('/api/widget/set-config', methods=['POST'])
def set_widget_config():
    """Обновить конфиг таймера/виджета"""
    data = request.get_json()
    
    if 'duration' in data:
        timer_config['duration'] = int(data['duration'])
    if 'pause' in data:
        timer_config['pause'] = int(data['pause'])
    if 'reset_timer' in data and data['reset_timer']:
        timer_config['start_time'] = time.time()
        timer_config['is_paused'] = False
    
    return jsonify({"status": "ok", "config": timer_config})


@app.route('/api/widget/set-gift', methods=['POST'])
def set_gift():
    """Установить значение подарков вручную"""
    global gift_data
    data = request.get_json()
    
    if 'rose' in data:
        gift_data['rose'] = int(data['rose'])
    if 'tiktok' in data:
        gift_data['tiktok'] = int(data['tiktok'])
    
    return jsonify({"status": "ok", "gift_data": gift_data})


@app.route('/api/widget/give-gift', methods=['POST'])
def give_gift():
    """Добавить подарок"""
    global gift_data
    data = request.get_json()
    gift_type = data.get('type', 'rose')  # 'rose' или 'tiktok'
    count = int(data.get('count', 1))
    
    if gift_type in gift_data:
        gift_data[gift_type] += count
    
    return jsonify({"status": "ok", "gift_data": gift_data})


@app.route('/health')
def health():
    """Health check для OBS"""
    return jsonify({
        "status": "ok",
        "processing_enabled": processing_enabled,
        "widgets_available": list(widget_system.widgets.keys())
    })


def setup_tiktok_listener():
    """Настроить слушатель TikTok Live"""
    global processing_enabled
    
    try:
        client = TikTokLiveClient(unique_id=USERNAME)
        
        @client.on("connect")
        async def on_connect(_: TikTokLiveClient):
            print(f"[TikTok] Connected to {USERNAME}")
            processing_enabled = True
        
        @client.on("disconnect")
        async def on_disconnect(_: TikTokLiveClient):
            print("[TikTok] Disconnected")
            processing_enabled = False
        
        @client.on("gift")
        async def on_gift(event: GiftEvent):
            print(f"[TikTok] Gift: {event.gift.name} x{event.gift.count}")
            gift_type = event.gift.name.lower()
            if gift_type in gift_data:
                gift_data[gift_type] += event.gift.count
        
        # Run on separate thread
        def run_client():
            import asyncio
            asyncio.run(client.connect())
        
        thread = threading.Thread(target=run_client, daemon=True)
        thread.start()
        
    except Exception as e:
        print(f"[TikTok Error] {e}")


# Запустить TikTok слушатель при старте
@app.before_request
def startup():
    if not hasattr(app, 'tiktok_initialized'):
        setup_tiktok_listener()
        app.tiktok_initialized = True


if __name__ == '__main__':
    print("""
    ╔══════════════════════════════════════════════════╗
    ║         OBS TikTok Widget Server                ║
    ║  http://localhost:5000                           ║
    ║                                                  ║
    ║  Маршруты:                                       ║
    ║  - /prog               (Progress widget)        ║
    ║  - /vip                (VIP widget)              ║
    ║  - /api/widgets        (Список виджетов)        ║
    ║  - /health             (Статус сервера)        ║
    ╚══════════════════════════════════════════════════╝
    """)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
