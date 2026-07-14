package org.example.aulapersonal.chatAI.Mensajes;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MensajeRepository extends JpaRepository<Mensaje, Long> {
    List<Mensaje> findByConversacionIDOrderByCreadoEnAsc(Long conversacionID);

    long countByConversacionID(Long conversacionID);
}
