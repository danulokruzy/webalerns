# 🎬 TikTok OBS Plugin - Полный плагин для OBS Studio

![Status](https://img.shields.io/badge/Status-Active-success)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-Free-green)

Полнофункциональный плагин интеграции TikTok Live с OBS Studio.  
Создавай красивые виджеты с "жидким стеклом" эффектом прямо в OBS!

## ✨ Возможности

✅ **5 готовых виджетов** с Liquid Glass эффектом
- Progress Bar (прогресс с таймером)
- Circular Gauge (красивый круглый gauge)
- Live Chat (чат в реальном времени)
- Donation Tracker (отслеживание донатов)
- VIP Alerts (уведомления о VIP)

✅ **Автоматическое создание сцен** в OBS (одной кнопкой)

✅ **REST API** для управления виджетами

✅ **WebSocket** для real-time обновлений

✅ **Кастомизация** - легко создавать свои виджеты

✅ **TikTok Live интеграция** - подключение к трансляциям

✅ **Для Windows** (Mac/Linux возможны с адаптациями)

---

## 🚀 Быстрый старт (5 минут)

### 1️⃣ Установить зависимости

```bash
cd tiktok-obs-plugin
install.bat
```

### 2️⃣ Запустить сервер

```bash
start.bat
```

Должно вывести:
```
╔════════════════════════════════════════════════════════════════╗
║   TikTok OBS Plugin - Backend Server                          ║
║         http://localhost:5000                                  ║
╚════════════════════════════════════════════════════════════════╝
```

### 3️⃣ Загрузить в OBS

**OBS** → **Tools** → **Scripts** → **+** (Add)

Выбрать: `obs-scripts/main_control.lua`

### 4️⃣ Создать сцены

В свойствах скрипта нажать: **"Создать сцены"** ️

Готово! 🎉 Появятся 4 сцены с готовыми виджетами.

---

## 📖 Документация

| Документ | Описание |
|----------|----------|
| [INSTALL.md](docs/INSTALL.md) | 📋 Полная пошаговая установка |
| [USAGE.md](docs/USAGE.md) | 🎨 Как использовать виджеты |
| [API.md](docs/API.md) | 🔌 REST API документация |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | 🛠️ Создать свой виджет |

---

## 📁 Структура

```
tiktok-obs-plugin/
├── backend/                   # Python Flask сервер
│   ├── server.py              # Основное приложение
│   ├── widget_system.py       # Система виджетов
│   └── requirements.txt        # Зависимости
│
├── frontend/                  # Браузерные компоненты
│   ├── widgets/               # HTML виджеты (5 штук)
│   ├── assets/                # CSS, изображения
│   └── index.html             # Управление
│
├── obs-scripts/               # Lua скрипты для OBS
│   ├── main_control.lua       # Главный скрипт
│   └── scene_manager.lua      # Управление сценами
│
├── config/                    # Конфигурационные файлы
│   ├── plugin.json            # Основной конфиг
│   ├── widgets.json           # Список виджетов
│   └── scenes.json            # Сцены
│
├── docs/                      # Документация
│   ├── INSTALL.md             # Установка
│   ├── USAGE.md               # Пользование
│   ├── API.md                 # API
│   └── DEVELOPMENT.md         # Разработка
│
├── install.bat                # Установка (Windows)
├── start.bat                  # Запуск сервера (Windows)
└── README.md                  # Этот файл
```

---

## 🔧 Требования

- **Windows** 10+ (или Mac/Linux с адаптациями)
- **OBS Studio** 27.0+
- **Python** 3.8+
- **Интернет** для TikTok Live

---

## 🎯 Использование

### На стриме

1. **Выбрать сцену** в OBS (напр. "Main Stream")
2. **Начать Live** на TikTok
3. Виджеты **автоматически** будут показывать:
   - Прогресс и таймер
   - Счёт подарков
   - Live чат
   - Новые донаты

### Управление

- **Панель управления**: http://localhost:5000
- **API**: http://localhost:5000/api/
- **OBS Scripts**: Tools → Scripts → main_control.lua

---

## 🎨 Примеры виджетов

### Progress Bar
Красивая полоса прогресса с жидким стеклом эффектом.
```
URL: http://localhost:5000/progress
Size: 1920×1080
```

### Gauge Widget
Круглый gauge для показания процентов.
```
URL: http://localhost:5000/gauge
Size: 600×600
```

### Live Chat
Чат с автоскроллом.
```
URL: http://localhost:5000/chat
Size: 400×600
```

### Donation Tracker
Отслеживание донатов и лидербордов.
```
URL: http://localhost:5000/donation
Size: 1920×1080
```

---

## ⚡ Примеры команд

### Получить состояние виджета

```bash
curl http://localhost:5000/api/widget/state
```

Ответ:
```json
{
  "rose_count": 234,
  "tiktok_count": 567,
  "timer_remaining": 120,
  "is_paused": false
}
```

### Обновить подарки

```bash
curl -X POST http://localhost:5000/api/widget/update \
  -H "Content-Type: application/json" \
  -d '{"rose_count": 300, "tiktok_count": 700}'
```

### Проверить здоровье сервера

```bash
curl http://localhost:5000/api/health
```

---

## 🛠️ Создать свой виджет

1. Скопировать `frontend/widgets/template.html`
2. Отредактировать HTML/CSS/JS
3. Добавить в `config/widgets.json`
4. Добавить маршрут в `backend/server.py`
5. Перезагрузить сервер

Позмотрите [DEVELOPMENT.md](docs/DEVELOPMENT.md) для подробнее.

---

## 🐛 Решение проблем

| Проблема | Решение |
|----------|---------|
| Python не найден | Установить с https://python.org |
| Порт 5000 занят | Использовать другой порт в `server.py` |
| Browser Source чёрный | Нажать F5, перезагрузить OBS |
| TikTok не подключается | Проверить username, интернет |
| Скрипт не работает | OBS 27+, перезагрузить |

Подробнее в [INSTALL.md](docs/INSTALL.md#-решение-проблем).

---

## 🎓 Примеры

### Пример: Добавить свой виджет

```html
<!-- my_widget.html -->
<!DOCTYPE html>
<html>
<body style="background: transparent;">
    <div style="
        background: rgba(255,255,255,0.13);
        backdrop-filter: blur(18px);
        border-radius: 12px;
        padding: 30px;
        color: white;
        font-size: 32px;
    ">
        Мой виджет: <span id="value">0</span>
    </div>
    
    <script>
        const API = 'http://localhost:5000/api/widget/state';
        setInterval(async () => {
            const r = await fetch(API);
            const d = await r.json();
            document.getElementById('value').textContent = 
                d.rose_count + d.tiktok_count;
        }, 500);
    </script>
</body>
</html>
```

---

## 📊 Статистика

- ⭐ **5 готовых виджетов**
- 👥 **Поддержка всех ОС** (Windows + адаптация)
- 🚀 **Легко расширяется**
- 📝 **Полная документация**

---

## 📞 Поддержка

- 📖 **Читай документацию**: `/docs/`
- 🐛 **Проблемы?**: Смотри раздел Решение проблем
- 💡 **Идеи?**: Fork на GitHub и Pull Request

---

## 📄 Лицензия

Free for personal use on Twitch/YouTube/TikTok.

---

## 🙏 Спасибо

За использование плагина! 

**Тебе нравится?** ⭐ Поставь звезду на GitHub!

---

**Версия:** 1.0.0  
**Последнее обновление:** April 2026  
**Создатель:** DanulO  
