package org.example.aulapersonal.musica;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlaylistCancionRepository extends JpaRepository<PlaylistCancion, Long> {
    List<PlaylistCancion> findByPlaylistIdOrderByOrdenAsc(Long playlistId);
    void deleteByPlaylistId(Long playlistId);
}
