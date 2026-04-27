"""
OBS Widget System - расширение для управления кастомными виджетами
Позволяет создавать, регистрировать и управлять виджетами в OBS
"""

from flask import jsonify, request
import json
import os

class WidgetSystem:
    def __init__(self):
        self.widgets = {}
        self.widget_config_path = "widgets_config.json"
        self.load_widgets()
    
    def load_widgets(self):
        """Загрузить конфиг виджетов"""
        if os.path.exists(self.widget_config_path):
            with open(self.widget_config_path, 'r', encoding='utf-8') as f:
                self.widgets = json.load(f)
        else:
            self.init_default_widgets()
    
    def init_default_widgets(self):
        """Инициализировать виджеты по умолчанию"""
        self.widgets = {
            "progress": {
                "name": "Progress Bar",
                "route": "/prog",
                "description": "Прогресс-бар с таймером TikTok",
                "enabled": True,
                "config": {
                    "width": 1920,
                    "height": 1080,
                    "update_interval": 100
                }
            },
            "vip": {
                "name": "VIP Widget",
                "route": "/vip",
                "description": "VIP уведомления",
                "enabled": True,
                "config": {
                    "width": 1920,
                    "height": 1080,
                    "update_interval": 500
                }
            }
        }
        self.save_widgets()
    
    def save_widgets(self):
        """Сохранить конфиг виджетов"""
        with open(self.widget_config_path, 'w', encoding='utf-8') as f:
            json.dump(self.widgets, f, indent=2, ensure_ascii=False)
    
    def register_widget(self, widget_id, name, route, description, config=None):
        """Зарегистрировать новый виджет"""
        self.widgets[widget_id] = {
            "name": name,
            "route": route,
            "description": description,
            "enabled": True,
            "config": config or {}
        }
        self.save_widgets()
        return self.widgets[widget_id]
    
    def get_widget(self, widget_id):
        """Получить виджет по ID"""
        return self.widgets.get(widget_id)
    
    def list_widgets(self):
        """Список всех виджетов"""
        return list(self.widgets.values())
    
    def update_widget(self, widget_id, updates):
        """Обновить конфиг виджета"""
        if widget_id in self.widgets:
            self.widgets[widget_id].update(updates)
            self.save_widgets()
            return self.widgets[widget_id]
        return None

# Глобальный экземпляр
widget_system = WidgetSystem()

def setup_widget_routes(app):
    """Добавить API маршруты для виджетов"""
    
    @app.route("/api/widgets")
    def get_widgets():
        """Получить список всех виджетов"""
        return jsonify({
            "widgets": widget_system.list_widgets(),
            "count": len(widget_system.widgets)
        })
    
    @app.route("/api/widgets/<widget_id>")
    def get_widget_info(widget_id):
        """Получить информацию о виджете"""
        widget = widget_system.get_widget(widget_id)
        if widget:
            return jsonify(widget)
        return jsonify({"error": "Widget not found"}), 404
    
    @app.route("/api/widgets/<widget_id>/config", methods=['GET', 'POST'])
    def widget_config(widget_id):
        """Получить/обновить конфиг виджета"""
        widget = widget_system.get_widget(widget_id)
        if not widget:
            return jsonify({"error": "Widget not found"}), 404
        
        if request.method == 'POST':
            data = request.get_json()
            updated = widget_system.update_widget(widget_id, data)
            return jsonify(updated)
        
        return jsonify(widget.get("config", {}))
    
    @app.route("/api/widgets/register", methods=['POST'])
    def register_new_widget():
        """Зарегистрировать новый виджет"""
        data = request.get_json()
        widget_id = data.get('id', 'custom_widget')
        name = data.get('name', 'Custom Widget')
        route = data.get('route', f'/{widget_id}')
        description = data.get('description', '')
        config = data.get('config', {})
        
        result = widget_system.register_widget(widget_id, name, route, description, config)
        return jsonify(result)
