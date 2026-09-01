package org.example.aulapersonal.notas;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotaRepository extends JpaRepository<Nota, Long> {
    /**
     * Devuelve todas las notas ordenadas por fecha de actualización (descendente).
     * Usado por {@link NotaService#listarTodas()} para mostrar las notas más recientes primero.
     */
    @Query("SELECT n FROM Nota n ORDER BY n.actualizadoEn DESC")
    List<Nota> findAllByOrderByUpdatedAtDesc();
}
