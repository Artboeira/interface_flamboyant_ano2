# bin/ — binários portáteis para o totem

Esta pasta carrega o binário do servidor estático que o launcher Windows
(`scripts/kiosk-launch.bat`) sobe junto com o Chrome.

## miniserve.exe — presente (v0.35.0, Windows x86_64)

Servidor HTTP estático de arquivo único, escrito em Rust. Serve a
interface localmente na mesa touch (loopback only), sem dependências.

**Versão atual:** `v0.35.0` — `miniserve-0.35.0-x86_64-pc-windows-msvc.exe`
(2.1 MB, PE32+ x86-64, baixado em 2026-05-19 do repo oficial
[svenstaro/miniserve](https://github.com/svenstaro/miniserve)).

**Para atualizar:**

```bash
# Mac/Linux:
curl -sL -o bin/miniserve.exe \
  https://github.com/svenstaro/miniserve/releases/latest/download/miniserve-<NOVA_VERSAO>-x86_64-pc-windows-msvc.exe

# Ou via release page (pegar manualmente):
# https://github.com/svenstaro/miniserve/releases
# → asset "miniserve-vX.Y.Z-x86_64-pc-windows-msvc.exe"
# → renomear para miniserve.exe e colocar aqui
```

**Como o launcher usa:**

`scripts/kiosk-launch.bat` (e o `watchdog.ps1`) executam:

```
bin\miniserve.exe <pasta-do-projeto> --port 8765 \
  --interfaces 127.0.0.1 --index index.html
```

`--interfaces 127.0.0.1` força loopback only — a mesa fica offline na rede
do show, nada exposto.

**Por que miniserve:** single .exe, sem dependências (não precisa Python
nem Node instalado no PC da mesa), só fala loopback quando passamos
`--interfaces 127.0.0.1`, e é mantido. Alternativas equivalentes para
fallback: [`caddy.exe`](https://caddyserver.com/) ou
[`http-server`](https://www.npmjs.com/package/http-server) (Node).
