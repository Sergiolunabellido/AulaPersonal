# Aula Personal

**Aula Personal** es una suite de productividad de escritorio diseñada para estudiantes y personas que trabajan desde casa. Ayuda a mantener el enfoque bloqueando aplicaciones distractoras, gestionando sesiones de estudio con la técnica Pomodoro, y tomando notas persistentes.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Electron 42, JavaScript, Tailwind CSS 4 |
| Backend | Spring Boot 4.0.6, Java 17, Gradle |
| Base de datos | MySQL (vía JPA / Hibernate) |
| Seguridad | Context isolation y preload script (Electron) |

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│  Electron (cliente de escritorio)                │
│  ┌───────────────────────────────────────────┐   │
│  │  Renderer (index.html + páginas vía SPA)  │   │
│  │  - AppBlocker / Pomodoro / Notes / ...    │   │
│  └──────────┬────────────────────────────────┘   │
│             │ ipcRenderer.invoke()                │
│  ┌──────────▼────────────────────────────────┐   │
│  │  Main Process (main.js + preload.js)      │   │
│  │  - Gestión de ventanas                    │   │
│  │  - Bloqueo de procesos (taskkill)         │   │
│  └──────────┬────────────────────────────────┘   │
└─────────────┼───────────────────────────────────┘
              │ fetch() a http://localhost:8080
┌─────────────▼───────────────────────────────────┐
│  Spring Boot (API REST)                          │
│  ┌───────────────────────────────────────────┐   │
│  │  NotaController  →  NotaService  →  JPA   │   │
│  │  UserController  →  UserService  →  JPA   │   │
│  └───────────────────────────────────────────┘   │
└─────────────┬───────────────────────────────────┘
              │ JDBC
┌─────────────▼───────────────────────────────────┐
│  MySQL                                           │
│  Tablas: users, notas                            │
└─────────────────────────────────────────────────┘
```

El frontend de Electron se comunica con el backend de Spring Boot mediante peticiones HTTP (fetch) a la API REST en `localhost:8080`. El proceso principal de Electron (`main.js`) también ejecuta tareas nativas como bloquear procesos del sistema.

---

## Funcionalidades

### App Blocker
Permite seleccionar aplicaciones del sistema (por nombre de proceso) y bloquearlas durante un tiempo determinado. El bloqueo se ejecuta desde el proceso principal de Electron cada 2 segundos mediante `taskkill` en Windows. Incluye:
- Añadir/quitar aplicaciones de la lista
- Bloqueo temporal con temporizador visible
- Persistencia del estado al navegar entre páginas
- Integración con Pomodoro para bloqueo automático

### Pomodoro
Temporizador de estudio basado en la técnica Pomodoro. Configurable con:
- Duración de cada sesión (30 min a 3 h)
- Número de sesiones
- Duración de los descansos (5 a 30 min)
- Vista previa con totales calculados
- Persistencia del temporizador (sobrevive a navegación y cierre de app)
- Bloqueo automático de apps seleccionadas al iniciar

### Notes
Bloc de notas persistente con almacenamiento en MySQL vía API REST. Incluye:
- Crear, editar, guardar y eliminar notas
- Lista lateral con todas las notas ordenadas por última modificación
- Editor de texto con título y contenido
- Atajo Ctrl+S para guardar
- Persistencia completa: las notas sobreviven al cierre de la app

### Próximamente
- **AI Chat** — asistente virtual con inteligencia artificial e historial de conversaciones persistente
- **Music** — reproductor de música integrado con APIs externas (Spotify, radios) y carga de música propia

---

## Requisitos

- **Node.js** 18+
- **Java** 17+
- **MySQL** 8+
- **Gradle** (incluido como wrapper)

---

## API REST

### Notas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/notas` | Lista todas las notas |
| `GET` | `/api/notas/{id}` | Obtiene una nota |
| `POST` | `/api/notas` | Crea una nota (`{"titulo": "...", "contenido": "..."}`) |
| `PUT` | `/api/notas/{id}` | Actualiza una nota |
| `DELETE` | `/api/notas/{id}` | Elimina una nota |

### Usuarios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/users/email?email=...` | Busca usuario por email |

---

## Estructura del proyecto

```
AulaPersonal/
├── electron/                    # Frontend Electron
│   ├── main.js                  # Proceso principal
│   ├── preload.js               # Bridge de seguridad (contextBridge)
│   └── renderer/                # Interfaz de usuario (SPA)
│       ├── index.html           # Layout principal + sidebar
│       ├── index.js             # Navegación SPA + alertas
│       ├── AppBlocker/          # Bloqueo de aplicaciones
│       ├── Pomodoro/            # Temporizador Pomodoro
│       ├── notes/               # Bloc de notas
│       ├── chatAI/              # Chat con IA (en desarrollo)
│       ├── welcome/             # Página de inicio
│       └── assets/              # Imágenes y recursos
├── src/                         # Backend Spring Boot
│   └── main/java/.../
│       ├── AulaPersonalApplication.java
│       ├── user/                # Usuarios (User, Repository, Service, Controller)
│       ├── notas/               # Notas (Nota, Repository, Service, Controller)
│       ├── config/              # Configuración (CORS)
│       ├── auth/                # Autenticación (vacío, en desarrollo)
│       ├── common/              # Utilidades comunes
│       ├── exception/           # Manejo de excepciones
│       ├── pomodoro/            # (vacío, reservado)
│       └── security/            # (vacío, reservado)
├── build.gradle                 # Dependencias Gradle
├── package.json                 # Dependencias Node/Electron
└── settings.gradle
```

---

## Licencia

ISC
