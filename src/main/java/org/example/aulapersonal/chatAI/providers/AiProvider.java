package org.example.aulapersonal.chatAI.providers;

import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;

import java.util.List;

public interface AiProvider {
    String getProviderId();
    String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception;
}
