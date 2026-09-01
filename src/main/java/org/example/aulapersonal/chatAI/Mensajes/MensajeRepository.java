package org.example.aulapersonal.chatAI.Mensajes;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MensajeRepository extends JpaRepository<Mensaje, Long> {
    /**
     * Recupera mensajes de una conversación ordenados por fecha ascendente
     * (primer mensaje primero). Usado por ChatService al reconstruir el historial.
     */
    List<Mensaje> findByConversacionIDOrderByCreadoEnAsc(Long conversacionID);

    /**
     * Cuenta mensajes en una conversación; usado por limpieza/validación de sesiones.
     */
    long countByConversacionID(Long conversacionID);
}
