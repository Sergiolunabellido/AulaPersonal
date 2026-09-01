package org.example.aulapersonal.chatAI.Conversacion;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "conversacion")
/**
 * Entidad que representa una conversación (sesión de chat) y su snapshot de
 * configuración. El frontend crea una Conversacion antes de enviar mensajes
 * (POST /api/chat/sessions) y el servicio actualiza su título cuando procede.
 */
public class Conversacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String configSnapshot;

    @Column(nullable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(nullable = false)
    private LocalDateTime actualizadoEn;

    @PrePersist
    public void onCreate() {
        // Inicializa created/updated timestamps al persistir por primera vez
        this.creadoEn = LocalDateTime.now();
        this.actualizadoEn = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        // Actualiza timestamp antes de cada update en BD
        this.actualizadoEn = LocalDateTime.now();
    }

    // Getters / setters utilizados por servicios y controladores
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getConfigSnapshot() { return configSnapshot; }
    public void setConfigSnapshot(String configSnapshot) { this.configSnapshot = configSnapshot; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
    public LocalDateTime getActualizadoEn() { return actualizadoEn; }
    public void setActualizadoEn(LocalDateTime actualizadoEn) { this.actualizadoEn = actualizadoEn; }
}
