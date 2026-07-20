# Aula Personal — Agent Instructions

## Project Overview
Desktop productivity suite built with Electron + Spring Boot (Java 17). Manages focus sessions via App Blocker (process kill), Pomodoro timer, persistent notes (H2 database), and AI Chat (Ollama/Custom API).

## Build & Run
- `npm start` — launch Electron app (assumes backend is built)
- `npm run build:backend` — compile Spring Boot JAR + minimal JRE via jlink
- `npm run build` — full build + electron-builder
- `npm run build:win` — Windows NSIS installer
- `.\gradlew.bat test` — run backend tests
- `.\gradlew.bat bootRun` — run backend standalone (dev)

## Code Conventions
- **Frontend**: Vanilla JS, IIFE pattern with `'use strict'`, Tailwind CSS via CDN
- **Backend**: Spring Boot 4.0.6, Java 17, JPA/H2, 3-layer pattern (Controller → Service → Repository)
- **Spanish naming** for domain entities (Nota, Conversacion, Mensaje)
- **REST API** at `localhost:8080`, frontend communicates via `fetch()`
- All frontend scripts must be IIFE to prevent SPA redeclaration conflicts

## Key Architecture
- Frontend loads pages via `cargarPagina()` SPA mechanism (`innerHTML` + script recreation)
- `window.electronAPI` exposes IPC methods (block apps, get file icons)
- Backend auto-started by Electron main process, waits for health check on `/api/notas`
- Config stored in localStorage; chat sessions/messages persisted in H2

## Agent Config Files
- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans
- `electron/renderer/` — frontend pages
- `src/main/java/org/example/aulapersonal/` — backend packages
