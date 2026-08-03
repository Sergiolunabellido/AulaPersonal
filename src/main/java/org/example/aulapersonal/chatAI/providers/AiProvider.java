package org.example.aulapersonal.chatAI.providers;

import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public interface AiProvider {
    String getProviderId();

    String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception;

    default List<Map<String, Object>> listarModelos(ChatRequestConfig config) throws Exception {
        return Collections.emptyList();
    }
}
