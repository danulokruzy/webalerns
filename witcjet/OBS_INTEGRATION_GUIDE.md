# OBS Widget System — Полная интеграция

## 🎬 Быстрый старт

### 1. Добавить в OBS Browser Source

В OBS Studio создать новый Browser Source с URL:

```
http://localhost:5000/prog
```

Параметры:
- **Width**: 1920
- **Height**: 1080
- **Shutdown source when not visible**: ☑️ (опционально)

### 2. Запустить сервер

```bash
python Progress.py
```

Сервер стартует на `http://localhost:5000`

### 3. Подключить Lua-скрипт в OBS

- Перейти: **Tools → Scripts**
- Добавить путь папки: `c:/BotKruz/witcjet/`
- Загрузить: `obs_control.lua`
- В настройках скрипта установить: `http://localhost:5000`

---

## 📦 Система кастомных виджетов

### Создать новый виджет

#### Вариант 1: HTML-виджет (рекомендуется)

1. Скопировать `widgets_template.html` → `my_widget.html`
2. Настроить стили (liquid glass эффекты уже встроены)
3. В Progress.py добавить маршрут:

```python
@app.route('/my-widget')
def my_widget():
    return send_from_directory(base, 'my_widget.html')
```

#### Вариант 2: Через API (Python)

```python
from obs_widget_system import widget_system, setup_widget_routes

# В Progress.py добавить после создания app:
setup_widget_routes(app)

# Зарегистрировать новый виджет
widget_system.register_widget(
    widget_id='my_custom_widget',
    name='My Custom Widget',
    route='/my-custom-widget',
    description='Описание виджета',
    config={
        'width': 1920,
        'height': 1080,
        'update_interval': 500,
        'custom_prop': 'value'
    }
)
```

### API виджетов

```
GET  /api/widgets              → Список всех виджетов
GET  /api/widgets/<id>         → Информация о виджете
GET  /api/widgets/<id>/config  → Конфиг виджета
POST /api/widgets/<id>/config  → Обновить конфиг
POST /api/widgets/register     → Зарегистрировать виджет
```

---

## 🌊 Liquid Glass Эффекты

В `widgets_template.html` три вариации:

### 1. Стандартное (яркое)
```html
<div class="liquid-glass">Контент</div>
```

### 2. Тёмное
```html
<div class="liquid-glass-dark">Контент</div>
```

### 3. Цветное
```html
<div class="liquid-glass-colored" style="--glass-color: rgba(255, 100, 150, 0.15);">
    Контент
</div>
```

Параметры CSS:
- `blur`: управляет размытостью (8-20px)
- `saturate`: насыщенность цветов (160-200%)
- `brightness`: яркость (0.9-1.2)

Кастомизировать:
```css
.liquid-glass {
    backdrop-filter: blur(20px) saturate(220%) brightness(1.15);
}
```

---

## 🚀 Продвинутые сценарии

### Сцена с несколькими виджетами

В Lua-скрипте создать сцену с 3 виджетами:

```lua
-- Вызвать из скрипта
create_scene_with_widgets({
    { name = "Progress", route = "/prog" },
    { name = "VIP", route = "/vip" },
    { name = "Custom", route = "/my-widget" }
})
```

### Синхронизация данных между виджетами

Использовать WebSocket для real-time обновлений:

```python
from flask_socketio import SocketIO, emit

socketio = SocketIO(app)

@socketio.on('widget_update')
def handle_widget_update(data):
    emit('widget_update', data, broadcast=True)
```

### Триггеры на события TikTok

```python
@gift_event.on("GiftEvent")
async def on_gift(event: GiftEvent):
    gift_data[event.gift.name.lower()] += event.gift.count
    
    # Отправить в OBS
    socketio.emit('new_gift', {
        'type': event.gift.name,
        'count': event.gift.count,
        'timestamp': time.time()
    })
```

---

## 🎨 Примеры готовых виджетов

### Гагдауэр (Gauge Widget)
```html
<div class="liquid-glass glass-circle" style="width: 200px; height: 200px;">
    <svg viewBox="0 0 200 200" width="100%" height="100%">
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
        <path id="progress-arc" d="..." stroke="rgba(100, 200, 255, 0.8)" stroke-width="8" fill="none"/>
    </svg>
</div>
```

### Чат (Live Chat Widget)
```html
<div class="liquid-glass" style="width: 400px; max-height: 600px;">
    <div id="chat-messages" style="overflow-y: auto;"></div>
    <input type="text" placeholder="Сообщение..." />
</div>
```

### Донаты (Donation Widget)
```html
<div class="liquid-glass widget-card">
    <h2>Последний донат</h2>
    <p id="donor-name">-</p>
    <p class="widget-value">$0.00</p>
</div>
```

---

## 🔧 Настройка Progress.py

Обновить `Progress.py` для поддержки виджетов:

```python
from obs_widget_system import setup_widget_routes, widget_system

# ... существующий код ...

# После создания Flask app
setup_widget_routes(app)

# Можно добавлять новые виджеты на лету
@app.route('/register-custom', methods=['POST'])
def register_custom():
    data = request.get_json()
    result = widget_system.register_widget(**data)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

---

## 📊 Архитектура

```
Progress.py (Flask)
    ├── /prog          → prog.html
    ├── /vip           → vip.html
    ├── /api/widget    → JSON данные
    └── /api/widgets/* → Управление виджетами

obs_widget_system.py
    ├── WidgetSystem     → Управление
    ├── /api/widgets     → API
    └── widgets_config.json

obs_control.lua
    └── OBS Script
        ├── toggle_widgets()
        ├── refresh_widgets()
        └── create_widget_scene()

widgets_template.html
    └── Шаблон с liquid glass эффектами
```

---

## 🎯 ToDo для полной интеграции

- [ ] WebSocket для real-time обновлений
- [ ] Сохранение кастомных конфигов виджетов
- [ ] Галерея готовых виджетов
- [ ] Генератор виджетов (GUI)
- [ ] Интеграция с StreamLabs/SLOBS
- [ ] Desktop app для управления (Electron/Python)

---

## 📝 Лицензия

Free to use for streaming
