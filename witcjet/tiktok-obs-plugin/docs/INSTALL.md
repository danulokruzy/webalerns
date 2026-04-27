# 📖 УСТАНОВКА TikTok OBS PLUGIN

Полная пошаговая инструкция интеграции плагина в OBS Studio как личного софта.

## ⏱️ Время установки: 10-15 минут

---

## ЭТАП 1️⃣ : ПОДГОТОВКА СИСТЕМЫ

### Шаг 1.1: Скачать Python (если нет)
- Скачать: https://www.python.org/downloads/ (версия 3.10+)
- Установить с опцией **"Add Python to PATH"**
- Проверка:
```bash
python --version
```

### Шаг 1.2: Скопировать плагин в нужное место

**Option A: Для локального использования (рекомендуется)**
```
C:\Users\твоё_имя\AppData\Local\obs-studio\plugins\
```

**Option B: В папку документов (проще)**
```
C:\BotKruz\witcjet\tiktok-obs-plugin\
```

Структура должна быть:
```
tiktok-obs-plugin/
├── backend/
├── frontend/
├── obs-scripts/
├── config/
└── docs/
```

---

## ЭТАП 2️⃣ : УСТАНОВКА ЗАВИСИМОСТЕЙ

### Шаг 2.1: Открыть PowerShell в папке плагина

```bash
cd c:\BotKruz\witcjet\tiktok-obs-plugin\backend
```

### Шаг 2.2: Установить Python зависимости

```bash
pip install -r requirements.txt
```

✓ Если всё успешно, увидишь:
```
Successfully installed flask flask-socketio ...
```

---

## ЭТАП 3️⃣ : ЗАПУСК BACKEND СЕРВЕРА

### Шаг 3.1: Создать файл запуска (start.bat)

В папке `tiktok-obs-plugin` создать файл `start.bat`:

```batch
@echo off
cd backend
python server.py
pause
```

### Шаг 3.2: Запустить сервер

Двойной клик по `start.bat` или:

```bash
cd c:\BotKruz\witcjet\tiktok-obs-plugin\backend
python server.py
```

✓ Если всё работает, увидишь:
```
╔════════════════════════════════════════════════╗
║   TikTok OBS Plugin - Backend Server          ║
║         http://localhost:5000                  ║
║                                                ║
║   Управление: http://localhost:5000           ║
║   API:        http://localhost:5000/api/      ║
╚════════════════════════════════════════════════╝
```

**Оставить терминал открытым!**

---

## ЭТАП 4️⃣ : ЗАГРУЗИТЬ LUA СКРИПТ В OBS

### Шаг 4.1: Открыть OBS Studio

### Шаг 4.2: Перейти в Tools → Scripts

**Windows:**
- **OBS Menu** → **Tools** → **Scripts** (значок {})
- Откроется окно Scripts

### Шаг 4.3: Добавить скрипт плагина

1. Левая панель → Нажать **"+"** (Add Script)
2. Выбрать файл: `c:/BotKruz/witcjet/tiktok-obs-plugin/obs-scripts/main_control.lua`
3. Нажать **Select** / **Открыть**

### Шаг 4.4: Настроить параметры скрипта

В окне Properties скрипта установить:
- **Server URL**: `http://127.0.0.1:5000`
- **Auto Connect**: ☑ (включить)
- **Debug Mode**: ☑ (для первого запуска)

### Шаг 4.5: Проверить логи

В нижней части окна Scripts увидишь:
```
[TikTok Plugin] Плагин загружен. Версия: 1.0
[TikTok Plugin] Сервер доступен: http://127.0.0.1:5000
```

---

## ЭТАП 5️⃣ : СОЗДАТЬ СЦЕНЫ С ВИДЖЕТАМИ

### Вариант A: Автоматическое создание (рекомендуется)

1. **OBS** → **Tools** → **Scripts**
2. Найти скрипт `main_control.lua`
3. Нажать кнопку **"Создать сцены"**

Скрипт автоматически создаст:
- ✓ Main Stream (Главный стрим)
- ✓ Intermission (Перерыв)
- ✓ Donate Alert (Оповещение о доне)
- ✓ Dashboard (Полная панель)

### Вариант B: Ручное создание

#### Сцена 1: Main Stream

1. **OBS** → Правый клик → **New Scene**
2. Название: `Main Stream`
3. **Add Source** → **Browser**
   - **Name**: `Progress Widget`
   - **URL**: `http://localhost:5000/progress`
   - **Width**: 1920
   - **Height**: 1080
4. Нажать **OK**

#### Сцена 2: Intermission

1. **New Scene** → Название: `Intermission`
2. Add Browser Source:
   - **Name**: `Gauge Widget`
   - **URL**: `http://localhost:5000/gauge`
   - **Width**: 600, **Height**: 600
3. Add Browser Source:
   - **Name**: `Chat Widget`
   - **URL**: `http://localhost:5000/chat`
   - **Width**: 400, **Height**: 600

#### Сцена 3: Dashboard (полная)

Можно выбрать несколько источников и расставить их по экрану.

---

## ЭТАП 6️⃣ : ТЕСТИРОВАНИЕ

### Шаг 6.1: Подключить TikTok Live

1. Начать Live трансляцию на TikTok
2. В скрипте установить свой username: `danulo.kruz` → твой `@username`
3. Перезагрузить скрипт

### Шаг 6.2: Проверить виджеты

В OBS Live mode кликнуть на сцену с виджетов:
- Должны видеть прогресс, чат, донаты в реал-тайме

### Шаг 6.3: Проверить API

Открыть в браузере:
```
http://localhost:5000
```

Должен открыться control panel с листом виджетов.

---

## ✅ УСПЕШНАЯ ИНТЕГРАЦИЯ - ЗНАКИ

**Зелёные флажки означают успех:**
- ✓ Сервер запущен (терминал не выкидывает ошибки)
- ✓ Скрипт загружен в OBS (нет красных текстов в Scripts)
- ✓ Сцены созданы (видны в OBS)
- ✓ Browser Source показывает виджет (не чёрный экран)
- ✓ Данные обновляются в реал-тайме

---

## 🐛 Решение проблем

### ❌ Проблема: "Module not found" (Flask, SocketIO)
**Решение:**
```bash
pip install flask flask-socketio --upgrade
```

### ❌ Проблема: "Port 5000 already in use"
**Решение:** 
Другая программа использует порт. Проверить:
```bash
netstat -ano | findstr :5000
```
Или поменять порт в `backend/server.py` с 5000 на 5001.

### ❌ Проблема: Browser Source показывает чёрный экран
**Решение:**
1. Нажать F5 в OBS (перезагрузить браузер)
2. Проверить URL: `http://localhost:5000/progress`
3. Убедиться что сервер запущен
4. Посмотреть консоль браузера (F12 в OBS)

### ❌ Проблема: Lua скрипт не работает
**Решение:**
- OBS должен быть версии **27.0+** (Tools → About)
- Перезагрузить OBS полностью
- Проверить путь скрипта: `c:/BotKruz/witcjet/tiktok-obs-plugin/obs-scripts/main_control.lua`

### ❌ Проблема: TikTok не подключается
**Решение:**
1. Проверить username в `main_control.lua`
2. Должна быть активная Live трансляция на TikTok
3. Проверить интернет

---

## 📡 ИСПОЛЬЗОВАНИЕ API

Твой плагин имеет REST API для управления:

### Получить состояние виджета
```bash
curl http://localhost:5000/api/widget/state
```

### Обновить счёт подарков
```bash
curl -X POST http://localhost:5000/api/widget/update \
  -H "Content-Type: application/json" \
  -d '{"rose_count": 100, "tiktok_count": 50}'
```

### Список все виджетах
```bash
curl http://localhost:5000/api/widgets
```

---

## 🎨 КАСТОМИЗАЦИЯ ВИДЖЕТОВ

### Изменить стили виджета

Открыть: `frontend/widgets/progress.html`

Найти CSS:
```css
.liquid-glass {
    backdrop-filter: blur(18px) saturate(200%) brightness(1.1);
}
```

Поменять значения:
- `blur(18px)` → `blur(25px)` (сильнее размытие)
- `saturate(200%)` → `saturate(300%)` (насыщенность)

### Создать новый виджет

1. Скопировать `widgets_template.html`
2. Переименовать в `my_widget.html`
3. Отредактировать HTML/CSS
4. В `config/widgets.json` добавить запись:
```json
{
  "id": "my_widget",
  "name": "My Widget",
  "file": "my_widget.html",
  "route": "/my-widget"
}
```
5. В `backend/server.py` добавить маршрут:
```python
@app.route('/my-widget')
def my_widget():
    return send_from_directory(str(WIDGETS_DIR), 'my_widget.html')
```

---

## 📦 РАСПРОСТРАНЕНИЕ ПЛАГИНА

Чтобы поделиться плагином с другими:

1. **Упаковать папку:**
```bash
tar -czf tiktok-obs-plugin.tar.gz tiktok-obs-plugin/
```

2. **Или ZIP:**
Правый клик на папку → Send To → Compressed Folder

3. **Распространять на:**
- GitHub (рекомендуется)
- Discord
- Любой облачный сервис

Другие пользователи просто распакуют и следуют этой инструкции.

---

## 🚀 ГОТОВО!

Твой плагин теперь полностью интегрирован в OBS Studio и готов к использованию на стримах!

**FAQ:**
- Может ли работать на Mac/Linux? Да, но нужны небольшие изменения путей
- Сколько виджетов можно добавить? Неограниченно
- Работает ли с YouTube Live? Нужно добавить поддержку YouTube API

---

**Вопросы?** Посмотри USAGE.md для углублённой документации.
