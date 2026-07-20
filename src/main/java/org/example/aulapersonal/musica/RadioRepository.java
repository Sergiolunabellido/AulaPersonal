package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RadioRepository extends JpaRepository<Radio, Long> {
    List<Radio> findByGenero(String genero);
    List<Radio> findByFavoritaTrue();
}
