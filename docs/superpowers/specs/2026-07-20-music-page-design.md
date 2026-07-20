# Music Page — Design Spec

## Overview
Desktop music player page inside the Aula Personal SPA. Combines a fixed radio catalog, local music file playback, and user-created playlists — all within the app without external service accounts.

## Architecture

### Components
| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Vanilla JS (IIFE) + Tailwind CSS | UI, playback controls, file scanning |
| **Backend** | Spring Boot + H2 | Persist playlists, radio catalog, scanned folders |
| **Audio** | HTML5 Audio API | Radio streams + local file playback via Blob URL |
| **File System** | Electron IPC (`dialog.showOpenDialog`) | Select folders, read files, extract metadata |

### Entities (H2)
- `Radio` — id, nombre, genero, urlStream, imagenUrl, favorita
- `Playlist` — id, nombre, descripcion
- `PlaylistCancion` — id, playlistId, rutaArchivo, titulo, artista, album, duracion, orden
- `CarpetaEscaneada` — id, ruta (persistente)

### REST Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/radios` | List all radios |
| POST | `/api/radios/{id}/favorito` | Toggle favorite |
| GET | `/api/playlists` | List user playlists |
| POST | `/api/playlists` | Create playlist |
| DELETE | `/api/playlists/{id}` | Delete playlist |
| GET | `/api/playlists/{id}/canciones` | Get playlist songs |
| POST | `/api/playlists/{id}/canciones` | Add song to playlist |
| DELETE | `/api/playlists/{id}/canciones/{id}` | Remove song |
| PUT | `/api/playlists/{id}/canciones/reordenar` | Reorder songs |
| GET | `/api/carpetas` | Get scanned folders |
| POST | `/api/carpetas` | Add scanned folder |
| DELETE | `/api/carpetas/{id}` | Remove folder |

### Frontend Pages
**HTML**: `electron/renderer/music/music.html`
**JS**: `electron/renderer/music/music.js`

### Layout
Three-zone layout:
1. **Left sidebar** — navigation tabs: Radios, Mis Listas, Archivo Local
2. **Main content** — changes based on selected tab
3. **Bottom player bar** — fixed, always visible, controls playback

### Persistent Routes
Add `musica: 'music/music.html'` to `rutas` in `index.js`.

### Sidebar Link
Replace dead music link in `index.html` with `onclick="cargarPagina(event, 'musica')"`.

### Welcome Page
Update welcome card to link to music page (remove `opacity-60` and `cursor-not-allowed`).

## Radio Catalog (Fixed — 25 stations)
Pre-seeded via `data.sql` on backend startup:

| Genre | Stations |
|---|---|
| Rock | Absolute Rock, Rock FM, Kerrang Radio, Triple M |
| Lo-Fi | Lofi Girl, Chillhop, ChilledCow, Radio Lofi |
| Pop | Hits Radio, Capital FM, Los 40, NRJ |
| Jazz | Jazz FM, Jazz24, SomaFM Groove Salad |
| Electronic | DI.FM, SomaFM Digital, Digitally Imported |
| Latino | Urbana, Exa FM, Zona Latina, Mega FM |
| Classical | Calm Radio Classical, WQXR, Classic FM |

Each radio has: name, genre, stream URL, optional image URL, favorite toggle.

## Local Music Management
- User clicks "Seleccionar carpeta" → Electron `dialog.showOpenDialog({properties: ['openDirectory']})`
- Path saved to `CarpetaEscaneada` table (persistent across restarts)
- App scans folder recursively for `.mp3`, `.flac`, `.wav`, `.ogg`
- Metadata extracted via `jsmediatags` library (or Node.js `music-metadata`)
- Files displayed in "Archivo Local" tab with title, artist, album, duration, cover art
- Covers extracted from ID3 tags and shown inline

## Playlists
- CRUD operations via REST API (H2 persistence)
- Songs added from local scanned files
- Drag-and-drop reorder within playlist
- Playlist playback: sequential, shuffle toggle, repeat (one/all)
- Radios can be favorited per playlist or globally

## Player Controls (Bottom Bar)
**Fixed bar visible on all music page tabs**:
- Previous / Play-Pause / Next
- Progress slider (clickable/draggable)
- Volume slider with mute toggle
- Now playing info: title, artist, source icon (local vs radio)
- Shuffle toggle
- Repeat toggle (off / one / all)

**Audio behavior**:
- Radio streams via direct `<audio>` src (stream URL)
- Local files via Blob URL or `file://` protocol through Electron
- Seamless switching between sources
- Auto-advance in playlist mode
- Graceful error on stream failure (show alert, skip to next)

## Implementation Order
1. Backend entities + REST endpoints + seed data
2. music.html layout (sidebar + content area + player bar)
3. Radio catalog tab (list, play, favorite)
4. Player bar functional (play radio streams)
5. Folder selection + file scanning via Electron IPC
6. Local music tab (browse scanned files)
7. Playlist CRUD (backend + frontend)
8. Drag-and-drop reorder + shuffle/repeat
9. Welcome page update + sidebar activation
10. Polish: loading states, error handling, cover art display

## Data Flow
```
User selects folder
  → Electron IPC (main process reads files + metadata)
  → Returns array of songs to renderer
  → Displayed in UI, saved to CarpetaEscaneada

User clicks play on song/radio
  → Player bar updates state
  → <audio> src set to stream URL / file path
  → Play/Pause toggles audio element

User adds song to playlist
  → POST /api/playlists/{id}/canciones
  → UI refreshes playlist view
```
