@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Flamboyant — Mesa Interativa · remove o AUTOSTART (Windows)
REM  Apaga o atalho da pasta Startup. Nao altera as configs de energia.
REM ─────────────────────────────────────────────────────────────────
setlocal
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Flamboyant Mesa.lnk"

if exist "%LNK%" (
  del /f /q "%LNK%"
  echo [ok] Autostart removido: %LNK%
) else (
  echo [info] Nenhum autostart encontrado em: %LNK%
)
echo.
pause
endlocal
