package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CarpetaEscaneadaRepository extends JpaRepository<CarpetaEscaneada, Long> {
}
