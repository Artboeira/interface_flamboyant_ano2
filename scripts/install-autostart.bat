@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Flamboyant — Mesa Interativa · instalador de AUTOSTART (Windows)
REM
REM  Rode UMA vez, na conta de usuario que vai operar a mesa. Ele:
REM    1. Ajusta a energia (nunca suspender / nunca desligar a tela).
REM    2. Cria um atalho na pasta Startup apontando para o watchdog
REM       (sobe miniserve + Chrome kiosk e relanca se cair), oculto.
REM
REM  Depois disso, a cada boot a mesa entra sozinha na interface.
REM  (Falta so o login automatico do Windows — manual, ver no fim.)
REM ─────────────────────────────────────────────────────────────────
setlocal

REM caminho absoluto da raiz do projeto (pasta acima de \scripts)
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "WATCHDOG=%ROOT%\scripts\watchdog.ps1"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\Flamboyant Mesa.lnk"

echo.
echo [setup] Projeto: %ROOT%

if not exist "%WATCHDOG%" (
  echo [erro] watchdog.ps1 nao encontrado em "%WATCHDOG%".
  pause & exit /b 1
)

REM ── 1. Energia: nunca suspender / desligar tela / hibernar (na tomada) ──
echo [setup] Ajustando energia (sem suspender / sem desligar a tela)...
powercfg /change monitor-timeout-ac 0   >nul 2>&1
powercfg /change standby-timeout-ac 0   >nul 2>&1
powercfg /change disk-timeout-ac 0      >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1

REM ── 2. Atalho no Startup (watchdog em janela oculta) ──────────────────
echo [setup] Criando atalho de autostart em:
echo         %LNK%
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%'); $s.TargetPath='powershell.exe'; $s.Arguments='-WindowStyle Hidden -ExecutionPolicy Bypass -File \"%WATCHDOG%\"'; $s.WorkingDirectory='%ROOT%'; $s.WindowStyle=7; $s.Save()"

if exist "%LNK%" (
  echo.
  echo [ok] Autostart instalado com sucesso.
) else (
  echo.
  echo [erro] Nao foi possivel criar o atalho. Rode como o usuario da mesa.
  pause & exit /b 1
)

echo.
echo ─────────────────────────────────────────────────────────────
echo  FALTA 1 PASSO MANUAL (uma vez, por seguranca nao automatizamos):
echo   Login automatico do Windows:
echo     Win+R  ->  netplwiz  ->  desmarcar "Os usuarios precisam digitar..."
echo     ->  Aplicar  ->  digitar a senha da conta.
echo
echo  Para testar agora sem reiniciar: rode scripts\kiosk-launch.bat
echo  Para reverter o autostart:        rode scripts\uninstall-autostart.bat
echo ─────────────────────────────────────────────────────────────
echo.
pause
endlocal
