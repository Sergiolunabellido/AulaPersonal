package org.example.aulapersonal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada de la aplicación Spring Boot (backend).
 * <p>
 * Contiene el método {@code main} que inicia el contexto Spring y arranca
 * los controladores/servicios/repositores definidos en el paquete
 * {@code org.example.aulapersonal}.
 *
 * Conexiones importantes:
 * - Los controladores REST (p.ej. {@code NotaController}, {@code ChatController})
 *   son detectados automáticamente por Spring y exponen los endpoints
 *   consumidos por el frontend Electron en http://localhost:8080/api/...
 */
@SpringBootApplication
public class AulaPersonalApplication {

    /**
     * Inicia la aplicación Spring Boot.
     * @param args parámetros de línea de comandos (no usados)
     */
    public static void main(String[] args) {
        SpringApplication.run(AulaPersonalApplication.class, args);
    }

}
