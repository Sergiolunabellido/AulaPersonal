package org.example.aulapersonal.notas;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class NotaService {

    private final NotaRepository repository;

    public NotaService(NotaRepository repository) {
        this.repository = repository;
    }

    public List<Nota> listarTodas() {
        return repository.findAllByOrderByUpdatedAtDesc();
    }

    public Optional<Nota> obtenerPorId(Long id) {
        return repository.findById(id);
    }

    public Nota crear(String titulo, String contenido) {
        Nota nota = new Nota();
        nota.setTitulo(titulo);
        nota.setContenido(contenido);
        return repository.save(nota);
    }

    public Optional<Nota> actualizar(Long id, String titulo, String contenido) {
        return repository.findById(id).map(nota -> {
            nota.setTitulo(titulo);
            nota.setContenido(contenido);
            return repository.save(nota);
        });
    }

    public boolean eliminar(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return true;
        }
        return false;
    }
}
