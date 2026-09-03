package org.example.aulapersonal.chatAI.providers;

import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
/**
 * Adaptador para usar APIs compatibles con el formato OpenAI.
 * Hereda la lógica común de {@link OpenAiCompatibleProvider}.
 */
public class OpenAiProvider extends OpenAiCompatibleProvider {

    @Override
    public String getProviderId() {
        return "openai";
    }

    @Override
    public String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception {
        return completarOpenAi(config, historial);
    }
}
