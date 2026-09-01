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

    /**
     * GET /api/notas
     * Devuelve la lista de notas (más recientes primero).
     * Consumido por el frontend (notes/notes.js) en la UI de notas.
     */
    @GetMapping
    public List<Nota> listar() {
        return service.listarTodas();
    }

    /**
     * GET /api/notas/{id}
     * Devuelve la nota por id o 404 si no existe. Usado por la UI al seleccionar
     * una nota concreta en la lista.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Nota> obtener(@PathVariable Long id) {
        return service.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/notas
     * Crea una nueva nota. El body debe incluir "titulo" (no vacío) y
     * opcionalmente "contenido". Retorna 201 con la entidad creada.
     * Llamado desde la UI cuando se guarda una nota nueva.
     */
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

    /**
     * PUT /api/notas/{id}
     * Actualiza una nota existente. Valida que el título no esté vacío.
     * Retorna 200 con la nota actualizada o 404 si no existe.
     */
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

    /**
     * DELETE /api/notas/{id}
     * Elimina la nota si existe. Retorna 204 o 404.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        return service.eliminar(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
