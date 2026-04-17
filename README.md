<div align="center">

```
██████╗ ██╗  ██╗    ████████╗███████╗██████╗ ███╗   ███╗
██╔══██╗╚██╗██╔╝    ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║
██████╔╝ ╚███╔╝        ██║   █████╗  ██████╔╝██╔████╔██║
██╔══██╗ ██╔██╗        ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║
██║  ██║██╔╝ ██╗       ██║   ███████╗██║  ██║██║ ╚═╝ ██║
╚═╝  ╚═╝╚═╝  ╚═╝       ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
```

**The terminal you actually want to use.**

[![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows)](https://github.com/RANJITH12022004/rxterm/releases)
[![Linux](https://img.shields.io/badge/Linux-coming_soon-orange?style=flat-square&logo=linux)](/)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square&logo=electron)](https://electronjs.org)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-shipping-00FF9C?style=flat-square)]()

</div>

---

## The Problem

Every time you need a file path, you leave the terminal. Open Explorer, navigate, right-click, copy path, go back, paste. Ten seconds of pure waste. Multiply that by 40 tabs open, 30 commands you don't remember, and an SSH session you forgot to save — and you've built a productivity hole you live in daily.

I got tired of it. So I built the terminal that doesn't make you leave.

RXTerm is a **native terminal emulator** built from scratch — not a shell plugin, not a VS Code extension. A real Electron + PTY application with an AI layer that understands what you're trying to do, a system monitor that stays in frame, a file explorer that injects paths directly at the cursor, and a session recorder so nothing gets lost. Everything in one window. Zero tab-switching.

> *"The best terminal is the one you never have to leave."*

---

## What It Does

### Natural Language → Command (RX Term AI)
Press `Ctrl+Space`. Type what you want in plain English. RX Term AI translates it to the exact shell command and injects it at your cursor. Powered by a custom-trained model with a corpus of real-world command patterns — built on Gemini, shaped by thousands of real terminal sessions. No cloud round-trips for common patterns. No hallucinated flags.

```
NL> find all python files modified today
→  Get-ChildItem -Recurse -Filter *.py | Where-Object { $_.LastWriteTime -gt (Get-Date).Date }
```

### Error Whisperer
When a command fails, RXTerm doesn't just show you the red text and wait. It reads the exit code, parses the output, and slides in a fix panel — with a diff between what you ran and what you should run. One click to apply. No Googling.

### Live System Dashboard
CPU, RAM, disk, network — live, in a side panel that doesn't get in the way. Top process table updates in real time. Because `tasklist` every 10 seconds is not a workflow.

### File Explorer with Direct Injection
Browse your filesystem in the left panel. Click a folder to `cd` there. Right-click to copy the path — and it goes straight to your terminal cursor, not your clipboard. This is the feature that kills the `cd ../../../../where/was/that/folder` problem.

### Session Recording + Replay
Every terminal session can be recorded to a `.nexrec` file. Play it back at 0.5x, 1x, 2x, 5x, or 10x with a scrub bar. 98 seconds of session fits in ~45KB. Good for debugging, documentation, and demos.

### Command History Timeline
Every command you run is stored in SQLite with timestamp, exit code, duration, and the natural language query that generated it (if any). Rerun anything in one click. The terminal finally has memory.

### Snippet Library
Save commands you always forget. Fuzzy search by title, description, or tag. Click to inject. Import/export as JSON. It's a personal command knowledge base that travels with the app.

### Multi-Tab Sessions
`Ctrl+T` opens a new tab. Each tab is an independent PTY session with its own WebSocket connection. Drag to reorder. `Ctrl+W` to close.

---

## Demo

> *(Screen recording coming — Linux build ships first, then full demo video)*

**Screenshots from the running Windows build:**

| Boot Screen | Terminal + NL Bar | System Dashboard |
|---|---|---|
| ![boot](assets/screenshots/boot.png) | ![nl](assets/screenshots/nl_bar.png) | ![sys](assets/screenshots/system_panel.png) |

| History Timeline | Snippet Library | Session Replay |
|---|---|---|
| ![history](assets/screenshots/history.png) | ![snippets](assets/screenshots/snippets.png) | ![replay](assets/screenshots/replay.png) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON SHELL                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │              RENDERER PROCESS (React)             │   │
│  │                                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │ Terminal │ │  NL Bar  │ │  System Panel     │  │   │
│  │  │ xterm.js │ │ Ctrl+Spc │ │  CPU/RAM/Disk     │  │   │
│  │  └────┬─────┘ └────┬─────┘ └──────────────────┘  │   │
│  │       │             │                              │   │
│  │  ┌────▼─────────────▼──────────────────────────┐  │   │
│  │  │         WebSocket (ws://localhost:8765)       │  │   │
│  │  └────────────────────┬────────────────────────┘  │   │
│  └───────────────────────┼────────────────────────────┘   │
└──────────────────────────┼─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                  BACKEND (FastAPI + Python)                  │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  PTY Bridge │  │  RX Term AI  │  │  Metrics Engine   │   │
│  │  pywinpty   │  │  ai_bridge   │  │  psutil polling   │   │
│  │  (Windows)  │  │  + Gemini    │  │  every 2s         │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           SQLite (rxterm.db via aiosqlite)           │    │
│  │   commands | snippets | sessions | recordings        │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Animation stack:** GSAP 3 (layout, panel transitions, boot sequence) + Anime.js (micro-interactions, typewriter, gauge animations) + Barba.js (view transitions between Terminal / History / Snippets)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 31 + Node.js |
| UI | React 18, Vite 5 |
| Terminal | xterm.js 5.5 (attach, fit, web-links, search addons) |
| Backend | FastAPI 0.111, uvicorn, Python 3.10+ |
| PTY | pywinpty (Windows) → pty (Linux, coming) |
| AI | RX Term AI — custom-trained on real command corpora, backed by Gemini 1.5 Flash |
| System Metrics | psutil 6 |
| Database | SQLite via aiosqlite |
| State | Zustand 4 |
| Charts | Recharts |
| Animations | GSAP 3.15, Anime.js 3.2, Barba.js 2.10 |
| Packaging | PyInstaller + electron-builder (NSIS) |

---

## Project Structure

```
RXTerm/
├── electron/
│   ├── main.js              # App lifecycle, window management, IPC
│   ├── preload.js           # Secure renderer-main bridge
│   └── ipc.js               # IPC handler registry
├── renderer/
│   ├── App.jsx              # Root — WebSocket init, tab orchestration
│   ├── components/
│   │   ├── Terminal.jsx     # xterm.js + AttachAddon + focus logic
│   │   ├── NLBar.jsx        # Natural language input (Ctrl+Space)
│   │   ├── ErrorPanel.jsx   # Error Whisperer — auto-fix on non-zero exit
│   │   ├── SystemPanel.jsx  # Live CPU/RAM/disk/network dashboard
│   │   ├── FileExplorer.jsx # File tree with direct path injection
│   │   ├── HistoryTimeline.jsx  # SQLite command history with rerun
│   │   ├── SnippetLibrary.jsx   # Saved commands CRUD + fuzzy search
│   │   ├── ReplayView.jsx   # .nexrec playback with speed controls
│   │   ├── TabBar.jsx       # Multi-tab management
│   │   ├── TitleBar.jsx     # Custom title bar + recording toggle
│   │   └── BootScreen.jsx   # Animated logo sequence on launch
│   ├── hooks/
│   │   ├── useWebSocket.js  # WS connection + reconnect logic
│   │   ├── useMetrics.js    # Subscribes to live metrics messages
│   │   ├── useShortcuts.js  # Global keyboard shortcuts
│   │   └── useDragDrop.js   # Window-level file drag detection
│   ├── store/
│   │   └── terminalStore.js # Zustand — tabs, metrics, UI state
│   ├── animations/
│   │   ├── gsap-timelines.js   # Panel open/close, boot, tab animations
│   │   ├── anime-effects.js    # Typewriter, gauges, counters
│   │   └── barba-config.js     # View transition routes
│   └── themes/
│       └── hacker.css       # Full design system — CSS variables only
├── backend/
│   ├── main.py              # FastAPI app, WebSocket handler, REST routes
│   ├── pty_factory.py       # Platform router → Windows / Linux PTY
│   ├── pty_windows.py       # pywinpty PTY + error detection
│   ├── ai_bridge.py         # RX Term AI — NL→command, error fix, explain
│   ├── metrics.py           # psutil polling, async metrics broadcaster
│   ├── history.py           # SQLite schema + command/snippet CRUD
│   └── recorder.py          # .nexrec session recording + read
├── docs/
│   ├── PERFORMANCE_AUDIT.md
│   └── QA_CHECKLIST.md
├── assets/
│   ├── rxterm_logo.svg
│   └── rxterm_brand_nameplate.html
├── .env.example
└── package.json
```

---

## Getting Started

### Prerequisites

- Windows 10/11 (Linux build in progress)
- Node.js 18+
- Python 3.10+
- A Gemini API key ([get one free](https://aistudio.google.com/))

### Install & Run

```bash
# Clone
git clone https://github.com/RANJITH12022004/rxterm.git
cd rxterm

# Frontend dependencies
npm install

# Backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# Environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# Dev mode (starts both Electron + FastAPI backend)
npm run dev
```

### Build (Windows installer)

```bash
# Build backend → backend.exe (PyInstaller)
npm run build:backend

# Build Electron installer → release/RXTerm Setup 1.0.0.exe
npm run build
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Space` | Open NL bar — type what you want, get the command |
| `Ctrl+T` | New terminal tab |
| `Ctrl+W` | Close current tab |
| `Ctrl+Shift+R` | Start / stop session recording |
| `Ctrl+Shift+M` | Toggle system metrics panel |
| `Ctrl+P` | Fuzzy search in file explorer |

---

## What's Next

**Linux support** — the PTY layer (`pty_factory.py`) already branches for non-Windows. The Linux build (`pty_linux.py`) is the active next milestone. Once it ships, RXTerm becomes cross-platform with a single codebase.

**RX Term AI v2** — the model is currently trained on thousands of real command patterns. The roadmap is continuous learning from anonymized session data — the more it's used, the smarter it gets, eventually running fully native without cloud calls for most queries.

**Planned features:**
- SSH session management with saved hosts
- Split panes (horizontal + vertical)
- Theme marketplace
- Plugin API

---

## Why I Built This

I don't use tools that make me think about the tool.

Every terminal emulator I tried had the same problem: the moment you need something that isn't pure shell — a file path, a command you ran three days ago, what that flag actually does — you leave. Open a browser, open a file manager, open another tab, lose your context, come back. Repeat.

I got tired of context-switching. So I started breaking things. I ran existing terminals until I found where they stopped — where the design assumptions were wrong, where the UX said "figure it out yourself," where the integration was missing. Then I built what should have been there.

RXTerm is the answer to the question: *what if the terminal was the last thing you needed to open?*

---

## Contributing

RXTerm is in active development. Bug reports, feature ideas, and PRs are welcome.

If you find a case where the NL→command translation fails, open an issue with the query — that's training data.

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Built by [Ranjith Kumar Dasari](https://linkedin.com/in/ranjith-kumar-dasari) · [LinkedIn](https://linkedin.com/in/ranjith-kumar-dasari) · [GitHub](https://github.com/RANJITH12022004)

*Windows build: shipping. Linux build: in progress. Mediocrity: not on the roadmap.*

</div>
