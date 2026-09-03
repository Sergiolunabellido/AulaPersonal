package org.example.aulapersonal.chatAI.providers;

import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public interface AiProvider {
    /**
     * Identificador del proveedor (p.ej. "ollama", "openai").
     */
    String getProviderId();

    /**
     * Completa el chat dado un config y el historial de mensajes. Debe devolver
     * el texto de respuesta del asistente o lanzar excepción en error.
     * Implementado por adaptadores de proveedor (Ollama, OpenAI-compatible, etc.).
     */
    String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception;

    /**
     * Opcional: listar modelos disponibles en el proveedor para una config.
     * Por defecto devuelve lista vacía; los adaptadores que soporten listados
     * (OpenAI, Anthropic, Google) la implementan.
     */
    default List<Map<String, Object>> listarModelos(ChatRequestConfig config) throws Exception {
        return Collections.emptyList();
    }
}
