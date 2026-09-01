package org.example.aulapersonal.chatAI.providers;

import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Adaptador para proveedores compatibles OpenAI del tipo Mistral.
 * Actualmente delega en la implementación genérica {@link OpenAiCompatibleProvider}.
 */
@Component
public class MistralProvider extends OpenAiCompatibleProvider {

    @Override
    public String getProviderId() {
        return "mistral";
    }

    @Override
    public String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception {
        return completarOpenAi(config, historial);
    }
}
