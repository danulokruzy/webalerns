# КРАТКАЯ СПРАВКА - 5 команд для запуска

## ⚡ Быстрый старт

### 1. Установка (первый раз)
```bash
cd c:\BotKruz\witcjet\tiktok-obs-plugin
install.bat
```

### 2. Запуск сервера
```bash
start.bat
```
(Оставить открытым!)

### 3. В OBS: Загрузить скрипт
- **Tools** → **Scripts** → **+** 
- Выбрать: `obs-scripts/main_control.lua`

### 4. В OBS: Создать сцены
- **Tools** → **Scripts** 
- Нажать кнопку: **"Создать сцены"**

### 5. Done! 🎉
- Выбрать сцену в OBS
- Запустить Live на TikTok
- Виджеты работают!

---

## 🔗 Полезные ссылки

| Что | Ссылка |
|-----|--------|
| **Управление** | http://localhost:5000 |
| **API** | http://localhost:5000/api/widgets |
| **Progress** | http://localhost:5000/progress |
| **Gauge** | http://localhost:5000/gauge |
| **Chat** | http://localhost:5000/chat |
| **Donation** | http://localhost:5000/donation |

---

## 🆘 Проблемы?

| Проблема | Решение |
|----------|---------|
| Ошибка Python | `pip install -r backend/requirements.txt` |
| Сервер не запускается | Порт 5000 занят: `netstat -ano \| findstr :5000` |
| OBS показывает чёрный экран | Нажать F5, перезагрузить OBS |
| Скрипт не работает | Проверить OBS версия 27.0+ |

---

**Вопросы?** Смотри `/docs/SETUP.md` для подробной инструкции!
