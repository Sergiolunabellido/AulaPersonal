# Aula Personal

Suite de productividad de escritorio para estudiar y trabajar con foco: bloqueo de apps, Pomodoro, notas, chat con IA (Ollama / APIs) y radio/música.

---

## Instalación (usuarios)

No hace falta instalar Java, Node ni Ollama: van incluidos en el paquete.

### Windows

1. Descarga **`Aula Personal Setup 1.0.0.exe`** desde la [última release](https://github.com/Sergiolunabellido/AulaPersonal/releases).
2. Ejecuta el instalador NSIS y elige la carpeta de instalación.
3. Marca la opción de acceso directo en el escritorio si quieres.
4. Abre **Aula Personal** desde el menú Inicio o el acceso directo.

> Si Windows SmartScreen avisa (app sin firmar), pulsa *Más información* → *Ejecutar de todas formas*.

### Linux (x64)

1. Descarga **`AulaPersonal-linux-x64.tar.gz`** desde la [última release](https://github.com/Sergiolunabellido/AulaPersonal/releases).
2. Extrae y lanza:

```bash
tar -xzf AulaPersonal-linux-x64.tar.gz
cd linux-unpacked
chmod +x aulapersonal chrome-sandbox 2>/dev/null || true
./aulapersonal
```

3. Si el sandbox de Chromium falla por permisos:

```bash
sudo chown root:root chrome-sandbox
sudo chmod 4755 chrome-sandbox
```

O inicia sin sandbox (solo si lo anterior no es viable):

```bash
./aulapersonal --no-sandbox
```

| Archivo de release | Plataforma | Contenido |
|---|---|---|
| `Aula Personal Setup 1.0.0.exe` | Windows x64 | Instalador NSIS (~1,4 GB) |
| `AulaPersonal-linux-x64.tar.gz` | Linux x64 | App portable + JRE + Ollama (~377 MB) |

---

## Qué incluye

| Módulo | Descripción |
|---|---|
| **App Blocker** | Bloquea apps distractoras (`taskkill` / `pkill`), con UI sincronizada al Pomodoro |
| **Pomodoro** | Sesiones/descansos configurables, widget en la barra lateral, funciona en segundo plano |
| **Notes** | Notas persistentes en H2 vía API REST |
| **AI Chat** | Ollama local embebido + proveedores de pago (OpenAI, Anthropic, Google, Mistral, DeepSeek, custom) |
| **Music** | Radios (Radio Browser) y reproducción integrada |

---

## Arquitectura

```
Electron (ventana)
├── Renderer (SPA: App Blocker, Pomodoro, Notes, Chat, Music)
├── Main (IPC, App Blocker, arranque backend + Ollama)
└── Recursos empaquetados
    ├── JRE mínimo (jlink) + backend.jar  →  localhost:8080
    └── Ollama embebido                  →  modelos locales
```

Frontend ↔ backend con `fetch()` a `http://localhost:8080`. IPC seguro vía `preload` + `contextBridge`.

---

## Desarrollo

### Requisitos

- Node.js 18+
- JDK 17+ (`JAVA_HOME` apuntando a un JDK válido)
- Gradle Wrapper incluido

### Comandos

```bash
# Arrancar en desarrollo (recompila backend si hace falta)
npm start

# Solo backend (JAR + JRE)
npm run build:backend

# Tests backend
.\gradlew.bat test    # Windows
./gradlew test        # Linux/macOS
```

### Generar instaladores

**Importante:** el build de Linux sustituye `build/jre` y `build/ollama` por binarios Linux. Genera **primero Windows** y **después Linux**.

```bash
# Windows — genera dist/Aula Personal Setup 1.0.0.exe
npm run build:win

# Linux — genera dist/AulaPersonal-linux-x64.tar.gz
npm run build:linux
```

En Windows, para Linux hace falta `tar` (incluido) y, idealmente, WSL para empaquetar el `.tar.gz` con symlinks correctos.

---

## API REST (notas)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/notas` | Listar |
| `GET` | `/api/notas/{id}` | Obtener |
| `POST` | `/api/notas` | Crear `{"titulo","contenido"}` |
| `PUT` | `/api/notas/{id}` | Actualizar |
| `DELETE` | `/api/notas/{id}` | Eliminar |

`titulo` es obligatorio (`400` si falta).

---

## Persistencia

| Dato | Dónde |
|---|---|
| Notas, chats, mensajes | H2 en `{userData}/data/` |
| Config Pomodoro / apps | `localStorage` |
| Bloqueo activo (UI) | `sessionStorage` (`appblocker-bloqueo`) |
| API keys de chat | almacén seguro de Electron (`safeStorage`) cuando está disponible |

---

## Estructura

```
AulaPersonal/
├── electron/                 # Main, preload, renderer SPA
│   ├── main.js
│   ├── preload.js
│   ├── ollamaManager.js
│   └── renderer/             # App Blocker, Pomodoro, Notes, Chat, Music
├── src/main/java/.../        # Spring Boot (notas + chat AI)
├── scripts/                  # build-backend, ollama, linux pack, verify
├── package.json
└── build.gradle
```

---

## Futuras mejoras

- MCPs y Skills en el chat con IA
- Modelos gratuitos alojados en nube para equipos modestos
- Adición de MCPs y Skills para usar en el Chat AI

---

## Licencia

ISC
