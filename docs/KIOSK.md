# Setup da mesa — Chrome kiosk em Windows

Este documento cobre o que falta para a mesa interativa ser ligada e "ir
ao ar" sozinha. Pré-requisitos:

- **Mesa touch TOUK WT55UH** com PC embutido (Intel i3, 8 GB, SSD,
  **Windows 10**) — Full HD 1920×1080, 16:9, touch infravermelho.
- Google Chrome instalado (`C:\Program Files\Google\Chrome\Application\chrome.exe`).
- Esta pasta `interface_flamboyant_2/` copiada para o disco da mesa
  (caminho sugerido: `C:\flamboyant\interface_flamboyant_2\`).
- `bin\miniserve.exe` já versionado dentro de `bin/` (ver
  [`bin/README.md`](../bin/README.md)).

## 1. Topologia

- **Mesa touch** Full HD 16:9 com PC embutido — é o único display; não há
  notebook externo nem segundo monitor. A interface roda localmente.
- **Áudio:** sai pela placa da própria mesa. O `<video>` HTML5 toca **com
  áudio** (`muted = false` em [`js/screens.js`](../js/screens.js)).
  Validar volume no pré-show.

A própria interface é o player. Toda imagem e vídeo sai do disco da mesa,
servida pelo miniserve local — sem rede, sem dependências externas.

## 2. Servidor estático local

O launcher [`scripts/kiosk-launch.bat`](../scripts/kiosk-launch.bat) sobe
`bin\miniserve.exe` na porta **8765**, escutando **só em loopback**
(`--interfaces 127.0.0.1`), e abre Chrome em `http://localhost:8765/?kiosk=1`.

Razões para essa rota:

- **Single .exe sem dependências:** a mesa não precisa de Python nem Node.
- **Loopback only:** a mesa fica offline na rede do show; nada exposto.
- **Mantém a arquitetura:** o app usa `fetch` para o `config.json` e
  caminhos relativos para os assets e mídia.

Teste manual do servidor (sem Chrome): em qualquer browser, abrir
`http://localhost:8765/` depois de rodar o `.bat`. Deve carregar a splash.

## 3. Chrome em modo kiosk

O `.bat` espera o miniserve responder antes de abrir Chrome. As flags
aplicadas:

```
--kiosk --start-fullscreen --window-size=1920,1080 --window-position=0,0
--noerrdialogs --disable-pinch --overscroll-history-navigation=0
--disable-features=TranslateUI --disable-translate --disable-infobars
--no-first-run --no-default-browser-check
--disable-session-crashed-bubble --disable-restore-session-state
--autoplay-policy=no-user-gesture-required
--user-data-dir=%TEMP%\flamboyant-sala-kiosk-profile
```

`?kiosk=1` na URL ativa `cursor: none` na interface (`body[data-kiosk]`
em `css/styles.css`) — sem ponteiro visível se um mouse for plugado.

Teste manual: dois cliques em `kiosk-launch.bat`. A mesa deve subir em
fullscreen com a splash, sem bordas / cursor / abas.

## 4. Autostart no boot

### Jeito fácil (recomendado) — script
Rode **uma vez**, logado na conta que vai operar a mesa, dois cliques em:

```
scripts\install-autostart.bat
```

Ele (a) ajusta a energia (nunca suspender / desligar a tela) e (b) cria um
atalho na pasta Startup apontando para o `watchdog.ps1` (oculto), que sobe o
miniserve + Chrome kiosk e relança se cair. Para reverter:
`scripts\uninstall-autostart.bat`.

**Falta só o login automático** (manual, por segurança não é automatizado):
Win+R → `netplwiz` → desmarcar "Os usuários precisam digitar um nome…" →
Aplicar → digitar a senha. Reinicie e confirme que a mesa volta sozinha.

### Jeito manual (alternativo)
1. Win+R → `shell:startup` → abre a pasta de inicialização do usuário.
2. Crie um atalho para `scripts/kiosk-launch.bat` (ou para o watchdog) e mova
   para essa pasta de Startup.
3. Login automático (`netplwiz`).
4. Desligue Sleep / Screensaver (`Settings → Power & sleep` → tudo em "Never";
   `Personalization → Lock screen → Screen saver settings` → None).
5. Reinicie e confirme que a mesa volta ao ar sem intervenção.

## 5. Watchdog (opcional, recomendado)

Para relançar Chrome **e** miniserve se qualquer um cair (raro, mas
acontece em mostras longas), use o watchdog Powershell
[`scripts/watchdog.ps1`](../scripts/watchdog.ps1) em vez do `.bat`. Ele
monitora os dois processos e relança o par com back-off de 2 s.

Crie um `.bat` simples na Startup com:

```bat
@echo off
powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\flamboyant\interface_flamboyant_2\scripts\watchdog.ps1"
```

> Se a mesa usa um perfil corporativo com `ExecutionPolicy` restrito, pode ser
> necessário rodar `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` uma
> vez como admin.

## 5.1 Atualizar conteúdo / código no totem

Quando trocar imagens, vídeos ou código (mesmo com nomes iguais):

1. Copie os arquivos novos por cima dos antigos na pasta do totem.
2. **Feche o Chrome e reabra pelo launcher** (`kiosk-launch.bat` ou watchdog).

O launcher **limpa o cache do kiosk automaticamente** a cada início
(apaga `%TEMP%\flamboyant-sala-kiosk-profile`) e o Chrome roda com
`--disk-cache-size=1`, então sempre carrega a versão atual — sem servir
foto/vídeo antigo do cache.

Durante o setup, com teclado, dá pra forçar recarga sem reabrir:
**Ctrl+Shift+R** (hard reload).

## 6. Sanidade pré-show — checklist

- [ ] `bin\miniserve.exe` presente na pasta.
- [ ] `kiosk-launch.bat` sobe sem erro; `http://localhost:8765/` responde.
- [ ] Chrome abre fullscreen na mesa, sem cursor, sem barras.
- [ ] Touch responde: `INÍCIO` na splash, pílulas `VÍDEOS`/`FOTOS`,
      submenu `PLANTAS`/`PERSPECTIVAS`, chevrons da galeria, `VOLTAR`.
- [ ] Pelo menos um vídeo (`videos/*.mp4`) presente e tocando com áudio
      audível pela saída da mesa.
- [ ] Galerias sem mídia caem no placeholder cinza gracioso (esperado
      enquanto o cliente não entrega os assets finais).
- [ ] Idle 7 min volta para a splash (ajustável em
      `config.json → idleTimeoutMs`).
- [ ] `kiosk-launch.bat` (ou watchdog) na pasta de Startup.
- [ ] Login automático + sleep/screensaver desativados.
- [ ] Reboot → mesa volta sozinha sem intervenção.

## 7. Atalhos de dev (Esc-hatches)

Na mesa em produção não há teclado — mas durante o setup, com teclado:

- `Esc` ou `Backspace` → voltar uma tela
- `←` / `→` numa `gallery` → imagem anterior / próxima
- `?screen=menu` ou `?screen=gallery&path=fotos/plantas` na URL → abre direto
  numa tela (QA de design; sem efeito no uso normal)
- `Alt + F4` → fecha o Chrome (watchdog relança em 2 s)
- `Ctrl + Shift + I` → DevTools
