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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Component
public class AnthropicProvider implements AiProvider {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String getProviderId() {
        return "anthropic";
    }

    @Override
    public List<Map<String, Object>> listarModelos(ChatRequestConfig config) throws Exception {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            return List.of();
        }

        String baseUrl = config.getEndpoint().replaceAll("/+$", "");
        String url;
        if (baseUrl.endsWith("/v1/models")) {
            url = baseUrl;
        } else if (baseUrl.endsWith("/v1")) {
            url = baseUrl + "/models";
        } else {
            url = baseUrl + "/v1/models";
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("x-api-key", config.getApiKey())
                .header("anthropic-version", "2023-06-01")
                .GET()
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException(
                    "Error listando modelos Anthropic (" + response.statusCode() + "): " + response.body()
            );
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode data = root.get("data");
        if (data == null || !data.isArray()) {
            return List.of();
        }

        List<Map<String, Object>> modelos = new ArrayList<>();
        for (JsonNode item : data) {
            String id = item.get("id") != null ? item.get("id").asText() : null;
            if (!ModelListingSupport.esModeloChat(id)) {
                continue;
            }
            String nombre = item.get("display_name") != null ? item.get("display_name").asText() : null;
            if (nombre == null || nombre.isBlank()) {
                nombre = ModelListingSupport.nombreBonito(id);
            }
            modelos.add(ModelListingSupport.modelo(
                    id,
                    nombre,
                    getProviderId(),
                    config.getEndpoint(),
                    200_000
            ));
        }

        modelos.sort(Comparator.comparing(m -> String.valueOf(m.get("nombre")), String.CASE_INSENSITIVE_ORDER));
        return modelos;
    }

    @Override
    public String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            return "Error: falta la API key de Anthropic";
        }

        String baseUrl = config.getEndpoint().replaceAll("/+$", "");
        String url = baseUrl.endsWith("/v1/messages") ? baseUrl : baseUrl + "/v1/messages";

        ArrayNode messages = mapper.createArrayNode();
        for (Mensaje m : historial) {
            if ("system".equals(m.getRol())) continue;
            ObjectNode node = mapper.createObjectNode();
            node.put("role", "assistant".equals(m.getRol()) ? "assistant" : "user");
            node.put("content", m.getContenido());
            messages.add(node);
        }

        ObjectNode body = mapper.createObjectNode();
        body.put("model", config.getModel());
        body.put("max_tokens", 4096);
        body.put("system", config.buildSystemPrompt());
        body.set("messages", messages);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("x-api-key", config.getApiKey())
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            return "Error Anthropic (" + response.statusCode() + "): " + response.body();
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode content = root.get("content");
        if (content != null && content.isArray() && !content.isEmpty()) {
            return content.get(0).get("text").asText();
        }
        return "Error Anthropic: respuesta vacía";
    }
}
