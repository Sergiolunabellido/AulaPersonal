package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    @Query("SELECT p FROM Playlist p ORDER BY p.creadoEn DESC")
    List<Playlist> findAllByOrderByCreadoEnDesc();
}
