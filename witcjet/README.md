# Быстрый старт — Интеграция OBS + TikTok Widgets

## 📋 Что было создано:

### Основные файлы:
- **Progress.py** → Flask сервер (основной)
- **Progress_extended.py** → Расширенная версия с виджет-системой
- **obs_widget_system.py** → Система управления кастомными виджетами
- **obs_control.lua** → Lua-скрипт для OBS Studio
- **OBS_INTEGRATION_GUIDE.md** → Полная документация

### Готовые HTML виджеты:
- `prog.html` — Прогресс-бар с таймером (уже был)
- `vip.html` — VIP notifications (уже был)
- `widgets_template.html` — Шаблон для кастомных виджетов
- `gauge_widget.html` — Круглый gauge (радиус)
- `chat_widget.html` — Дон-чат с liquid glass эффектом
- `donation_widget.html` — Учёт донатов

---

## 🚀 Установка и запуск (5 минут)

### Шаг 1: Установить зависимости

```bash
cd c:\BotKruz\witcjet
pip install flask TikTokLive flask-socketio
```

### Шаг 2: Запустить сервер

```bash
python Progress_extended.py
```

Увидишь:
```
╔══════════════════════════════════════════════════╗
║         OBS TikTok Widget Server                ║
║  http://localhost:5000                           ║
║                                                  ║
║  Маршруты:                                       ║
║  - /prog               (Progress widget)        ║
║  - /vip                (VIP widget)              ║
║  - /gauge              (Gauge widget)            ║
║  - /chat               (Chat widget)             ║
║  - /donation           (Donation widget)         ║
║  - /api/widgets        (Список виджетов)        ║
║  - /health             (Статус сервера)        ║
╚══════════════════════════════════════════════════╝
```

### Шаг 3: Добавить в OBS Browser Source

#### Вариант 1: Один виджет
1. **OBS** → Правый клик на сцену → **Add Source** → **Browser**
2. **URL**: `http://localhost:5000/prog`
3. **Width**: 1920
4. **Height**: 1080
5. **Нажать OK**

#### Вариант 2: Несколько виджетов (разные источники)

| Виджет | URL | Размер | Для чего |
|--------|-----|--------|----------|
| Progress | `http://localhost:5000/prog` | 1920×1080 | Прогресс + таймер |
| VIP | `http://localhost:5000/vip` | 1920×1080 | VIP уведомления |
| Gauge | `http://localhost:5000/gauge` | 600×600 | Круговой прогресс |
| Chat | `http://localhost:5000/chat` | 400×600 | Доны + чат |
| Donation | `http://localhost:5000/donation` | 1920×1080 | Лидербоард донатов |

### Шаг 4: Загрузить Lua-скрипт в OBS (опционально)

1. **OBS** → **Tools** → **Scripts**
2. **Left Panel** → **+** (add script)
3. Выбрать: `c:/BotKruz/witcjet/obs_control.lua`
4. В свойствах скрипта установить URL сервера

---

## 🎨 Быстрая кастомизация

### Изменить цвета liquid glass

В любом `.html` найти:

```css
.liquid-glass {
    backdrop-filter: blur(18px) saturate(200%) brightness(1.1);
}
```

И поменять значения:
- `blur(18px)` → `blur(25px)` (больше размытости)
- `saturate(200%)` → `saturate(300%)` (более яркие цвета)
- `brightness(1.1)` → `brightness(1.3)` (светлее)

### Создать свой виджет за 3 шага

1. **Скопировать** `widgets_template.html` → `my_super_widget.html`
2. **Заменить** title и стили
3. **Обновить** JavaScript функцию `updateDisplay()`

```javascript
updateDisplay(data) {
    // data.rose_count - кол-во роз
    // data.tiktok_count - кол-во TikToks
    // data.timer_text - текст таймера
    // data.left_percent - левый процент
    
    document.getElementById('mainValue').textContent = data.rose_count;
}
```

4. **В `Progress_extended.py` добавить маршрут:**

```python
@app.route('/my-super-widget')
def my_super_widget():
    base = os.path.abspath(os.path.dirname(__file__))
    return send_from_directory(base, 'my_super_widget.html')
```

5. **Перезагрузить** сервер и добавить в OBS: `http://localhost:5000/my-super-widget`

---

## 📡 API для управления

### Получить текущие данные

```bash
curl http://localhost:5000/api/widget
```

Ответ:
```json
{
    "left_percent": 45,
    "right_percent": 55,
    "rose_count": 234,
    "tiktok_count": 567,
    "timer_text": "02:15",
    "is_paused": false
}
```

### Установить значения вручную

```bash
curl -X POST http://localhost:5000/api/widget/set-gift \
  -H "Content-Type: application/json" \
  -d '{"rose": 100, "tiktok": 50}'
```

### Добавить подарок

```bash
curl -X POST http://localhost:5000/api/widget/give-gift \
  -H "Content-Type: application/json" \
  -d '{"type": "rose", "count": 5}'
```

### Сбросить таймер

```bash
curl -X POST http://localhost:5000/api/widget/set-config \
  -H "Content-Type: application/json" \
  -d '{"reset_timer": true, "duration": 120}'
```

### Список всех виджетов

```bash
curl http://localhost:5000/api/widgets
```

---

## 🔧 Расширенные фишечки

### Включить WebSocket для real-time обновлений

В `Progress_extended.py`:

```python
from flask_socketio import SocketIO, emit

socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('connect')
def handle_connect():
    emit('status', {'data': 'Connected to server'})

@socketio.on('widget_event')
def handle_widget_event(data):
    emit('widget_event', data, broadcast=True)
```

В HTML:

```javascript
const socket = io();
socket.on('widget_event', (data) => {
    console.log('Real-time update:', data);
    // Обновить виджет
});
```

### Автоматическая смена сцен на события

В Lua-скрипте:

```lua
function on_gift_received(gift_count)
    if gift_count > 100 then
        obs.obs_frontend_set_current_scene(get_scene("celebration"))
    end
end
```

### Экспорт в StreamLabs

Просто использовать Browser Source с URL виджета. StreamLabs поддерживает Custom Widgets.

---

## 🐛 Решение проблем

### Виджет не обновляется
- Проверь что сервер запущен: `curl http://localhost:5000/health`
- Перезагрузи Browser Source в OBS (F5 в окне браузера)
- Посмотри консоль: F12 → Console

### TikTok не подключается
- Проверь username в `Progress_extended.py` (строка 27)
- Убедись что стримишь Live на TikTok
- Проверь интернет-соединение

### Lua-скрипт не работает
- OBS должен быть версии 27+
- Скрипты должны быть в папке, доступной для Windows
- Перезагрузи OBS после добавления скрипта

### Жидкое стекло выглядит странно
- Обновить браузер (F5)
- Проверить что OBS видит обновления (Interaction)
- Попробовать другой браузер (Chrome лучше всего)

---

## 📊 Файловая структура

```
c:\BotKruz\witcjet\
├── Progress.py                    # Основной сервер (исходный)
├── Progress_extended.py           # Расширенный (с виджет-системой)
├── obs_widget_system.py           # API для кастомных виджетов
├── obs_control.lua                # Управление OBS из сценария
├── prog.html                      # Progress виджет
├── vip.html                       # VIP виджет
├── widgets_template.html          # Шаблон для своих виджетов
├── gauge_widget.html              # Gauge сировала
├── chat_widget.html               # Чат с доками
├── donation_widget.html           # Учёт донатов
├── OBS_INTEGRATION_GUIDE.md       # Полная документация
├── README.md                      # Этот файл
└── widgets_config.json            # Конфиг (создаётся автоматически)
```

---

## 💡 Идеи для расширения

- [ ] **На лету генерировать виджеты** через форму в браузере
- [ ] **Сохранять и восстанавливать** настройки сцен
- [ ] **Анимированные переходы** между виджетами
- [ ] **Пулл-ап меню** для выбора виджетов (на клавишу Ctrl)
- [ ] **Mobile app** для управления с телефона
- [ ] **Готовые темы** (Dark, Light, Neon, Cyberpunk и т.д.)
- [ ] **Интеграция с YouTube** (если стредишь там)
- [ ] **Ночной режим** автоматический

---

## 📞 Нужна помощь?

1. Посмотри логи в терминале где запущен сервер
2. Проверь консоль браузера (F12 в OBS Browser)
3. Попробуй перезагрузить сервер и OBS
4. Используй `/health` endpoint для проверки статуса

---

**Создано:** April 2026  
**Версия:** 1.0 с liquid glass эффектами  
**Лицензия:** Free for streaming
