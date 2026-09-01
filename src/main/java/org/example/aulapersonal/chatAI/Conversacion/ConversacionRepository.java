package org.example.aulapersonal.chatAI.Conversacion;

import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

@Repository
public interface ConversacionRepository extends JpaRepository<Conversacion, Long> {
    /**
     * Recupera conversaciones ordenadas por fecha de actualización (desc.).
     * Usado por ChatService#listarConversaciones para mostrar el historial.
     */
    @Query("SELECT c FROM Conversacion c ORDER BY c.actualizadoEn DESC")
    List<Conversacion> findAllByOrderByActualizadoEnDesc();

}
