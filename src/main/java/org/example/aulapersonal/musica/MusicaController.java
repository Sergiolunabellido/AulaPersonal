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
