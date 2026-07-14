package org.example.aulapersonal.chatAI.Mensajes;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mensaje")
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
        creadoEn = LocalDateTime.now();
    }

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
