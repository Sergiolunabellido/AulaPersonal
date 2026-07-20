package org.example.aulapersonal.musica;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
public class MusicaService {

    private final RadioRepository radioRepository;
    private final PlaylistRepository playlistRepository;
    private final PlaylistCancionRepository playlistCancionRepository;
    private final CarpetaEscaneadaRepository carpetaEscaneadaRepository;

    public MusicaService(RadioRepository radioRepository,
                         PlaylistRepository playlistRepository,
                         PlaylistCancionRepository playlistCancionRepository,
                         CarpetaEscaneadaRepository carpetaEscaneadaRepository) {
        this.radioRepository = radioRepository;
        this.playlistRepository = playlistRepository;
        this.playlistCancionRepository = playlistCancionRepository;
        this.carpetaEscaneadaRepository = carpetaEscaneadaRepository;
    }

    // Radios
    public List<Radio> listarRadios() {
        return radioRepository.findAll();
    }

    public List<Radio> listarRadiosPorGenero(String genero) {
        return radioRepository.findByGenero(genero);
    }

    public List<Radio> listarRadiosFavoritas() {
        return radioRepository.findByFavoritaTrue();
    }

    public Optional<Radio> toggleFavorito(Long id) {
        return radioRepository.findById(id).map(radio -> {
            radio.setFavorita(!radio.isFavorita());
            return radioRepository.save(radio);
        });
    }

    // Playlists
    public List<Playlist> listarPlaylists() {
        return playlistRepository.findAllByOrderByCreadoEnDesc();
    }

    public Playlist crearPlaylist(String nombre, String descripcion) {
        Playlist playlist = new Playlist();
        playlist.setNombre(nombre);
        playlist.setDescripcion(descripcion);
        return playlistRepository.save(playlist);
    }

    @Transactional
    public boolean eliminarPlaylist(Long id) {
        if (playlistRepository.existsById(id)) {
            playlistCancionRepository.deleteByPlaylistId(id);
            playlistRepository.deleteById(id);
            return true;
        }
        return false;
    }

    // Playlist songs
    public List<PlaylistCancion> listarCanciones(Long playlistId) {
        return playlistCancionRepository.findByPlaylistIdOrderByOrdenAsc(playlistId);
    }

    public PlaylistCancion agregarCancion(Long playlistId, String rutaArchivo, String titulo,
                                           String artista, String album, Integer duracion) {
        List<PlaylistCancion> existentes = playlistCancionRepository.findByPlaylistIdOrderByOrdenAsc(playlistId);
        int nuevoOrden = existentes.size() + 1;

        PlaylistCancion cancion = new PlaylistCancion();
        cancion.setPlaylistId(playlistId);
        cancion.setRutaArchivo(rutaArchivo);
        cancion.setTitulo(titulo);
        cancion.setArtista(artista);
        cancion.setAlbum(album);
        cancion.setDuracion(duracion);
        cancion.setOrden(nuevoOrden);
        return playlistCancionRepository.save(cancion);
    }

    public boolean eliminarCancion(Long id) {
        if (playlistCancionRepository.existsById(id)) {
            playlistCancionRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public boolean reordenarCanciones(Long playlistId, List<Long> idsOrdenadas) {
        List<PlaylistCancion> canciones = playlistCancionRepository.findByPlaylistIdOrderByOrdenAsc(playlistId);
        for (int i = 0; i < idsOrdenadas.size(); i++) {
            Long id = idsOrdenadas.get(i);
            final int orden = i + 1;
            canciones.stream()
                    .filter(c -> c.getId().equals(id))
                    .findFirst()
                    .ifPresent(c -> c.setOrden(orden));
        }
        playlistCancionRepository.saveAll(canciones);
        return true;
    }

    // Scanned folders
    public List<CarpetaEscaneada> listarCarpetas() {
        return carpetaEscaneadaRepository.findAll();
    }

    public CarpetaEscaneada agregarCarpeta(String ruta) {
        CarpetaEscaneada carpeta = new CarpetaEscaneada();
        carpeta.setRuta(ruta);
        return carpetaEscaneadaRepository.save(carpeta);
    }

    public boolean eliminarCarpeta(Long id) {
        if (carpetaEscaneadaRepository.existsById(id)) {
            carpetaEscaneadaRepository.deleteById(id);
            return true;
        }
        return false;
    }
}
