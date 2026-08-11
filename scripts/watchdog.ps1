# ─────────────────────────────────────────────────────────────────
#  Flamboyant — Mesa Interativa — Chrome kiosk watchdog (Windows)
#
#  Substitui kiosk-launch.bat para uso unattended. Mantem o miniserve
#  + Chrome rodando: se qualquer um cair (crash, kill, popup do OS
#  fechando a janela), o loop relanca o par com back-off de 2 s.
#
#  Autostart sem janela de console piscando:
#    powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File watchdog.ps1
#
#  Ctrl+C no console host para a loop (nao mata os processos ja rodando).
# ─────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Continue'

$port    = 8765
$url     = "http://localhost:$port/?kiosk=1"
$profile = Join-Path $env:TEMP 'flamboyant-sala-kiosk-profile'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root      = Resolve-Path (Join-Path $scriptDir '..')
$server    = Join-Path $root 'bin\miniserve.exe'

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) { $chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }

if (-not (Test-Path $server)) {
  Write-Error "[watchdog] miniserve nao encontrado em $server. Ver bin\README.md."
  exit 1
}
if (-not (Test-Path $chrome)) {
  Write-Error '[watchdog] Chrome nao encontrado em Program Files. Edite watchdog.ps1 e ajuste $chrome.'
  exit 1
}

$serverArgs = @("$root", '--port', $port, '--interfaces', '127.0.0.1', '--index', 'index.html')

$chromeArgs = @(
  '--kiosk',
  '--disk-cache-size=1',
  '--aggressive-cache-discard',
  '--start-fullscreen',
  '--window-size=1920,1080',
  '--window-position=0,0',
  '--noerrdialogs',
  '--disable-pinch',
  '--overscroll-history-navigation=0',
  '--disable-features=TranslateUI',
  '--disable-translate',
  '--disable-infobars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-session-crashed-bubble',
  '--disable-restore-session-state',
  '--autoplay-policy=no-user-gesture-required',
  ('--user-data-dir="{0}"' -f $profile),
  $url
)

function Start-MiniServe {
  Write-Host "[watchdog] Subindo miniserve em :$port $(Get-Date -Format o)"
  return Start-Process -FilePath $server -ArgumentList $serverArgs -WindowStyle Hidden -PassThru
}

function Wait-ForPort {
  param($p)
  while (-not (Test-NetConnection -ComputerName 'localhost' -Port $p -InformationLevel Quiet -WarningAction SilentlyContinue)) {
    Start-Sleep -Milliseconds 500
  }
}

function Start-Kiosk {
  Write-Host "[watchdog] Abrindo Chrome $(Get-Date -Format o)"
  return Start-Process -FilePath $chrome -ArgumentList $chromeArgs -PassThru
}

while ($true) {
  # Limpa o cache do kiosk antes de cada início → sempre pega mídia/código atuais
  if (Test-Path $profile) { Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue }

  $srv = Start-MiniServe
  Wait-ForPort $port

  $proc = Start-Kiosk
  $proc.WaitForExit()
  Write-Host "[watchdog] Chrome saiu (exit $($proc.ExitCode)) — relancando em 2s"

  # Mata o miniserve antes de relancar — evita porta em uso na proxima volta.
  if ($srv -and -not $srv.HasExited) {
    try { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  Start-Sleep -Seconds 2
}
