package org.example.aulapersonal.musica;

import jakarta.persistence.*;

@Entity
@Table(name = "carpetas_escaneadas")
public class CarpetaEscaneada {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String ruta;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRuta() { return ruta; }
    public void setRuta(String ruta) { this.ruta = ruta; }
}
