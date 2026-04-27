@echo off
REM ═════════════════════════════════════════════════════════════
REM TikTok OBS Plugin - Установка для Windows
REM ═════════════════════════════════════════════════════════════

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   TikTok OBS Plugin - Мастер установки                   ║
echo ║   Версия 1.0                                              ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Проверить Python
echo [1/4] Проверка Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python не найден. Установите его с https://python.org
    echo    Убедитесь что выбрали "Add Python to PATH"
    pause
    exit /b 1
)
echo ✓ Python найден

REM Перейти в папку backend
echo.
echo [2/4] Переход в папку backend...
cd backend
if %errorlevel% neq 0 (
    echo ❌ Ошибка: запустите этот файл из папки плагина!
    pause
    exit /b 1
)
echo ✓ Папка backend найдена

REM Установить зависимости
echo.
echo [3/4] Установка зависимостей Python...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo ❌ Ошибка при установке зависимостей
    pause
    exit /b 1
)
echo ✓ Зависимости установлены

REM Успех
echo.
echo [4/4] Готово!
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║            ✓ УСТАНОВКА ЗАВЕРШЕНА!                        ║
echo ║                                                            ║
echo ║  Следующие шаги:                                          ║
echo ║  1. Запустить сервер: python server.py                   ║
echo ║  2. Открыть OBS Studio                                   ║
echo ║  3. Tools → Scripts → Добавить main_control.lua          ║
echo ║  4. Нажать "Создать сцены" в свойствах скрипта          ║
echo ║                                                            ║
echo ║  Панель управления: http://localhost:5000                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
pause
