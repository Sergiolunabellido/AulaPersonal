package org.example.aulapersonal.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuración CORS para permitir que el frontend Electron (orígenes locales)
 * acceda a los endpoints REST del backend bajo /api/**.
 *
 * Notas de uso:
 * - Permite orígenes "file://" y "http://localhost" para que los HTML/JS
 *   cargados por Electron puedan hacer fetch() a los endpoints locales.
 */
@Configuration
public class ConfiguracionCors {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("file://", "http://localhost")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }
}
