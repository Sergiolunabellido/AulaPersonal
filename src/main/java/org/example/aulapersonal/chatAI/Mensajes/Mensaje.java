package org.example.aulapersonal.chatAI.Mensajes;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mensaje")
/**
 * Entidad que representa un mensaje en una conversación.
 * Campos:
 * - conversacionID: FK hacia {@link org.example.aulapersonal.chatAI.Conversacion.Conversacion}
 * - rol: 'user' o 'assistant' (u otros) para interpretar el origen del mensaje
 * - contenido: texto del mensaje
 *
 * Se crea la marca de tiempo automáticamente en {@link #crearMensaje()} (@PrePersist).
 */
public class Mensaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long conversacionID;

    @Column(nullable = false)
    private String rol;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String contenido;

    @Column(nullable = false, updatable = false)
    private LocalDateTime creadoEn;

    @PrePersist
    public void crearMensaje() {
        // Marca temporal al persistir por primera vez
        creadoEn = LocalDateTime.now();
    }

    // Getters/setters usados por JPA y servicios
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversacionID() { return conversacionID; }
    public void setConversacionID(Long conversacionID) { this.conversacionID = conversacionID; }
    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }
    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
}
