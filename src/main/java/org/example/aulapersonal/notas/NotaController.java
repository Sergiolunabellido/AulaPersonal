package org.example.aulapersonal.notas;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notas")
public class NotaController {

    private final NotaService service;

    public NotaController(NotaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Nota> listar() {
        return service.listarTodas();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Nota> obtener(@PathVariable Long id) {
        return service.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Nota> crear(@RequestBody Map<String, String> body) {
        String titulo = body.getOrDefault("titulo", "").trim();
        String contenido = body.getOrDefault("contenido", "").trim();
        if (titulo.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Nota nota = service.crear(titulo, contenido);
        return ResponseEntity.status(HttpStatus.CREATED).body(nota);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Nota> actualizar(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String titulo = body.getOrDefault("titulo", "").trim();
        String contenido = body.getOrDefault("contenido", "").trim();
        if (titulo.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return service.actualizar(id, titulo, contenido)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        return service.eliminar(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
