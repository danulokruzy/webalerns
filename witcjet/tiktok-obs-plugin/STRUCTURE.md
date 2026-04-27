# TikTok OBS Plugin - Структура и Установка

## 📁 Структура плагина

```
tiktok-obs-plugin/
├── backend/
│   ├── server.py              # Основной Flask сервер
│   ├── widget_system.py       # Система управления виджетами
│   ├── tiktok_client.py       # TikTok Live клиент
│   └── requirements.txt       # Зависимости Python
├── frontend/
│   ├── widgets/               # HTML виджеты
│   │   ├── progress.html
│   │   ├── vip.html
│   │   ├── gauge.html
│   │   ├── chat.html
│   │   └── donation.html
│   ├── assets/                # Изображения, стили (общие)
│   │   └── global.css
│   └── index.html             # Главная страница управления
├── obs-scripts/
│   ├── main_control.lua       # Основной Lua скрипт (загружается в OBS)
│   ├── scene_manager.lua      # Управление сценами
│   └── widget_controller.lua  # Управление виджетами
├── config/
│   ├── plugin.json            # Общая конфигурация плагина
│   ├── widgets.json           # Конфиг виджетов
│   └── scenes.json            # Предустановленные сцены
├── docs/
│   ├── INSTALL.md             # Инструкция установки
│   ├── USAGE.md               # Как использовать
│   ├── DEVELOPMENT.md         # Для разработчиков
│   └── API.md                 # API документация
├── install.bat                # Установка для Windows
├── start.bat                  # Запуск плагина
└── README.md                  # Описание
```

## 🎯 Этапы установки:

### Этап 1: Скопировать базовые файлы
- [x] Создана структура папок

### Этап 2: Разместить файлы по папкам
- [ ] Backend → Python скрипты
- [ ] Frontend → HTML виджеты
- [ ] Configs → JSON конфиги

### Этап 3: Настроить плагин
- [ ] Создать manifest файл
- [ ] Настроить Lua скрипт для OBS

### Этап 4: Установить в OBS
- [ ] Скопировать папку в OBS Scripts
- [ ] Добавить путь скрипта в OBS
- [ ] Включить плагин

---

# Далее читай: INSTALL.md
