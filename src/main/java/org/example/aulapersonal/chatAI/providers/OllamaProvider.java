package org.example.aulapersonal.chatAI.providers;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

@Component
public class OllamaProvider implements AiProvider {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String getProviderId() {
        return "ollama";
    }

    @Override
    public String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception {
        String baseUrl = config.getEndpoint().replaceAll("/+$", "");
        String url = baseUrl + "/api/chat";

        ArrayNode messages = mapper.createArrayNode();
        ObjectNode systemNode = mapper.createObjectNode();
        systemNode.put("role", "system");
        systemNode.put("content", config.buildSystemPrompt());
        messages.add(systemNode);

        for (Mensaje m : historial) {
            ObjectNode node = mapper.createObjectNode();
            node.put("role", m.getRol());
            node.put("content", m.getContenido());
            messages.add(node);
        }

        ObjectNode body = mapper.createObjectNode();
        body.put("model", config.getModel());
        body.set("messages", messages);
        body.put("stream", false);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            return "Error Ollama (" + response.statusCode() + "): " + response.body();
        }

        JsonNode root = mapper.readTree(response.body());
        return root.get("message").get("content").asText();
    }
}
