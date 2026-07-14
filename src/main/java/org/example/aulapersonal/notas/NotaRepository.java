package org.example.aulapersonal.notas;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotaRepository extends JpaRepository<Nota, Long> {
    @Query("SELECT n FROM Nota n ORDER BY n.actualizadoEn DESC")
    List<Nota> findAllByOrderByUpdatedAtDesc();
}
