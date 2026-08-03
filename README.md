# 📚 Aula Personal

**Aula Personal** es una suite de productividad de escritorio 🖥️ diseñada para estudiantes y personas que trabajan desde casa. Ayuda a mantener el enfoque bloqueando aplicaciones distractoras 🚫, gestionando sesiones de estudio con la técnica Pomodoro 🍅, y tomando notas persistentes 📝.

---

## ✨ Tecnologías

| Capa | Tecnología |
|---|---|
| 🎨 Frontend | Electron 35, JavaScript, Tailwind CSS (CDN) |
| ⚙️ Backend | Spring Boot 4.0.6, Java 17, Gradle |
| 🗄️ Base de datos | H2 embebida (producción) / MySQL (desarrollo) |
| 🔒 Seguridad | Context isolation + preload script (Electron) |
| 📦 Distribución | electron-builder (NSIS Windows / Linux dir) |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│  🖥️ Electron (ventana nativa)                    │
│  ┌───────────────────────────────────────────┐   │
│  │  🌐 Renderer (index.html + SPA)           │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ 👋      │ │ 🚫 App   │ │ 🍅       │   │   │
│  │  │ Welcome │ │ Blocker  │ │ Pomodoro │   │   │
│  │  ├─────────┤ ├──────────┤ ├──────────┤   │   │
│  │  │ 📝     │ │ 🤖 AI    │ │ 🎵 Music │   │   │
│  │  │ Notes  │ │ Chat     │ │ (futuro) │   │   │
│  │  └─────────┘ └──────────┘ └──────────┘   │   │
│  └──────────┬────────────────────────────────┘   │
│             │ 🔌 IPC (contextBridge)              │
│  ┌──────────▼────────────────────────────────┐   │
│  │  ⚡ Main Process (main.js)                  │   │
│  │  • Inicia backend.jar                      │   │
│  │  • Bloquea procesos (taskkill/pkill)       │   │
│  │  • Obtiene iconos del sistema              │   │
│  └──────────┬────────────────────────────────┘   │
└─────────────┼───────────────────────────────────┘
              │ 🌐 HTTP (localhost:8080)
┌─────────────▼───────────────────────────────────┐
│  ☕ Spring Boot (backend.jar)                     │
│  ┌───────────────────────────────────────────┐   │
│  │  NotaController → NotaService → JPA/H2   │   │
│  │  H2 Database (archivo embebido)           │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

El frontend de Electron se comunica con el backend mediante `fetch()` a `localhost:8080`. El proceso principal (`main.js`) también ejecuta tareas nativas como matar procesos del sistema. El puente seguro entre renderer y main se hace mediante **IPC** (`ipcRenderer.invoke` / `ipcMain.handle`).

---

## 🚀 Funcionalidades

### 🚫 App Blocker
Bloquea aplicaciones distractoras durante el tiempo de estudio.

- ➕ Añadir/quitar aplicaciones por nombre de proceso
- ⏱️ Bloqueo temporal con temporizador visible
- 💾 Persistencia del estado al navegar entre páginas
- 🔗 Integración con Pomodoro para bloqueo automático
- 🪟 Windows: `taskkill` | 🐧 Linux: `pkill`

### 🍅 Pomodoro
Temporizador de estudio basado en la técnica Pomodoro con alternancia automática.

- ⏲️ Duración de sesión configurable (30 min – 3 h)
- 🔢 Número de sesiones personalizable
- ☕ Duración de descansos (5 – 30 min)
- 👁️ Vista previa con totales calculados
- 💾 Persistencia del temporizador (sobrevive a navegación y cierre)
- 🔒 Bloqueo automático de apps al iniciar
- 🔊 Aviso sonoro al finalizar cada sesión

### 📝 Notes
Bloc de notas persistente con almacenamiento en H2 vía API REST.

- ✏️ Crear, editar, guardar y eliminar notas
- 📋 Lista lateral ordenada por última modificación
- ⌨️ Atajo `Ctrl+S` para guardar
- 💾 Persistencia completa (sobrevive al cierre)

### 🤖 AI Chat *(próximamente)*
Asistente virtual con inteligencia artificial e historial de conversaciones persistente.

### 🎵 Music *(próximamente)*
Reproductor de música integrado con APIs externas (Spotify, radios).

---

## 📦 Requisitos (para desarrollo)

- **Node.js** 18+
- **Java** 17+ (JDK)
- **Gradle** (incluido como wrapper)

> 🚀 **Para usuarios finales**: no necesitan nada. El instalador incluye JRE propio.

---

## 🛠️ Comandos

```bash
# 🔧 Desarrollo (solo frontend, asume backend corriendo)
npm start

# 📦 Compilar backend (JAR + JRE mínimo)
npm run build:backend

# 🏗️ Compilar todo e instalar
npm run build

# ✅ Tests del backend
./gradlew test          # Linux/Mac
gradlew.bat test        # Windows
```

---

## 🌐 API REST

### 📝 Notas

| Método | Ruta | Descripción | Código |
|---|---|---|---|
| `GET` | `/api/notas` | Lista todas las notas | `200` |
| `GET` | `/api/notas/{id}` | Obtiene una nota por ID | `200` / `404` |
| `POST` | `/api/notas` | Crea una nota `{"titulo": "...", "contenido": "..."}` | `201` |
| `PUT` | `/api/notas/{id}` | Actualiza una nota | `200` / `404` |
| `DELETE` | `/api/notas/{id}` | Elimina una nota | `204` / `404` |

> ℹ️ `titulo` es obligatorio. Si está vacío → `400 Bad Request`.

---

## 📁 Estructura del proyecto

```
AulaPersonal/
├── 📦 electron/                    # Frontend Electron
│   ├── ⚡ main.js                  # Proceso principal
│   ├── 🔌 preload.js               # Bridge IPC (contextBridge)
│   └── 🌐 renderer/                # Interfaz de usuario (SPA)
│       ├── 🏠 index.html           # Layout + sidebar
│       ├── ⚙️ index.js             # Navegación SPA + alertas
│       ├── 🚫 AppBlocker/          # Bloqueo de aplicaciones
│       ├── 🍅 Pomodoro/            # Temporizador Pomodoro
│       ├── 📝 notes/               # Bloc de notas
│       ├── 🤖 chatAI/              # Chat con IA (en desarrollo)
│       ├── 👋 welcome/             # Página de inicio
│       └── 🖼️ assets/              # Imágenes y recursos
├── ☕ src/                          # Backend Spring Boot
│   └── main/java/.../
│       ├── 🚀 AulaPersonalApplication.java
│       ├── ⚙️ config/              # Configuración (CORS)
│       └── 📝 notas/               # Módulo Notas (Controller, Service, Repository, Entity)
├── 📜 build.gradle                 # Dependencias Gradle
├── 📜 package.json                 # Dependencias Node/Electron
├── 📜 settings.gradle
└── 📖 DOCUMENTACION.md             # Documentación detallada
```

---

## 💾 Persistencia

### Backend (H2 Database)
- 📁 Archivo: `{userData}/data/aulapersonal.mv.db`
- 🤖 `ddl-auto=update` (creación automática de tablas)
- 🔄 Perfil `mysql` disponible para desarrollo

### Frontend (localStorage / sessionStorage)

| Clave | Almacén | Contenido |
|---|---|---|
| `apps-bloqueo` | `localStorage` | Apps registradas por el usuario |
| `pomodoro-apps-seleccionadas` | `localStorage` | Apps marcadas para bloqueo desde Pomodoro |
| `pomodoro-config` | `localStorage` | Configuración del temporizador |
| `pomodoro-timer` | `localStorage` | Estado activo del temporizador |
| `appblocker-bloqueo` | `sessionStorage` | Estado de bloqueo activo |

---

## 📄 Licencia

ISC


## Futuras Mejoras

- Implementación de MCPs en el Chat con IA.
- Implementación de Skills en el chat con IA.
- Alojamiento de modelos gratuitos en nube para un uso mas rápido desde cualquier tipo de equipo.
