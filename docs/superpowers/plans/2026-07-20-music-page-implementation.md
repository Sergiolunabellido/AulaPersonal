# Music Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Music page with radio catalog, local music playback, user playlists, and a persistent player bar.

**Architecture:** Backend entities in Spring Boot/H2 for radios, playlists, and scanned folders. Frontend communicates via REST API and Electron IPC for file system access. Audio playback via HTML5 `<audio>` element.

**Tech Stack:** Spring Boot 4.0.6/Java 17, JPA/H2, Electron, Vanilla JS (IIFE), Tailwind CSS CDN

## Global Constraints
- Follow existing patterns in `notas/` package (entity → repository → service → controller)
- All frontend scripts use IIFE + `'use strict'`
- Communication via `fetch()` to `localhost:8080`
- Radio catalog seeded via `data.sql`
- Local file metadata extracted via Electron IPC (no JS library)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main/java/org/example/aulapersonal/musica/Radio.java` | Entity — radio station |
| `src/main/java/org/example/aulapersonal/musica/RadioRepository.java` | JPA repo for radios |
| `src/main/java/org/example/aulapersonal/musica/Playlist.java` | Entity — user playlist |
| `src/main/java/org/example/aulapersonal/musica/PlaylistRepository.java` | JPA repo for playlists |
| `src/main/java/org/example/aulapersonal/musica/PlaylistCancion.java` | Entity — song in a playlist |
| `src/main/java/org/example/aulapersonal/musica/PlaylistCancionRepository.java` | JPA repo for playlist songs |
| `src/main/java/org/example/aulapersonal/musica/CarpetaEscaneada.java` | Entity — scanned folder path |
| `src/main/java/org/example/aulapersonal/musica/CarpetaEscaneadaRepository.java` | JPA repo for scanned folders |
| `src/main/java/org/example/aulapersonal/musica/MusicaService.java` | Business logic |
| `src/main/java/org/example/aulapersonal/musica/MusicaController.java` | REST endpoints |
| `src/main/resources/data.sql` | Seed radio catalog |
| `electron/renderer/music/music.html` | Music page layout |
| `electron/renderer/music/music.js` | All frontend logic |
| `electron/main.js` | Add IPC handler for folder scanning |
| `electron/preload.js` | Expose file scan IPC |
| `electron/renderer/index.js` | Route `musica` → `'music/music.html'` |
| `electron/renderer/index.html` | Activate sidebar link |
| `electron/renderer/welcome/welcome.html` | Enable music card |

---

### Task 1: Backend Entities — Radio, Playlist, CarpetaEscaneada

**Files:**
- Create: `src/main/java/org/example/aulapersonal/musica/Radio.java`
- Create: `src/main/java/org/example/aulapersonal/musica/RadioRepository.java`
- Create: `src/main/java/org/example/aulapersonal/musica/Playlist.java`
- Create: `src/main/java/org/example/aulapersonal/musica/PlaylistRepository.java`
- Create: `src/main/java/org/example/aulapersonal/musica/PlaylistCancion.java`
- Create: `src/main/java/org/example/aulapersonal/musica/PlaylistCancionRepository.java`
- Create: `src/main/java/org/example/aulapersonal/musica/CarpetaEscaneada.java`
- Create: `src/main/java/org/example/aulapersonal/musica/CarpetaEscaneadaRepository.java`

**Interfaces:**
- Consumes: nothing (standalone entities)
- Produces: JPA entities with getters/setters, repositories with standard methods

- [ ] **Step 1: Create Radio.java**

```java
package org.example.aulapersonal.musica;

import jakarta.persistence.*;

@Entity
@Table(name = "radios")
public class Radio {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    @Column(nullable = false)
    private String genero;

    @Column(nullable = false)
    private String urlStream;

    private String imagenUrl;

    @Column(nullable = false)
    private boolean favorita = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getGenero() { return genero; }
    public void setGenero(String genero) { this.genero = genero; }
    public String getUrlStream() { return urlStream; }
    public void setUrlStream(String urlStream) { this.urlStream = urlStream; }
    public String getImagenUrl() { return imagenUrl; }
    public void setImagenUrl(String imagenUrl) { this.imagenUrl = imagenUrl; }
    public boolean isFavorita() { return favorita; }
    public void setFavorita(boolean favorita) { this.favorita = favorita; }
}
```

- [ ] **Step 2: Create RadioRepository.java**

```java
package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RadioRepository extends JpaRepository<Radio, Long> {
    List<Radio> findByGenero(String genero);
    List<Radio> findByFavoritaTrue();
}
```

- [ ] **Step 3: Create Playlist.java**

```java
package org.example.aulapersonal.musica;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "playlists")
public class Playlist {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    private String descripcion;

    @Column(nullable = false, updatable = false)
    private LocalDateTime creadoEn;

    @PrePersist
    protected void onCreate() {
        creadoEn = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
}
```

- [ ] **Step 4: Create PlaylistRepository.java**

```java
package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    @Query("SELECT p FROM Playlist p ORDER BY p.creadoEn DESC")
    List<Playlist> findAllByOrderByCreadoEnDesc();
}
```

- [ ] **Step 5: Create PlaylistCancion.java**

```java
package org.example.aulapersonal.musica;

import jakarta.persistence.*;

@Entity
@Table(name = "playlist_canciones")
public class PlaylistCancion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long playlistId;

    @Column(nullable = false)
    private String rutaArchivo;

    private String titulo;
    private String artista;
    private String album;
    private Integer duracion;

    @Column(nullable = false)
    private Integer orden;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPlaylistId() { return playlistId; }
    public void setPlaylistId(Long playlistId) { this.playlistId = playlistId; }
    public String getRutaArchivo() { return rutaArchivo; }
    public void setRutaArchivo(String rutaArchivo) { this.rutaArchivo = rutaArchivo; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getArtista() { return artista; }
    public void setArtista(String artista) { this.artista = artista; }
    public String getAlbum() { return album; }
    public void setAlbum(String album) { this.album = album; }
    public Integer getDuracion() { return duracion; }
    public void setDuracion(Integer duracion) { this.duracion = duracion; }
    public Integer getOrden() { return orden; }
    public void setOrden(Integer orden) { this.orden = orden; }
}
```

- [ ] **Step 6: Create PlaylistCancionRepository.java**

```java
package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlaylistCancionRepository extends JpaRepository<PlaylistCancion, Long> {
    List<PlaylistCancion> findByPlaylistIdOrderByOrdenAsc(Long playlistId);
    void deleteByPlaylistId(Long playlistId);
}
```

- [ ] **Step 7: Create CarpetaEscaneada.java**

```java
package org.example.aulapersonal.musica;

import jakarta.persistence.*;

@Entity
@Table(name = "carpetas_escaneadas")
public class CarpetaEscaneada {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String ruta;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRuta() { return ruta; }
    public void setRuta(String ruta) { this.ruta = ruta; }
}
```

- [ ] **Step 8: Create CarpetaEscaneadaRepository.java**

```java
package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CarpetaEscaneadaRepository extends JpaRepository<CarpetaEscaneada, Long> {
}
```

- [ ] **Step 9: Run Gradle build to verify compilation**

Run: `.\gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 10: Commit**

```bash
git add src/main/java/org/example/aulapersonal/musica/
git commit -m "feat(music): add backend entities and repositories"
```

---

### Task 2: MusicaService — Business Logic

**Files:**
- Create: `src/main/java/org/example/aulapersonal/musica/MusicaService.java`

**Interfaces:**
- Consumes: `RadioRepository`, `PlaylistRepository`, `PlaylistCancionRepository`, `CarpetaEscaneadaRepository`
- Produces: CRUD methods for radios, playlists, songs, folders

- [ ] **Step 1: Create MusicaService.java**

```java
package org.example.aulapersonal.musica;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class MusicaService {

    private final RadioRepository radioRepository;
    private final PlaylistRepository playlistRepository;
    private final PlaylistCancionRepository playlistCancionRepository;
    private final CarpetaEscaneadaRepository carpetaEscaneadaRepository;

    public MusicaService(RadioRepository radioRepository,
                         PlaylistRepository playlistRepository,
                         PlaylistCancionRepository playlistCancionRepository,
                         CarpetaEscaneadaRepository carpetaEscaneadaRepository) {
        this.radioRepository = radioRepository;
        this.playlistRepository = playlistRepository;
        this.playlistCancionRepository = playlistCancionRepository;
        this.carpetaEscaneadaRepository = carpetaEscaneadaRepository;
    }

    // Radios
    public List<Radio> listarRadios() {
        return radioRepository.findAll();
    }

    public List<Radio> listarRadiosPorGenero(String genero) {
        return radioRepository.findByGenero(genero);
    }

    public List<Radio> listarRadiosFavoritas() {
        return radioRepository.findByFavoritaTrue();
    }

    public Optional<Radio> toggleFavorito(Long id) {
        return radioRepository.findById(id).map(radio -> {
            radio.setFavorita(!radio.isFavorita());
            return radioRepository.save(radio);
        });
    }

    // Playlists
    public List<Playlist> listarPlaylists() {
        return playlistRepository.findAllByOrderByCreadoEnDesc();
    }

    public Playlist crearPlaylist(String nombre, String descripcion) {
        Playlist playlist = new Playlist();
        playlist.setNombre(nombre);
        playlist.setDescripcion(descripcion);
        return playlistRepository.save(playlist);
    }

    public boolean eliminarPlaylist(Long id) {
        if (playlistRepository.existsById(id)) {
            playlistCancionRepository.deleteByPlaylistId(id);
            playlistRepository.deleteById(id);
            return true;
        }
        return false;
    }

    // Playlist songs
    public List<PlaylistCancion> listarCanciones(Long playlistId) {
        return playlistCancionRepository.findByPlaylistIdOrderByOrdenAsc(playlistId);
    }

    public PlaylistCancion agregarCancion(Long playlistId, String rutaArchivo, String titulo,
                                           String artista, String album, Integer duracion) {
        List<PlaylistCancion> existentes = playlistCancionRepository.findByPlaylistIdOrderByOrdenAsc(playlistId);
        int nuevoOrden = existentes.size() + 1;

        PlaylistCancion cancion = new PlaylistCancion();
        cancion.setPlaylistId(playlistId);
        cancion.setRutaArchivo(rutaArchivo);
        cancion.setTitulo(titulo);
        cancion.setArtista(artista);
        cancion.setAlbum(album);
        cancion.setDuracion(duracion);
        cancion.setOrden(nuevoOrden);
        return playlistCancionRepository.save(cancion);
    }

    public boolean eliminarCancion(Long id) {
        if (playlistCancionRepository.existsById(id)) {
            playlistCancionRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public boolean reordenarCanciones(Long playlistId, List<Long> idsOrdenadas) {
        List<PlaylistCancion> canciones = playlistCancionRepository.findByPlaylistIdOrderByOrdenAsc(playlistId);
        for (int i = 0; i < idsOrdenadas.size(); i++) {
            final int orden = i + 1;
            canciones.stream()
                    .filter(c -> c.getId().equals(idsOrdenadas.get(i)))
                    .findFirst()
                    .ifPresent(c -> c.setOrden(orden));
        }
        playlistCancionRepository.saveAll(canciones);
        return true;
    }

    // Scanned folders
    public List<CarpetaEscaneada> listarCarpetas() {
        return carpetaEscaneadaRepository.findAll();
    }

    public CarpetaEscaneada agregarCarpeta(String ruta) {
        CarpetaEscaneada carpeta = new CarpetaEscaneada();
        carpeta.setRuta(ruta);
        return carpetaEscaneadaRepository.save(carpeta);
    }

    public boolean eliminarCarpeta(Long id) {
        if (carpetaEscaneadaRepository.existsById(id)) {
            carpetaEscaneadaRepository.deleteById(id);
            return true;
        }
        return false;
    }
}
```

- [ ] **Step 2: Run Gradle build to verify compilation**

Run: `.\gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/main/java/org/example/aulapersonal/musica/MusicaService.java
git commit -m "feat(music): add MusicaService business logic"
```

---

### Task 3: MusicaController + Seed Data

**Files:**
- Create: `src/main/java/org/example/aulapersonal/musica/MusicaController.java`
- Create: `src/main/resources/data.sql`

**Interfaces:**
- Consumes: `MusicaService`
- Produces: REST endpoints at `/api/musica/...`, seeded radio data

- [ ] **Step 1: Create MusicaController.java**

```java
package org.example.aulapersonal.musica;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/musica")
public class MusicaController {

    private final MusicaService service;

    public MusicaController(MusicaService service) {
        this.service = service;
    }

    // Radios
    @GetMapping("/radios")
    public List<Radio> listarRadios() {
        return service.listarRadios();
    }

    @GetMapping("/radios/genero/{genero}")
    public List<Radio> listarPorGenero(@PathVariable String genero) {
        return service.listarRadiosPorGenero(genero);
    }

    @GetMapping("/radios/favoritas")
    public List<Radio> listarFavoritas() {
        return service.listarRadiosFavoritas();
    }

    @PostMapping("/radios/{id}/favorito")
    public ResponseEntity<Radio> toggleFavorito(@PathVariable Long id) {
        return service.toggleFavorito(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Playlists
    @GetMapping("/playlists")
    public List<Playlist> listarPlaylists() {
        return service.listarPlaylists();
    }

    @PostMapping("/playlists")
    public ResponseEntity<Playlist> crearPlaylist(@RequestBody Map<String, String> body) {
        String nombre = body.getOrDefault("nombre", "").trim();
        String descripcion = body.getOrDefault("descripcion", "").trim();
        if (nombre.isEmpty()) return ResponseEntity.badRequest().build();
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crearPlaylist(nombre, descripcion));
    }

    @DeleteMapping("/playlists/{id}")
    public ResponseEntity<Void> eliminarPlaylist(@PathVariable Long id) {
        return service.eliminarPlaylist(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    // Playlist songs
    @GetMapping("/playlists/{id}/canciones")
    public ResponseEntity<List<PlaylistCancion>> listarCanciones(@PathVariable Long id) {
        return ResponseEntity.ok(service.listarCanciones(id));
    }

    @PostMapping("/playlists/{id}/canciones")
    public ResponseEntity<PlaylistCancion> agregarCancion(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        String rutaArchivo = (String) body.getOrDefault("rutaArchivo", "");
        String titulo = (String) body.getOrDefault("titulo", "");
        String artista = (String) body.getOrDefault("artista", "");
        String album = (String) body.getOrDefault("album", "");
        Integer duracion = (Integer) body.getOrDefault("duracion", 0);
        if (rutaArchivo.isEmpty()) return ResponseEntity.badRequest().build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.agregarCancion(id, rutaArchivo, titulo, artista, album, duracion));
    }

    @DeleteMapping("/playlists/{playlistId}/canciones/{cancionId}")
    public ResponseEntity<Void> eliminarCancion(@PathVariable Long cancionId) {
        return service.eliminarCancion(cancionId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @PutMapping("/playlists/{id}/canciones/reordenar")
    public ResponseEntity<Void> reordenarCanciones(
            @PathVariable Long id,
            @RequestBody Map<String, List<Long>> body) {
        List<Long> idsOrdenadas = body.get("ids");
        if (idsOrdenadas == null) return ResponseEntity.badRequest().build();
        service.reordenarCanciones(id, idsOrdenadas);
        return ResponseEntity.ok().build();
    }

    // Scanned folders
    @GetMapping("/carpetas")
    public List<CarpetaEscaneada> listarCarpetas() {
        return service.listarCarpetas();
    }

    @PostMapping("/carpetas")
    public ResponseEntity<CarpetaEscaneada> agregarCarpeta(@RequestBody Map<String, String> body) {
        String ruta = body.getOrDefault("ruta", "").trim();
        if (ruta.isEmpty()) return ResponseEntity.badRequest().build();
        return ResponseEntity.status(HttpStatus.CREATED).body(service.agregarCarpeta(ruta));
    }

    @DeleteMapping("/carpetas/{id}")
    public ResponseEntity<Void> eliminarCarpeta(@PathVariable Long id) {
        return service.eliminarCarpeta(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
```

- [ ] **Step 2: Create data.sql** with radio catalog seed (in `src/main/resources/data.sql`)

```sql
-- Radio catalog
INSERT INTO radios (nombre, genero, url_stream, imagen_url, favorita) VALUES
('Absolute Rock', 'Rock', 'https://stream.absoluterock.com/stream', NULL, false),
('Rock FM', 'Rock', 'https://rockfm.stream/rock', NULL, false),
('Kerrang Radio', 'Rock', 'https://kerrang.stream/radio', NULL, false),
('Triple M', 'Rock', 'https://triplem.stream/rock', NULL, false),
('Lofi Girl', 'Lo-Fi', 'https://lofi.stream/girl', NULL, false),
('Chillhop', 'Lo-Fi', 'https://chillhop.stream/radio', NULL, false),
('ChilledCow', 'Lo-Fi', 'https://chilledcow.stream/lofi', NULL, false),
('Radio Lofi', 'Lo-Fi', 'https://radiolofi.stream/stream', NULL, false),
('Hits Radio', 'Pop', 'https://hitsradio.stream/pop', NULL, false),
('Capital FM', 'Pop', 'https://capitalfm.stream/radio', NULL, false),
('Los 40', 'Pop', 'https://los40.stream/radio', NULL, false),
('NRJ', 'Pop', 'https://nrj.stream/pop', NULL, false),
('Jazz FM', 'Jazz', 'https://jazzfm.stream/radio', NULL, false),
('Jazz24', 'Jazz', 'https://jazz24.stream/stream', NULL, false),
('SomaFM Groove Salad', 'Jazz', 'https://somafm.stream/groovesalad', NULL, false),
('DI.FM', 'Electronic', 'https://difm.stream/electronic', NULL, false),
('SomaFM Digital', 'Electronic', 'https://somafm.stream/digital', NULL, false),
('Digitally Imported', 'Electronic', 'https://di.stream/radio', NULL, false),
('Urbana', 'Latino', 'https://urbana.stream/radio', NULL, false),
('Exa FM', 'Latino', 'https://exafm.stream/radio', NULL, false),
('Zona Latina', 'Latino', 'https://zonalatina.stream/radio', NULL, false),
('Mega FM', 'Latino', 'https://megafm.stream/radio', NULL, false),
('Calm Radio Classical', 'Classical', 'https://calmradio.stream/classical', NULL, false),
('WQXR', 'Classical', 'https://wqxr.stream/classical', NULL, false),
('Classic FM', 'Classical', 'https://classicfm.stream/radio', NULL, false);
```

- [ ] **Step 3: Run Gradle build to verify compilation**

Run: `.\gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add src/main/java/org/example/aulapersonal/musica/MusicaController.java src/main/resources/data.sql
git commit -m "feat(music): add MusicaController REST endpoints and radio seed data"
```

---

### Task 4: Electron IPC — Folder Scanning + Custom Protocol

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.js`

**Interfaces:**
- Consumes: Electron `dialog`, `fs`, `path`, `protocol`
- Produces: `window.electronAPI.escogerCarpeta()`, `window.electronAPI.escanearCarpeta(ruta)`, custom `local-audio://` protocol

- [ ] **Step 1: Add `protocol` to the require at the top of `electron/main.js`**

Change line 1 from:
```javascript
const {app, BrowserWindow, ipcMain, safeStorage} = require('electron');
```
To:
```javascript
const {app, BrowserWindow, ipcMain, safeStorage, protocol, net} = require('electron');
```

- [ ] **Step 2: Register custom protocol `local-audio` in `electron/main.js`**

Add after the `app.whenReady().then(...)` block, before the `app.on('will-quit'...` block:

```javascript
app.on('ready', () => {
  protocol.handle('local-audio', (request) => {
    const filePath = decodeURIComponent(request.url.slice('local-audio://'.length));
    return net.fetch('file:///' + filePath);
  });
});
```

- [ ] **Step 3: Add folder scanning IPC handlers to `electron/main.js`**

Add after the existing IPC handlers (after line 170):

```javascript
const fs = require('fs');
const { dialog } = require('electron');

ipcMain.handle('escoger-carpeta', async () => {
  const result = await dialog.showOpenDialog(ventanaPrincipal, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('escanear-carpeta', async (_event, ruta) => {
  const archivosMusica = [];
  const extensiones = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);

  function escanear(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rutaCompleta = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          escanear(rutaCompleta);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensiones.has(ext)) {
            archivosMusica.push({
              ruta: rutaCompleta,
              nombre: entry.name,
              titulo: path.basename(entry.name, ext),
              artista: '',
              album: '',
            });
          }
        }
      }
    } catch (_) {}
  }

  escanear(ruta);
  return archivosMusica;
});
```

- [ ] **Step 2: Expose new IPC methods in `electron/preload.js`**

Add inside the `contextBridge.exposeInMainWorld('electronAPI', {...})` object:

```javascript
    escogerCarpeta: () => ipcRenderer.invoke('escoger-carpeta'),
    escanearCarpeta: (ruta) => ipcRenderer.invoke('escanear-carpeta', ruta),
```

- [ ] **Step 3: Verify changes**

Run: `node -e "require('./electron/main.js')"` (verify no syntax errors)
Expected: No output (no errors)

- [ ] **Step 4: Commit**

```bash
git add electron/main.js electron/preload.js
git commit -m "feat(music): add IPC handlers for folder selection and file scanning"
```

---

### Task 5: Frontend HTML — Music Page Layout

**Files:**
- Create: `electron/renderer/music/music.html`

- [ ] **Step 1: Create music.html** with three-zone layout (sidebar, content, player bar)

```html
<div id="music-app" class="flex flex-col h-[calc(100vh-2rem)]">
  <!-- Main area: sidebar + content -->
  <div class="flex flex-1 overflow-hidden">
    <!-- Left sidebar -->
    <div class="w-56 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
      <div class="p-3 border-b border-gray-200">
        <h2 class="text-lg font-bold text-gray-800">Music</h2>
      </div>
      <nav class="flex-1 p-2 space-y-1">
        <button id="tab-radios" class="tab-btn w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-purple-100 text-purple-700" onclick="window.cambiarTab('radios')">
          📻 Radios
        </button>
        <button id="tab-playlists" class="tab-btn w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100" onclick="window.cambiarTab('playlists')">
          💿 Mis Listas
        </button>
        <button id="tab-local" class="tab-btn w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100" onclick="window.cambiarTab('local')">
          📁 Archivo Local
        </button>
      </nav>
    </div>

    <!-- Content area -->
    <div class="flex-1 flex flex-col overflow-hidden bg-white">
      <!-- Radios tab -->
      <div id="content-radios" class="tab-content flex-1 overflow-y-auto p-4">
        <div class="flex gap-2 mb-4 flex-wrap">
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-purple-600 text-white" data-genero="all" onclick="window.filtrarRadios('all', this)">Todos</button>
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" data-genero="Rock" onclick="window.filtrarRadios('Rock', this)">🎸 Rock</button>
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" data-genero="Lo-Fi" onclick="window.filtrarRadios('Lo-Fi', this)">🎹 Lo-Fi</button>
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" data-genero="Pop" onclick="window.filtrarRadios('Pop', this)">🕺 Pop</button>
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" data-genero="Jazz" onclick="window.filtrarRadios('Jazz', this)">🎷 Jazz</button>
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" data-genero="Electronic" onclick="window.filtrarRadios('Electronic', this)">⚡ Electrónica</button>
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" data-genero="Latino" onclick="window.filtrarRadios('Latino', this)">🎤 Latino</button>
          <button class="genero-btn px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" data-genero="Classical" onclick="window.filtrarRadios('Classical', this)">🎵 Clásica</button>
        </div>
        <div id="radio-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"></div>
      </div>

      <!-- Playlists tab -->
      <div id="content-playlists" class="tab-content hidden flex-1 overflow-y-auto p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-800">Mis Listas</h3>
          <button onclick="window.crearPlaylist()" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">+ Nueva Lista</button>
        </div>
        <div id="playlists-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"></div>
      </div>

      <!-- Local music tab -->
      <div id="content-local" class="tab-content hidden flex-1 overflow-y-auto p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-800">Archivo Local</h3>
          <button onclick="window.seleccionarCarpeta()" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">+ Añadir carpeta</button>
        </div>
        <div id="carpetas-lista" class="space-y-2 mb-4"></div>
        <div id="local-songs" class="space-y-1"></div>
      </div>
    </div>
  </div>

  <!-- Player bar (fixed bottom) -->
  <div id="player-bar" class="bg-gray-900 text-white px-4 py-3 flex items-center gap-4 shrink-0">
    <div class="flex items-center gap-3 min-w-[180px]">
      <div id="player-now-icon" class="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-lg shrink-0">🎵</div>
      <div class="min-w-0">
        <div id="player-title" class="text-sm font-medium truncate">Sin reproducción</div>
        <div id="player-artist" class="text-xs text-gray-400 truncate">Selecciona una radio o canción</div>
      </div>
    </div>
    <div class="flex items-center gap-3 ml-auto">
      <button id="btn-shuffle" class="text-gray-400 hover:text-white transition-colors text-lg" onclick="window.toggleShuffle()">🔀</button>
      <button id="btn-prev" class="text-gray-400 hover:text-white transition-colors text-lg" onclick="window.anteriorCancion()">⏮️</button>
      <button id="btn-play" class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-500 transition-colors text-lg" onclick="window.togglePlay()">▶️</button>
      <button id="btn-next" class="text-gray-400 hover:text-white transition-colors text-lg" onclick="window.siguienteCancion()">⏭️</button>
      <button id="btn-repeat" class="text-gray-400 hover:text-white transition-colors text-lg" onclick="window.toggleRepeat()">🔁</button>
    </div>
    <div class="flex items-center gap-2 ml-4 min-w-[200px]">
      <span id="player-current-time" class="text-xs text-gray-400 tabular-nums">0:00</span>
      <input id="player-progress" type="range" min="0" max="100" value="0" class="w-full h-1 accent-purple-500 cursor-pointer" oninput="window.buscarEnCancion(this.value)">
      <span id="player-duration" class="text-xs text-gray-400 tabular-nums">0:00</span>
    </div>
    <div class="flex items-center gap-2 ml-2">
      <button id="btn-mute" class="text-gray-400 hover:text-white transition-colors text-sm" onclick="window.toggleMute()">🔊</button>
      <input id="player-volume" type="range" min="0" max="1" step="0.05" value="0.8" class="w-20 h-1 accent-purple-500 cursor-pointer" oninput="window.ajustarVolumen(this.value)">
    </div>
  </div>
</div>

<script src="./music/music.js"></script>
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/music/music.html
git commit -m "feat(music): add music page HTML layout"
```

---

### Task 6: Frontend JS — Complete Music Logic

**Files:**
- Create: `electron/renderer/music/music.js`

- [ ] **Step 1: Create music.js** with all frontend logic

```javascript
(function () {
    'use strict';

    const API_BASE = 'http://localhost:8080/api/musica';

    // Player state
    const player = {
        audio: new Audio(),
        isPlaying: false,
        isMuted: false,
        shuffle: false,
        repeat: 'off', // 'off', 'one', 'all'
        currentSource: null, // { type: 'radio'|'local'|'playlist', data: ... }
        queue: [],
        queueIndex: -1,
        volume: 0.8,
    };

    let currentTab = 'radios';
    let todasLasRadios = [];

    // ===================== DOM refs =====================
    function $(id) { return document.getElementById(id); }

    // ===================== Audio player controls =====================
    window.togglePlay = function () {
        if (!player.currentSource) return;
        if (player.isPlaying) {
            player.audio.pause();
            player.isPlaying = false;
            $('btn-play').textContent = '▶️';
        } else {
            player.audio.play().catch(() => {});
            player.isPlaying = true;
            $('btn-play').textContent = '⏸️';
        }
    };

    window.toggleMute = function () {
        player.isMuted = !player.isMuted;
        player.audio.muted = player.isMuted;
        $('btn-mute').textContent = player.isMuted ? '🔇' : (player.volume > 0 ? '🔊' : '🔈');
    };

    window.ajustarVolumen = function (val) {
        player.volume = parseFloat(val);
        player.audio.volume = player.volume;
        $('btn-mute').textContent = player.volume > 0 ? '🔊' : '🔈';
        if (player.isMuted && player.volume > 0) {
            player.isMuted = false;
            player.audio.muted = false;
        }
    };

    window.buscarEnCancion = function (val) {
        if (!player.audio.duration) return;
        player.audio.currentTime = (val / 100) * player.audio.duration;
    };

    window.toggleShuffle = function () {
        player.shuffle = !player.shuffle;
        $('btn-shuffle').style.opacity = player.shuffle ? '1' : '0.4';
    };

    window.toggleRepeat = function () {
        const modes = ['off', 'one', 'all'];
        const idx = modes.indexOf(player.repeat);
        player.repeat = modes[(idx + 1) % modes.length];
        $('btn-repeat').style.opacity = player.repeat === 'off' ? '0.4' : '1';
        $('btn-repeat').textContent = player.repeat === 'one' ? '🔂' : '🔁';
    };

    window.anteriorCancion = function () {
        if (player.queue.length === 0) return;
        if (player.audio.currentTime > 3) {
            player.audio.currentTime = 0;
            return;
        }
        player.queueIndex = (player.queueIndex - 1 + player.queue.length) % player.queue.length;
        reproducirColaActual();
    };

    window.siguienteCancion = function () {
        if (player.queue.length === 0) return;
        if (player.repeat === 'one') {
            player.audio.currentTime = 0;
            player.audio.play().catch(() => {});
            return;
        }
        player.queueIndex = (player.queueIndex + 1) % player.queue.length;
        if (player.queueIndex === 0 && player.repeat !== 'all') {
            player.isPlaying = false;
            $('btn-play').textContent = '▶️';
            return;
        }
        reproducirColaActual();
    };

    function reproducirColaActual() {
        const item = player.queue[player.queueIndex];
        if (!item) return;
        reproducir(item);
    }

    // ===================== Play a source =====================
    function reproducir(source) {
        player.currentSource = source;

        if (source.type === 'radio') {
            player.audio.src = source.urlStream;
        } else if (source.type === 'local' || source.type === 'playlist') {
            player.audio.src = 'local-audio://' + source.ruta.replace(/\\/g, '/');
        }

        player.audio.volume = player.volume;
        player.audio.play().then(() => {
            player.isPlaying = true;
            $('btn-play').textContent = '⏸️';
            actualizarNowPlaying(source);
        }).catch((err) => {
            alertas('error', 'No se puede reproducir: ' + (source.titulo || source.nombre));
            player.isPlaying = false;
            $('btn-play').textContent = '▶️';
        });
    }

    function actualizarNowPlaying(source) {
        $('player-title').textContent = source.titulo || source.nombre || 'Sin título';
        $('player-artist').textContent = source.artista || source.genero || '';
        $('player-now-icon').textContent = source.type === 'radio' ? '📻' : '🎵';
    }

    // Audio event listeners
    player.audio.addEventListener('timeupdate', function () {
        if (!player.audio.duration) return;
        const pct = (player.audio.currentTime / player.audio.duration) * 100;
        $('player-progress').value = pct;
        $('player-current-time').textContent = formatearTiempo(player.audio.currentTime);
        $('player-duration').textContent = formatearTiempo(player.audio.duration);
    });

    player.audio.addEventListener('ended', function () {
        window.siguienteCancion();
    });

    player.audio.addEventListener('error', function () {
        player.isPlaying = false;
        $('btn-play').textContent = '▶️';
    });

    function formatearTiempo(seg) {
        if (!seg || isNaN(seg)) return '0:00';
        const m = Math.floor(seg / 60);
        const s = Math.floor(seg % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    // ===================== Tab switching =====================
    window.cambiarTab = function (tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => {
            el.classList.remove('bg-purple-100', 'text-purple-700');
            el.classList.add('text-gray-600', 'hover:bg-gray-100');
        });
        $('content-' + tab).classList.remove('hidden');
        const tabBtn = $('tab-' + tab);
        tabBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
        tabBtn.classList.add('bg-purple-100', 'text-purple-700');

        if (tab === 'radios') cargarRadios();
        else if (tab === 'playlists') cargarPlaylists();
        else if (tab === 'local') cargarLocal();
    };

    // ===================== Radios =====================
    async function cargarRadios() {
        try {
            const res = await fetch(API_BASE + '/radios');
            todasLasRadios = await res.json();
            renderizarRadios(todasLasRadios);
        } catch (e) {
            $('radio-grid').innerHTML = '<p class="text-gray-400">Error al cargar radios</p>';
        }
    }

    window.filtrarRadios = function (genero, btn) {
        document.querySelectorAll('.genero-btn').forEach(b => {
            b.classList.remove('bg-purple-600', 'text-white');
            b.classList.add('bg-gray-100', 'text-gray-600');
        });
        btn.classList.remove('bg-gray-100', 'text-gray-600');
        btn.classList.add('bg-purple-600', 'text-white');

        if (genero === 'all') renderizarRadios(todasLasRadios);
        else renderizarRadios(todasLasRadios.filter(r => r.genero === genero));
    };

    function renderizarRadios(radios) {
        const grid = $('radio-grid');
        grid.innerHTML = radios.map(r => `
            <div class="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow ${r.favorita ? 'ring-2 ring-purple-300' : ''}">
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <div class="text-sm font-semibold text-gray-800">${r.nombre}</div>
                        <div class="text-xs text-gray-400">${r.genero}</div>
                    </div>
                    <button onclick="window.toggleRadioFav(${r.id}, this)" class="text-lg ${r.favorita ? 'text-purple-500' : 'text-gray-300 hover:text-purple-400'} transition-colors">♥</button>
                </div>
                <button onclick="window.reproducirRadio(${r.id})" class="w-full mt-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-1">
                    ▶ Reproducir
                </button>
            </div>
        `).join('');
    }

    window.reproducirRadio = function (id) {
        const radio = todasLasRadios.find(r => r.id === id);
        if (!radio) return;
        player.queue = [];
        player.queueIndex = -1;
        reproducir({
            type: 'radio',
            id: radio.id,
            nombre: radio.nombre,
            titulo: radio.nombre,
            artista: radio.genero,
            genero: radio.genero,
            urlStream: radio.urlStream,
        });
    };

    window.toggleRadioFav = async function (id, btn) {
        try {
            const res = await fetch(API_BASE + '/radios/' + id + '/favorito', { method: 'POST' });
            const radio = await res.json();
            btn.textContent = radio.favorita ? '♥' : '♡';
            btn.classList.toggle('text-purple-500', radio.favorita);
            btn.classList.toggle('text-gray-300', !radio.favorita);
            btn.parentElement.parentElement.classList.toggle('ring-2', radio.favorita);
            btn.parentElement.parentElement.classList.toggle('ring-purple-300', radio.favorita);
        } catch (e) {
            alertas('error', 'Error al cambiar favorito');
        }
    };

    // ===================== Playlists =====================
    async function cargarPlaylists() {
        try {
            const res = await fetch(API_BASE + '/playlists');
            const playlists = await res.json();
            const grid = $('playlists-grid');
            if (playlists.length === 0) {
                grid.innerHTML = '<p class="text-gray-400 col-span-full text-center mt-8">No tienes listas aún. Crea una para empezar.</p>';
                return;
            }
            grid.innerHTML = playlists.map(p => `
                <div class="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                    <div class="text-sm font-semibold text-gray-800 mb-1">${p.nombre}</div>
                    <div class="text-xs text-gray-400 mb-3">${p.descripcion || 'Sin descripción'}</div>
                    <div class="flex gap-2">
                        <button onclick="window.reproducirPlaylist(${p.id})" class="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">▶ Reproducir</button>
                        <button onclick="window.eliminarPlaylist(${p.id})" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">✕</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('playlists-grid').innerHTML = '<p class="text-gray-400">Error al cargar listas</p>';
        }
    }

    window.crearPlaylist = async function () {
        const nombre = prompt('Nombre de la lista:');
        if (!nombre || !nombre.trim()) return;
        try {
            await fetch(API_BASE + '/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombre.trim(), descripcion: '' }),
            });
            cargarPlaylists();
        } catch (e) {
            alertas('error', 'Error al crear lista');
        }
    };

    window.eliminarPlaylist = async function (id) {
        const ok = await confirmarModal('¿Eliminar esta lista?', { confirmar: 'Eliminar' });
        if (!ok) return;
        try {
            await fetch(API_BASE + '/playlists/' + id, { method: 'DELETE' });
            cargarPlaylists();
        } catch (e) {
            alertas('error', 'Error al eliminar lista');
        }
    };

    window.reproducirPlaylist = async function (id) {
        try {
            const res = await fetch(API_BASE + '/playlists/' + id + '/canciones');
            const canciones = await res.json();
            if (canciones.length === 0) {
                alertas('info', 'Esta lista está vacía');
                return;
            }
            player.queue = canciones.map(c => ({
                type: 'playlist',
                ruta: c.rutaArchivo,
                titulo: c.titulo || 'Sin título',
                artista: c.artista || '',
                album: c.album || '',
                duracion: c.duracion || 0,
                id: c.id,
                playlistId: c.playlistId,
            }));
            player.queueIndex = 0;
            reproducirColaActual();
            cambiarTab('playlists');
        } catch (e) {
            alertas('error', 'Error al cargar canciones');
        }
    };

    // ===================== Local Music =====================
    async function cargarLocal() {
        try {
            const res = await fetch(API_BASE + '/carpetas');
            const carpetas = await res.json();
            const lista = $('carpetas-lista');
            if (carpetas.length === 0) {
                lista.innerHTML = '<p class="text-sm text-gray-400">No hay carpetas añadidas. Haz clic en "Añadir carpeta" para escanear tu música.</p>';
                $('local-songs').innerHTML = '';
                return;
            }
            lista.innerHTML = carpetas.map(c => `
                <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span class="text-sm text-gray-700 truncate">📁 ${c.ruta}</span>
                    <button onclick="window.eliminarCarpeta(${c.id})" class="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
            `).join('');

            // Scan all folders and show songs
            let todasLasCanciones = [];
            for (const c of carpetas) {
                const canciones = await window.electronAPI.escanearCarpeta(c.ruta);
                todasLasCanciones = todasLasCanciones.concat(canciones);
            }
            renderizarCancionesLocales(todasLasCanciones);
        } catch (e) {
            $('carpetas-lista').innerHTML = '<p class="text-sm text-gray-400">Error al cargar carpetas</p>';
        }
    }

    function renderizarCancionesLocales(canciones) {
        const container = $('local-songs');
        if (canciones.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-400 mt-4">No se encontraron archivos de música en las carpetas seleccionadas.</p>';
            return;
        }
        container.innerHTML = canciones.map((c, i) => `
            <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group" onclick="window.reproducirLocal(${i})" data-index="${i}">
                <span class="text-gray-400 text-sm">${i + 1}</span>
                <div class="flex-1 min-w-0">
                    <div class="text-sm text-gray-800 truncate">${c.titulo}</div>
                    <div class="text-xs text-gray-400 truncate">${c.artista || 'Artista desconocido'}</div>
                </div>
                <span class="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
            </div>
        `).join('');

        // Store songs for playback
        window.__cancionesLocales = canciones;
    }

    window.reproducirLocal = function (index) {
        const canciones = window.__cancionesLocales || [];
        const c = canciones[index];
        if (!c) return;

        player.queue = canciones.map((song, i) => ({
            type: 'local',
            ruta: song.ruta,
            titulo: song.titulo || song.nombre,
            artista: song.artista || '',
            nombre: song.nombre,
        }));
        player.queueIndex = index;
        reproducirColaActual();
    };

    window.seleccionarCarpeta = async function () {
        const ruta = await window.electronAPI.escogerCarpeta();
        if (!ruta) return;
        try {
            await fetch(API_BASE + '/carpetas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruta }),
            });
            cargarLocal();
        } catch (e) {
            alertas('error', 'Error al guardar la carpeta');
        }
    };

    window.eliminarCarpeta = async function (id) {
        try {
            await fetch(API_BASE + '/carpetas/' + id, { method: 'DELETE' });
            cargarLocal();
        } catch (e) {
            alertas('error', 'Error al eliminar carpeta');
        }
    };

    // ===================== Init =====================
    function inicializar() {
        // Set initial volume
        player.audio.volume = player.volume;
        $('player-volume').value = player.volume;

        // Load default tab
        cargarRadios();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/music/music.js
git commit -m "feat(music): add frontend music player logic"
```

---

### Task 7: Update Routes, Sidebar, and Welcome Page

**Files:**
- Modify: `electron/renderer/index.js`
- Modify: `electron/renderer/index.html`
- Modify: `electron/renderer/welcome/welcome.html`

- [ ] **Step 1: Update route in `electron/renderer/index.js`**

Change line 10 from `musica: '',` to:

```javascript
        musica: 'music/music.html',
```

- [ ] **Step 2: Activate sidebar link in `electron/renderer/index.html`**

Change the music link (lines 40-43) from a dead link to:

```html
<li><a href="#" id="musica" class="flex gap-3 items-center text-sm lg:text-base" onclick="cargarPagina(event, 'musica')">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-vinyl w-5 h-5 lg:w-6 lg:h-6"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M16 3.937a9 9 0 1 0 5 8.063" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M19 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M20 4l-3.5 10l-2.5 2" /></svg>
    <span class="hidden lg:inline">Music</span></a>
</li>
```

- [ ] **Step 3: Update welcome page card in `electron/renderer/welcome/welcome.html`**

Change the Music card (lines 43-51) from disabled to active:

```html
    <!-- Music -->
    <a href="#" onclick="cargarPagina(event, 'musica')" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-purple-200 transition-all duration-200 group">
      <div class="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500"><path d="M16 3.937a9 9 0 1 0 5 8.063" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M19 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M20 4l-3.5 10l-2.5 2" /></svg>
      </div>
      <h2 class="text-lg font-semibold text-gray-800 mb-1">Music</h2>
      <p class="text-sm text-gray-400 leading-relaxed">Reproduce música de fondo para concentrarte durante tus sesiones de estudio.</p>
    </a>
```

- [ ] **Step 4: Verify all changes**

Run: `Select-String -Pattern "musica" electron/renderer/index.js`
Expected: `musica: 'music/music.html',`

- [ ] **Step 5: Commit**

```bash
git add electron/renderer/index.js electron/renderer/index.html electron/renderer/welcome/welcome.html
git commit -m "feat(music): activate music route, sidebar link, and welcome card"
```

---

### Task 8: Build and Verify

- [ ] **Step 1: Full backend compile**

Run: `.\gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 2: Start backend and verify seed data**

Run: `.\gradlew.bat bootRun`
Then in another terminal: `curl http://localhost:8080/api/musica/radios`
Expected: JSON array with 25 radio stations

- [ ] **Step 3: Test frontend**

Run: `npm start`
Expected: Electron app opens, Music link in sidebar works, radio catalog loads

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(music): post-build adjustments"
```
