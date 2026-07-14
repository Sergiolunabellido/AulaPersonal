package org.example.aulapersonal.chatAI.Conversacion;

import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

@Repository
public interface ConversacionRepository extends JpaRepository<Conversacion, Long> {
    @Query("SELECT c FROM Conversacion c ORDER BY c.actualizadoEn DESC")
    List<Conversacion> findAllByOrderByActualizadoEnDesc();

}
