"""
TikTok OBS Plugin - Backend Server
Самостоятельный Python сервер для управления виджетами
"""

from flask import Flask, jsonify, send_from_directory, request
from flask_socketio import SocketIO, emit, on
import os
import json
import time
import threading
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# КОНФИГУРАЦИЯ
# ═══════════════════════════════════════════════════════════════

CONFIG_DIR = Path(__file__).parent.parent / "config"
WIDGETS_DIR = Path(__file__).parent.parent / "frontend" / "widgets"
ASSETS_DIR = Path(__file__).parent.parent / "frontend" / "assets"

class PluginConfig:
    def __init__(self):
        self.plugin_config_file = CONFIG_DIR / "plugin.json"
        self.widgets_config_file = CONFIG_DIR / "widgets.json"
        self.load_configs()

    def load_configs(self):
        try:
            with open(self.plugin_config_file, 'r', encoding='utf-8') as f:
                self.plugin = json.load(f)
        except:
            self.plugin = {"version": "1.0", "name": "TikTok OBS Plugin"}
        
        try:
            with open(self.widgets_config_file, 'r', encoding='utf-8') as f:
                self.widgets = json.load(f)
        except:
            self.widgets = {}

# ═══════════════════════════════════════════════════════════════
# FLASK ПРИЛОЖЕНИЕ
# ═══════════════════════════════════════════════════════════════

app = Flask(__name__, 
    static_folder=str(WIDGETS_DIR),
    static_url_path="/widgets"
)

socketio = SocketIO(app, cors_allowed_origins="*")
config = PluginConfig()

# Глобальное состояние виджета
widget_state = {
    "rose_count": 0,
    "tiktok_count": 0,
    "timer_remaining": 120,
    "is_paused": False,
    "is_connected": False,
    "last_update": time.time()
}

# ═══════════════════════════════════════════════════════════════
# ОСНОВНЫЕ МАРШРУТЫ
# ═══════════════════════════════════════════════════════════════

@app.route('/')
def index():
    """Управление плагином"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>TikTok OBS Plugin Control</title>
        <style>
            body { 
                margin: 0; padding: 20px;
                font-family: Arial; 
                background: #1a1a1a;
                color: #fff;
            }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { color: #00d4ff; }
            .section { 
                background: #2a2a2a; 
                padding: 20px; 
                margin: 20px 0; 
                border-radius: 8px;
                border-left: 4px solid #00d4ff;
            }
            .widget-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
            .widget-card { 
                background: #333; 
                padding: 15px; 
                border-radius: 6px;
                border: 1px solid #444;
                cursor: pointer;
                transition: all 0.3s;
            }
            .widget-card:hover { 
                border-color: #00d4ff; 
                transform: translateY(-2px);
            }
            .widget-card h3 { margin: 0 0 10px 0; color: #00d4ff; }
            a { color: #00d4ff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .status { 
                display: inline-block;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
            }
            .status.online { background: #4caf50; }
            .status.offline { background: #f44336; }
            code { 
                background: #1a1a1a; 
                padding: 2px 6px; 
                border-radius: 3px;
                font-family: monospace;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 TikTok OBS Plugin Control Panel</h1>
            
            <div class="section">
                <h2>📊 Статус плагина</h2>
                <p>Сервер: <span class="status online">ONLINE</span></p>
                <p>Версия: 1.0</p>
                <p>API: <code>http://localhost:5000/api/</code></p>
            </div>

            <div class="section">
                <h2>🎨 Доступные виджеты</h2>
                <div class="widget-list" id="widgets"></div>
            </div>

            <div class="section">
                <h2>⚙️ Управление</h2>
                <ul>
                    <li><a href="/api/widgets">📋 Список всех виджетов (JSON)</a></li>
                    <li><a href="/api/widget/state">📊 Текущее состояние</a></li>
                    <li><a href="/config/plugin.json">⚙️ Конфиг плагина</a></li>
                </ul>
            </div>

            <div class="section">
                <h2>🔗 Маршруты для OBS Browser Source</h2>
                <ul id="routes"></ul>
            </div>
        </div>

        <script>
            fetch('/api/widgets')
                .then(r => r.json())
                .then(d => {
                    document.getElementById('widgets').innerHTML = d.widgets.map(w => 
                        `<div class="widget-card">
                            <h3>${w.name}</h3>
                            <p>${w.description}</p>
                            <a href="${w.route}" target="_blank">Открыть →</a>
                         </div>`
                    ).join('');
                });

            fetch('/api/widgets')
                .then(r => r.json())
                .then(d => {
                    document.getElementById('routes').innerHTML = d.widgets.map(w => 
                        `<li><code>http://localhost:5000${w.route}</code> - ${w.name}</li>`
                    ).join('');
                });
        </script>
    </body>
    </html>
    """

@app.route('/api/widgets')
def get_widgets():
    """Список всех доступных виджетов"""
    return jsonify({
        "status": "ok",
        "widgets": [
            {
                "id": "progress",
                "name": "Progress Bar",
                "route": "/progress",
                "description": "Прогресс-бар с таймером",
                "enabled": True
            },
            {
                "id": "gauge",
                "name": "Circular Gauge",
                "route": "/gauge",
                "description": "Круглый gauge",
                "enabled": True
            },
            {
                "id": "chat",
                "name": "Live Chat",
                "route": "/chat",
                "description": "Чат с доками",
                "enabled": True
            },
            {
                "id": "donation",
                "name": "Donation Tracker",
                "route": "/donation",
                "description": "Трекер донатов",
                "enabled": True
            },
            {
                "id": "vip",
                "name": "VIP Alerts",
                "route": "/vip",
                "description": "VIP уведомления",
                "enabled": True
            }
        ],
        "count": 5
    })

@app.route('/progress')
def progress_widget():
    return send_from_directory(str(WIDGETS_DIR), 'progress.html', download_name='progress.html')

@app.route('/gauge')
def gauge_widget():
    return send_from_directory(str(WIDGETS_DIR), 'gauge.html', download_name='gauge.html')

@app.route('/chat')
def chat_widget():
    return send_from_directory(str(WIDGETS_DIR), 'chat.html', download_name='chat.html')

@app.route('/donation')
def donation_widget():
    return send_from_directory(str(WIDGETS_DIR), 'donation.html', download_name='donation.html')

@app.route('/vip')
def vip_widget():
    return send_from_directory(str(WIDGETS_DIR), 'vip.html', download_name='vip.html')

# ═══════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.route('/api/widget/state')
def widget_state_api():
    """Текущее состояние виджета"""
    return jsonify(widget_state)

@app.route('/api/widget/update', methods=['POST'])
def update_widget():
    """Обновить состояние виджета"""
    global widget_state
    data = request.get_json()
    
    if 'rose_count' in data:
        widget_state['rose_count'] = int(data['rose_count'])
    if 'tiktok_count' in data:
        widget_state['tiktok_count'] = int(data['tiktok_count'])
    if 'timer_remaining' in data:
        widget_state['timer_remaining'] = int(data['timer_remaining'])
    
    widget_state['last_update'] = time.time()
    
    # Отправить в OBS через WebSocket
    socketio.emit('widget_update', widget_state, broadcast=True)
    
    return jsonify({"status": "ok", "state": widget_state})

@app.route('/api/health')
def health():
    """Health check"""
    return jsonify({
        "status": "healthy",
        "uptime": time.time(),
        "version": "1.0"
    })

@app.route('/config/plugin.json')
def get_plugin_config():
    """Получить конфиг плагина"""
    return jsonify(config.plugin)

# ═══════════════════════════════════════════════════════════════
# WEBSOCKET СОБЫТИЯ
# ═══════════════════════════════════════════════════════════════

@socketio.on('connect')
def handle_connect():
    print('[WebSocket] Client connected')
    emit('status', {'data': 'Connected to plugin server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('[WebSocket] Client disconnected')

@socketio.on('widget_event')
def handle_widget_event(data):
    """Получить событие от виджета"""
    print(f'[Widget Event] {data}')
    emit('widget_event', data, broadcast=True)

# ═══════════════════════════════════════════════════════════════
# ЗАПУСК
# ═══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("""
    ╔════════════════════════════════════════════════╗
    ║   TikTok OBS Plugin - Backend Server          ║
    ║         http://localhost:5000                  ║
    ║                                                ║
    ║   Управление: http://localhost:5000           ║
    ║   API:        http://localhost:5000/api/      ║
    ╚════════════════════════════════════════════════╝
    """)
    
    socketio.run(app, host='127.0.0.1', port=5000, debug=True)
