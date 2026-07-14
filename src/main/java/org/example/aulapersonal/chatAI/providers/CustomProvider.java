package org.example.aulapersonal.chatAI.providers;

import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CustomProvider extends OpenAiCompatibleProvider {

    @Override
    public String getProviderId() {
        return "custom";
    }

    @Override
    public String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception {
        return completarOpenAi(config, historial);
    }
}
