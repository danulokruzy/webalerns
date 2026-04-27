@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "MODE=%~1"

if not exist "%PS_EXE%" (
  echo [ERROR] PowerShell not found at "%PS_EXE%".
  pause
  exit /b 1
)

if not exist "%SCRIPT_DIR%launcher.ps1" (
  echo [ERROR] launcher.ps1 not found in "%SCRIPT_DIR%".
  pause
  exit /b 1
)

if /i "%MODE%"=="setup" (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1" -Mode setup
) else if /i "%MODE%"=="build" (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1" -Mode build
) else if /i "%MODE%"=="start" (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1" -Mode start
) else if /i "%MODE%"=="site" (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1" -Mode site
) else if /i "%MODE%"=="dashboard" (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1" -Mode dashboard
) else if /i "%MODE%"=="tiktok-runtime" (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1" -Mode tiktok-runtime
) else if /i "%MODE%"=="dev-stack" (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1" -Mode dev-stack
) else (
  "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launcher.ps1"
)

if errorlevel 1 (
  echo.
  echo [ERROR] Launcher exited with code %errorlevel%.
  pause
  exit /b %errorlevel%
)

endlocal
