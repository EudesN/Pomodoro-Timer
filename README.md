# 🍅 Popomus

A modern, elegant, and customizable Pomodoro timer with task management, audio feedback, productivity analytics, and native Linux desktop integration.


## Features

- **Timer & Cycles**: Configurable focus, short, and long breaks with a smooth circular countdown.
- **Task Management**: Drag-and-drop reordering, estimate tracking, and active task badges.
- **Audio & Ambiance**: High-fidelity sound chimes, tactile click feedback, and subtle ticking.
- **Linux Desktop Integration**: Native GTK3/WebKit2 window, system tray icon, and desktop notifications.
- **Analytics & Backup**: Daily focus charts (Chart.js), local persistence, and JSON data export/import.
- **Zero Configuration**: Runs both as a native desktop application and standalone in any browser.

---

## 🚀 Quick Start

### Native Desktop (Linux)
```bash
./pomus
# or
python app.py
```

Useful flags:
- `./pomus --minimized` — Start minimized to system tray
- `./pomus --browser` — Run server and open in your default browser

### Web Browser
Open `index.html` directly in any modern browser.

---

## 📦 System Installation

Add Popomus to your desktop app launcher (user-local, no `sudo` needed):

```bash
./install.sh
```

To uninstall:
```bash
./uninstall.sh
```

---

## Requirements (Desktop Mode)

- Python 3.8+
- PyGObject & WebKit2GTK
- `libnotify` & `libayatana-appindicator` *(optional, for notifications & tray)*

**Arch Linux:**
```bash
sudo pacman -S python-gobject webkit2gtk libnotify libayatana-appindicator
```

**Debian / Ubuntu:**
```bash
sudo apt install python3-gi gir1.2-webkit2-4.1 libnotify-bin gir1.2-ayatanaappindicator3-0.1
```

---

## 📁 Project Structure

```text
├── assets/             # Assets estáticos (ícones, sons e bibliotecas vendor)
│   ├── sounds/         # Efeitos sonoros em áudio (.wav)
│   ├── icon.png        # Ícone do aplicativo em alta resolução
│   ├── icon.svg        # Ícone vetorial escalável
│   └── chart.umd.min.js# Biblioteca Chart.js empacotada
├── css/
│   └── styles.css      # Folha de estilos da interface web
├── js/                 # Lógica modular da aplicação em JavaScript
│   ├── app.js          # Orquestração principal da interface e eventos
│   ├── audio.js        # Gerenciamento de áudio (Web Audio API / nativo)
│   ├── calendar.js     # Visualização de histórico e calendário
│   ├── chart.js        # Métricas e gráficos de produtividade
│   ├── roller.js       # Componente numérico interativo de roleta
│   ├── storage.js      # Persistência de dados (localStorage / API / sync)
│   └── timer.js        # Máquina de estados do cronômetro Pomodoro
├── app.py              # Servidor local HTTP e wrapper desktop GTK3/WebKit2
├── index.html          # Ponto de entrada da interface web
├── install.sh          # Script de instalação desktop local (XDG / .desktop)
├── uninstall.sh        # Script de desinstalação
├── pomus               # Launcher executável no terminal
└── pomus.desktop       # Arquivo de integração do menu desktop Linux
```

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS, JavaScript (ES6+), Chart.js
- **Desktop Wrapper**: Python (GTK3, WebKit2, AppIndicator, PipeWire/PulseAudio)
