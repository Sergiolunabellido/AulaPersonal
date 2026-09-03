package org.example.aulapersonal.notas;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class NotaService {

    private final NotaRepository repository;

    /**
     * Servicio de dominio para operaciones CRUD sobre notas.
     * <p>
     * Este servicio encapsula la lógica de persistencia y es consumido por
     * {@link org.example.aulapersonal.notas.NotaController} que expone los endpoints REST.
     */
    public NotaService(NotaRepository repository) {
        this.repository = repository;
    }

    /**
     * Lista todas las notas ordenadas por fecha de actualización (reciente primero).
     * Llamado desde el controlador REST {@code GET /api/notas}.
     */
    public List<Nota> listarTodas() {
        return repository.findAllByOrderByUpdatedAtDesc();
    }

    /**
     * Obtiene una nota por su id.
     * Usado por {@link org.example.aulapersonal.notas.NotaController#obtener(Long)}.
     */
    public Optional<Nota> obtenerPorId(Long id) {
        return repository.findById(id);
    }

    /**
     * Crea y persiste una nueva nota con título y contenido.
     * Llamado por {@link org.example.aulapersonal.notas.NotaController#crear(java.util.Map)}.
     */
    public Nota crear(String titulo, String contenido) {
        Nota nota = new Nota();
        nota.setTitulo(titulo);
        nota.setContenido(contenido);
        return repository.save(nota);
    }

    /**
     * Actualiza una nota existente si existe.
     * Retorna Optional.empty() si la nota no existe.
     * Usado por {@link org.example.aulapersonal.notas.NotaController#actualizar(Long, java.util.Map)}.
     */
    public Optional<Nota> actualizar(Long id, String titulo, String contenido) {
        return repository.findById(id).map(nota -> {
            nota.setTitulo(titulo);
            nota.setContenido(contenido);
            return repository.save(nota);
        });
    }

    /**
     * Elimina una nota por id. Devuelve true si existía y fue borrada.
     * Usado por {@link org.example.aulapersonal.notas.NotaController#eliminar(Long)}.
     */
    public boolean eliminar(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return true;
        }
        return false;
    }
}
