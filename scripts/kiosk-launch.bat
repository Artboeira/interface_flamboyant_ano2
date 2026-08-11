@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Flamboyant — Mesa Interativa (Feira ABRASCE) — Chrome kiosk launcher
REM
REM  Sobe um servidor HTTP estatico local (`bin\miniserve.exe`) na porta
REM  8765 (loopback only — sem exposicao na rede) e abre Chrome em
REM  --kiosk apontando para ele. Toda a midia toca direto do disco da
REM  mesa touch (TOUK WT55UH, PC embutido Windows 10).
REM
REM  USAGE
REM    - Manual:  double-click este .bat.
REM    - Autostart on boot:  Win+R -> `shell:startup` -> drop um shortcut
REM      desse arquivo na pasta que abrir.
REM
REM  PRE-REQ
REM    - `bin\miniserve.exe` baixado e versionado (ver bin\README.md).
REM    - Google Chrome instalado em Program Files.
REM ─────────────────────────────────────────────────────────────────

setlocal
set PORT=8765
set URL=http://localhost:%PORT%/?kiosk=1
set ROOT=%~dp0..
set SERVER=%ROOT%\bin\miniserve.exe
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not exist "%SERVER%" (
  echo [kiosk] bin\miniserve.exe NAO encontrado em "%SERVER%".
  echo [kiosk] Ver bin\README.md para baixar.
  pause
  exit /b 1
)
if not exist %CHROME% (
  echo [kiosk] Chrome NAO encontrado em Program Files. Edite CHROME=... no .bat.
  pause
  exit /b 1
)

REM ── Sobe o servidor estatico em background ────────────────────────
REM  --interfaces 127.0.0.1  -> so loopback (mesa offline; sem rede)
REM  --index index.html      -> / resolve direto para o index
echo [kiosk] Subindo miniserve em :%PORT% (loopback only)
start "miniserve" /B "%SERVER%" "%ROOT%" --port %PORT% --interfaces 127.0.0.1 --index index.html

REM ── Espera a porta responder ──────────────────────────────────────
:wait
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo [kiosk] Aguardando miniserve responder em %URL% ...
  timeout /t 1 /nobreak >nul
  goto wait
)

REM ── Limpa o cache do kiosk ────────────────────────────────────────
REM  Garante que midia/codigo atualizados sejam sempre recarregados (sem
REM  servir versao antiga do cache quando se troca arquivos de mesmo nome).
if exist "%TEMP%\flamboyant-sala-kiosk-profile" rd /s /q "%TEMP%\flamboyant-sala-kiosk-profile"

REM ── Sobe Chrome ───────────────────────────────────────────────────
REM  --user-data-dir isolado: sem historico, sem "restore session" depois
REM  de crash ou reboot. --autoplay-policy libera audio sem gesture
REM  (necessario para o video da mesa tocar sozinho).
REM  --disk-cache-size=1 praticamente desliga o cache de disco.
echo [kiosk] Abrindo Chrome em %URL%
%CHROME% ^
  --kiosk ^
  --disk-cache-size=1 ^
  --aggressive-cache-discard ^
  --start-fullscreen ^
  --window-size=1920,1080 ^
  --window-position=0,0 ^
  --noerrdialogs ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --disable-features=TranslateUI ^
  --disable-translate ^
  --disable-infobars ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-session-crashed-bubble ^
  --disable-restore-session-state ^
  --autoplay-policy=no-user-gesture-required ^
  --user-data-dir="%TEMP%\flamboyant-sala-kiosk-profile" ^
  %URL%

REM Quando Chrome fechar, mata o miniserve junto (evita orfaos no Task Manager).
taskkill /F /IM miniserve.exe >nul 2>&1

endlocal
