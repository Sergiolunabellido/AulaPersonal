package org.example.aulapersonal.musica;

import jakarta.persistence.*;

@Entity
@Table(name = "playlist_canciones")
public class PlaylistCancion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long playlistId;

    @Column(nullable = false)
    private String rutaArchivo;

    private String titulo;
    private String artista;
    private String album;
    private Integer duracion;

    @Column(nullable = false)
    private Integer orden;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPlaylistId() { return playlistId; }
    public void setPlaylistId(Long playlistId) { this.playlistId = playlistId; }
    public String getRutaArchivo() { return rutaArchivo; }
    public void setRutaArchivo(String rutaArchivo) { this.rutaArchivo = rutaArchivo; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getArtista() { return artista; }
    public void setArtista(String artista) { this.artista = artista; }
    public String getAlbum() { return album; }
    public void setAlbum(String album) { this.album = album; }
    public Integer getDuracion() { return duracion; }
    public void setDuracion(Integer duracion) { this.duracion = duracion; }
    public Integer getOrden() { return orden; }
    public void setOrden(Integer orden) { this.orden = orden; }
}
