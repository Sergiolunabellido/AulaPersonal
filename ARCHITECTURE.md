# Architecture

## Overview
```
Electron (main.js) ──spawns──► Spring Boot (backend.jar) ──JPA──► H2 Database
       │                          │
       │ IPC (contextBridge)      │ HTTP (localhost:8080)
       ▼                          ▼
   Renderer (index.html) ◄──fetch──┘
   SPA pages (AppBlocker, Pomodoro, Notes, AI Chat)
```

## Layers

### Electron Main Process
- Spawns backend JAR on startup, waits for HTTP 200
- Provides IPC handlers: `obtener-icono`, `bloquear-apps`, `desbloquear-todo`
- Kills backend on app quit

### Frontend SPA
- Shell: `index.html` (sidebar + content area + modal)
- Router: `index.js` (`cargarPagina()` loads HTML via fetch + script recreation)
- Pages as isolated IIFE modules in subdirectories
- `window.electronAPI` for native operations, `fetch()` for REST

### Backend (Spring Boot)
- **notas**: NotaController → NotaService → NotaRepository → Nota (JPA)
- **chatAI**: ChatController → ChatService → (ConversacionRepository + MensajeRepository) → proxy to Ollama/Custom API
- CORS configured for `file://` and `http://localhost`

## Data Flow
1. User clicks sidebar → `cargarPagina()` fetches HTML → injects into `#app`
2. Page scripts call REST API (`localhost:8080`) or IPC (`window.electronAPI`)
3. Backend processes via JPA (H2 file) or proxies to external AI APIs
