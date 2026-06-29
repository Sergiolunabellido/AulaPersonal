# Documentación de Aula Personal

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Estructura de Directorios](#2-estructura-de-directorios)
3. [Frontend (Electron)](#3-frontend-electron)
4. [Backend (Spring Boot)](#4-backend-spring-boot)
5. [Flujo de Datos](#5-flujo-de-datos)
6. [Persistencia](#6-persistencia)
7. [Funcionalidades](#7-funcionalidades)
8. [Construcción y Distribución](#8-construcción-y-distribución)

---

## 1. Arquitectura General

Aula Personal es una aplicación de escritorio que combina:

- **Frontend**: Electron con HTML, CSS (Tailwind via CDN) y JavaScript vanilla
- **Backend**: Spring Boot con Java 17, JPA/H2
- **Comunicación**: HTTP REST (`localhost:8080`)

```
┌─────────────────────────────────────────────────┐
│  Electron (ventana nativa)                       │
│                                                   │
│  ┌─────────────────────────────────────────┐     │
│  │  Renderer (index.html + index.js)       │     │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ │     │
│  │  │ Welcome  │ │ AppBlock │ │ Pomodoro │ │     │
│  │  │ (SPA)    │ │ er       │ │          │ │     │
│  │  └─────────┘ └──────────┘ └──────────┘ │     │
│  │  ┌─────────┐ ┌──────────┐              │     │
│  │  │ Notes   │ │ AI Chat  │              │     │
│  │  │         │ │ (futuro) │              │     │
│  │  └─────────┘ └──────────┘              │     │
│  └─────────────────────────────────────────┘     │
│         │ IPC (contextBridge)                     │
│  ┌───────┴─────────────────────────────────┐     │
│  │  Main Process (main.js)                  │     │
│  │  - Spawnea el backend JAR                │     │
│  │  - Bloqueo de procesos (taskkill/pkill)  │     │
│  │  - Obtener iconos de archivos            │     │
│  └───────┬─────────────────────────────────┘     │
└──────────┼──────────────────────────────────────┘
           │ HTTP (localhost:8080)
┌──────────┴──────────────────────────────────────┐
│  Spring Boot (backend.jar)                       │
│  ┌─────────────────────────────────────────┐     │
│  │  NotaController → NotaService → NotaRepo│     │
│  │  H2 Database (embebida)                 │     │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

---

## 2. Estructura de Directorios

```
AulaPersonal/
├── electron/                       # Código del frontend Electron
│   ├── main.js                     # Proceso principal de Electron
│   ├── preload.js                  # Puente entre Main y Renderer (contextBridge)
│   └── renderer/                   # Interfaz de usuario (páginas SPA)
│       ├── index.html              # Shell principal (sidebar, layout)
│       ├── index.js                # Navegación SPA + alertas modales
│       ├── input.css               # Estilos base Tailwind
│       ├── output.css              # CSS compilado
│       ├── assets/imagenes/        # Recursos estáticos (SVG, etc.)
│       ├── welcome/                # Página de bienvenida
│       │   └── welcome.html
│       ├── AppBlocker/             # Bloqueador de aplicaciones
│       │   ├── appBlocker.html
│       │   └── appBlocker.js
│       ├── Pomodoro/               # Temporizador Pomodoro
│       │   ├── pomodoro.html
│       │   └── pomodoro.js
│       ├── notes/                  # Notas
│       │   ├── notes.html
│       │   └── notes.js
│       └── chatAI/                 # Chat con IA (en construcción)
│           ├── chat.html
│           └── functionChat.js
│
├── src/                            # Código del backend Spring Boot
│   ├── main/
│   │   ├── java/org/example/aulapersonal/
│   │   │   ├── AulaPersonalApplication.java   # Entry point
│   │   │   ├── config/
│   │   │   │   └── ConfiguracionCors.java      # CORS (permite file://)
│   │   │   ├── notas/                          # Módulo Notas
│   │   │   │   ├── Nota.java                   # Entidad JPA
│   │   │   │   ├── NotaRepository.java         # Repositorio JPA
│   │   │   │   ├── NotaService.java            # Lógica de negocio
│   │   │   │   └── NotaController.java         # REST API
│   │   │   ├── pomodoro/                       # (vacío - futuro)
│   │   │   ├── security/                       # (vacío - futuro)
│   │   │   ├── auth/                           # (vacío - futuro)
│   │   │   ├── common/                         # (vacío - futuro)
│   │   │   └── exception/                      # (vacío - futuro)
│   │   └── resources/
│   │       ├── application.properties          # Config H2 (default)
│   │       └── application-mysql.properties    # Config MySQL (alternativa)
│   └── test/java/org/example/aulapersonal/
│       └── AulaPersonalApplicationTests.java   # Test de contexto
│
├── scripts/
│   ├── build-backend.js            # Script para compilar backend
│   └── build-linux-docker.ps1      # Script para build Linux desde Windows
│
├── build.gradle                    # Dependencias y tareas Gradle
├── settings.gradle                 # Configuración Gradle
├── package.json                    # Dependencias npm + electron-builder
└── README.md                       # Documentación principal
```

---

## 3. Frontend (Electron)

### 3.1. Proceso Principal (`electron/main.js`)

Se encarga de:

- **Iniciar el backend**: Spawnea `java -jar backend.jar` al abrir la app y espera a que responda en `localhost:8080`
- **Crear la ventana**: Carga `electron/renderer/index.html`
- **IPC Handlers**: Escucha peticiones del renderer:
  - `obtener-icono` → devuelve el icono de un archivo
  - `bloquear-apps` → cada 2s ejecuta `taskkill` (Windows) o `pkill` (Linux)
  - `desbloquear-todo` → detiene el intervalo de bloqueo
- **Matar procesos**: Detecta SO con `esWindows`/`esLinux`

Funciones clave:

| Función | Descripción |
|---------|-------------|
| `obtenerJavaEjecutable()` | Devuelve ruta al JRE empaquetado o `java` global |
| `obtenerRutaJar()` | Localiza el JAR dentro de `resources` o en `build/libs` |
| `matarProceso(nombre)` | Mata un proceso por nombre (taskkill/pkill) |
| `iniciarBackend()` | Arranca el proceso Java con el JAR |
| `esperarBackend()` | Polling a `/api/notas` hasta 30s |
| `crearVentana()` | Crea `BrowserWindow` con preload |

### 3.2. Preload (`electron/preload.js`)

Puente seguro entre el proceso main y el renderer mediante `contextBridge`:

```js
contextBridge.exposeInMainWorld('electronAPI', {
    obtenerIcono: (ruta) => ipcRenderer.invoke('obtener-icono', ruta),
    bloquearApps: (apps, minutos) => ipcRenderer.invoke('bloquear-apps', apps, minutos),
    desbloquearTodo: () => ipcRenderer.invoke('desbloquear-todo'),
});
```

### 3.3. Shell SPA (`electron/renderer/index.html` + `index.js`)

**`index.html`**: Layout principal con:
- **Sidebar** (`#barraLateral`): logo + menú de navegación + footer (Focus Session, Settings, Help)
- **Contenido** (`#app`): donde se inyectan las páginas vía `innerHTML`
- **Modal de alertas** (`#modal-overlay`): overlay para mensajes info/warning/success/error

**`index.js`**: Controlador de navegación SPA con `cargarPagina(evento, pagina)`:

```js
const rutas = {
    bienvenida: 'welcome/welcome.html',
    bloqueoApps: 'AppBlocker/appBlocker.html',
    pomodoro: 'Pomodoro/pomodoro.html',
    chatIA: '',
    musica: '',
    notas: 'notes/notes.html',
};
```

**Mecanismo de carga**: 
1. `fetch(ruta)` obtiene el HTML de la página
2. Se asigna a `divApp.innerHTML`
3. Los `<script>` se recrean con `document.createElement('script')` para que el navegador los ejecute (las IIFE permiten recarga segura)

### 3.4. Páginas

#### Welcome (`welcome/welcome.html`)
- Grid de tarjetas con acceso directo a cada herramienta
- Sin JS propio, solo enlaces a `cargarPagina()`

#### App Blocker (`AppBlocker/appBlocker.js`)

Gestiona una lista de aplicaciones para bloquear durante el estudio.

**Variables de estado**:
- `aplicaciones[]` — apps registradas por el usuario (localStorage clave `apps-bloqueo`)
- `bloqueadas[]` — apps actualmente bloqueadas
- `finBloqueo` — timestamp de fin del bloqueo
- `idTemporizador` — timeout para actualizar cuenta atrás

**Funciones**:

| Función | Descripción |
|---------|-------------|
| `obtenerApps()` | Lee apps de localStorage |
| `guardarApp(nombre, proceso, ruta)` | Agrega una app |
| `eliminarApp(idApp)` | Elimina una app |
| `renderizarApps(lista)` | Renderiza las tarjetas en el grid |
| `iniciarBloqueo()` | Bloquea apps seleccionadas vía IPC |
| `desbloquearTodo()` | Desbloquea todo vía IPC |
| `actualizarTiempoRestante()` | Cuenta atrás en UI |
| `sincronizarSeleccionadas()` | Guarda selección para Pomodoro |
| `obtenerSeleccionadas()` | Lee selección de localStorage |

**Persistencia**:
- `localStorage` clave `apps-bloqueo` → lista de apps
- `localStorage` clave `pomodoro-apps-seleccionadas` → apps marcadas para Pomodoro
- `sessionStorage` clave `appblocker-bloqueo` → estado de bloqueo activo

#### Pomodoro (`Pomodoro/pomodoro.js`)

Temporizador de sesiones de estudio con alternancia automática sesión/descanso.

**Variables de estado**:
- `estado` — configuración (`minutosSesion`, `numeroSesiones`, `minutosDescanso`)
- `temporizador` — estado en ejecución (`estado`, `fase`, `sesionActual`, etc.)

**Estados**:
- `idle` — configuración visible
- `running` — cuenta atrás activa
- `paused` — pausado
- `completed` — todas las sesiones completadas

**Fases** dentro de running:
- `session` — periodo de estudio
- `break` — descanso entre sesiones

**Funciones clave**:

| Función | Descripción |
|---------|-------------|
| `iniciarTemporizador()` | Arranca el ciclo pomodoro |
| `alternarPausa()` | Pausa/reanuda |
| `detenerTemporizador()` | Vuelve a idle |
| `reiniciarTemporizador()` | Desde completed → idle |
| `manejarFinFase()` | Transición sesión↔descanso |
| `ejecutarTick()` | Cada 1s: decrementa tiempo y actualiza UI |
| `reproducirSonido()` | Beep con Web Audio API al finalizar fase |
| `bloquearAppsSeleccionadas()` | Bloquea apps por la duración total |
| `formatearCuentaAtras(seg)` | Formatea segundos a mm:ss o h:mm:ss |

**Persistencia**: localStorage claves `pomodoro-config` y `pomodoro-timer`. El temporizador sobrevive a navegación y cierre de app (al restaurar calcula el tiempo transcurrido).

#### Notes (`notes/notes.js` y `notes/notes.html`)

CRUD completo de notas conectado al backend Spring Boot.

**Layout**: dos paneles — lista a la izquierda, editor a la derecha.

**Funciones**:

| Función | Descripción |
|---------|-------------|
| `peticion(metodo, ruta, cuerpo)` | Helper para llamadas HTTP al backend |
| `cargarNotas()` | GET /api/notas y renderiza lista |
| `seleccionarNota(idNota)` | GET /api/notas/{id} y carga en editor |
| `guardarNota()` | POST (nueva) o PUT (existente) |
| `eliminarNota()` | DELETE /api/notas/{id} |
| `nuevaNota()` | Limpia el editor para crear |

**Atajos**: `Ctrl+S` guarda la nota actual.

### 3.5. Convenciones del Frontend

- **IIFE** en todos los scripts para evitar conflictos de redeclaración al navegar SPA
- **`'use strict'`** en todos los archivos
- `window.electronAPI` para comunicación con el proceso main
- Tailwind CSS cargado vía CDN
- `alertas(tipo, mensaje)` para notificaciones modales (info, warning, success, error)

---

## 4. Backend (Spring Boot)

### 4.1. Entry Point

`AulaPersonalApplication.java` — `@SpringBootApplication` estándar.

### 4.2. Configuración

**`application.properties`** (por defecto):
```properties
spring.datasource.url=jdbc:h2:file:${APP_DATA_DIR:./data}/aulapersonal;AUTO_SERVER=TRUE
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
```

- La variable `APP_DATA_DIR` la inyecta `main.js` con `app.getPath('userData')`
- Por defecto crea la BD en `./data/aulapersonal.mv.db`

**`application-mysql.properties`** (perfil opcional para desarrollo):
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/aulapersonal
# ... credenciales ...
```

### 4.3. CORS

`ConfiguracionCors.java` permite orígenes `file://` y `http://localhost` para que el frontend Electron (cargado con protocolo `file://`) pueda hacer peticiones al backend.

### 4.4. Módulo Notas

Arquitectura en 3 capas:

```
NotaController (@RestController)
    ↓ inyecta
NotaService (@Service)
    ↓ inyecta
NotaRepository (JpaRepository<Nota, Long>)
    ↓ mapea
Nota (@Entity → tabla `notas`)
```

#### Nota.java (Entidad)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `Long` | Auto-incremental (IDENTITY) |
| `titulo` | `String` | Obligatorio |
| `contenido` | `String` | TEXT, opcional |
| `creadoEn` | `LocalDateTime` | Se setea en `@PrePersist` |
| `actualizadoEn` | `LocalDateTime` | Se actualiza en `@PreUpdate` |

#### NotaController.java (API REST)

| Método | Endpoint | Body | Respuesta |
|--------|----------|------|-----------|
| `GET` | `/api/notas` | — | `200` + array |
| `GET` | `/api/notas/{id}` | — | `200` + objeto / `404` |
| `POST` | `/api/notas` | `{titulo, contenido}` | `201` + objeto |
| `PUT` | `/api/notas/{id}` | `{titulo, contenido}` | `200` / `404` |
| `DELETE` | `/api/notas/{id}` | — | `204` / `404` |

Reglas:
- `titulo` no vacío → `400 Bad Request` si está vacío
- Listado ordenado por `actualizadoEn` descendente

---

## 5. Flujo de Datos

### Inicio de la aplicación

```
1. Usuario ejecuta el instalador/binario
2. main.js: iniciarBackend()
   → spawn('java', ['-jar', 'backend.jar'])
   → esperarBackend(): polling GET /api/notas cada 1s (máx 30s)
3. main.js: crearVentana()
   → loadFile('electron/renderer/index.html')
4. index.js: cargarPagina(null, 'bienvenida')
   → fetch('welcome/welcome.html')
   → innerHTML + recreación de scripts
```

### Navegación SPA

```
1. Usuario hace clic en "Notes" del sidebar
2. index.js: cargarPagina(evento, 'notas')
3. fetch('notes/notes.html')
4. divApp.innerHTML = html
5. Recreación de scripts (querySelectorAll + replaceWith)
6. notes.js: IIFE → cargarNotas() → GET /api/notas
7. Renderizado de lista de notas
```

![Flujo navegación](docs/navegacion-spa.png)

### Bloqueo de apps

```
1. Usuario marca apps y hace clic en "Block Selected"
2. appBlocker.js: iniciarBloqueo()
3. window.electronAPI.bloquearApps(procesos, minutos)
4. main.js (IPC): setInterval(cada 2s) → matarProceso(nombre)
5. Windows: taskkill /F /IM firefox.exe /T
6. Linux:   pkill -f firefox
7. Al cumplirse el tiempo o hacer clic en "Unlock All":
   → clearInterval() → desbloquear-todo IPC
```

---

## 6. Persistencia

### Backend (H2 Database)

- Archivo: `{userData}/data/aulapersonal.mv.db`
- Engine: H2 en modo fichero (`AUTO_SERVER=TRUE` permite múltiples conexiones)
- ORM: JPA/Hibernate con `ddl-auto=update` (crea/actualiza tablas automáticamente)
- Alternativa: perfil `mysql` para desarrollo

### Frontend (localStorage / sessionStorage)

| Clave | Ámbito | Contenido |
|-------|--------|-----------|
| `apps-bloqueo` | localStorage | Array de apps registradas |
| `pomodoro-apps-seleccionadas` | localStorage | Apps marcadas para bloqueo desde Pomodoro |
| `pomodoro-config` | localStorage | Configuración (minutosSesion, numeroSesiones, minutosDescanso) |
| `pomodoro-timer` | localStorage | Estado del temporizador (sesión actual, tiempo restante, etc.) |
| `appblocker-bloqueo` | sessionStorage | Estado de bloqueo activo (apps bloqueadas + timestamp fin) |

---

## 7. Funcionalidades

### Estado actual

| Funcionalidad | Estado |
|---------------|--------|
| Welcome page | ✅ Completa |
| Notes (CRUD + backend) | ✅ Completa |
| App Blocker (bloqueo local) | ✅ Completa |
| Pomodoro (temporizador + persistencia + sonido) | ✅ Completa |
| AI Chat | 🚧 En construcción |
| Music | 📅 Planificado |

### Características transversales

- **Multiplataforma**: Windows y Linux soportados
- **JRE empaquetado**: No requiere Java instalado (55 MB con jlink)
- **Sin Node.js requerido**: El instalador incluye todo
- **CORS configurado**: Permite `file://` para Electron
- **IIFE scripts**: Navegación SPA segura sin conflictos de redeclaración

---

## 8. Construcción y Distribución

### Comandos

```bash
# Desarrollo (solo frontend, asume backend corriendo)
npm start

# Compilar backend (JAR + JRE mínimo)
npm run build:backend

# Compilar todo e instalar
npm run build

# Tests del backend
./gradlew test          # Linux/Mac
gradlew.bat test        # Windows
```

### Dependencias (package.json)

| Dependencia | Versión | Propósito |
|-------------|---------|-----------|
| electron | ^35.0.0 | Framework de escritorio |
| electron-builder | ^26.0.0 | Empaquetado y distribución |

### electron-builder config

- **Windows**: NSIS installer (`Aula Personal Setup 1.0.0.exe`)
- **Linux**: `dir` (carpeta portable) / AppImage (solo desde Linux)
- **Extra resources**: JRE (`jre/`) + JAR (`backend/`)
- **`npmRebuild: false`** para evitar necesidad de Visual Studio

### Build de Backend (build.gradle)

Tareas principales:
- `bootJar` — empaqueta la aplicación Spring Boot en JAR
- `createMinimalJre` — usa `jlink` para crear JRE mínimo (55 MB) con módulos necesarios (java.base, java.sql, java.management, etc.)

### Script build-backend.js

Ejecuta Gradle de forma cross-platform:
- Windows: `gradlew.bat bootJar createMinimalJre`
- Linux: `./gradlew bootJar createMinimalJre`
