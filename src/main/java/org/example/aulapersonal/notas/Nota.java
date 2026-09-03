package org.example.aulapersonal.notas;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notas")
/**
 * Entidad JPA que representa una nota persistida en la base H2.
 *
 * Campos principales:
 * - id: PK autogenerado.
 * - titulo, contenido: datos de la nota.
 * - creadoEn, actualizadoEn: metadatos de timestamp (manejo por JPA @PrePersist/@PreUpdate).
 *
 * Uso:
 * - Persistida a través de {@link NotaRepository}.
 * - Manipulada por {@link org.example.aulapersonal.notas.NotaService} y expuesta
 *   por {@link org.example.aulapersonal.notas.NotaController} en los endpoints REST.
 */
public class Nota {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String contenido;

    @Column(nullable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(nullable = false)
    private LocalDateTime actualizadoEn;

    @PrePersist
    protected void onCreate() {
        // Establece timestamps iniciales al persistir por primera vez
        creadoEn = LocalDateTime.now();
        actualizadoEn = creadoEn;
    }

    @PreUpdate
    protected void onUpdate() {
        // Actualiza el timestamp antes de cada actualización en BD
        actualizadoEn = LocalDateTime.now();
    }

    // Getters / setters usados por JPA y por capas superiores (services/controllers)
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }

    public LocalDateTime getCreadoEn() { return creadoEn; }
    public LocalDateTime getActualizadoEn() { return actualizadoEn; }
}
