package org.example.aulapersonal.chatAI.providers;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

abstract class OpenAiCompatibleProvider implements AiProvider {

    protected final ObjectMapper mapper = new ObjectMapper();

    protected String resolveUrl(String endpoint) {
        String baseUrl = endpoint.replaceAll("/+$", "");
        if (baseUrl.endsWith("/v1/chat/completions")) {
            return baseUrl;
        }
        if (baseUrl.endsWith("/v1")) {
            return baseUrl + "/chat/completions";
        }
        if (baseUrl.endsWith("/openai")) {
            return baseUrl + "/chat/completions";
        }
        return baseUrl + "/v1/chat/completions";
    }

    @Override
    public List<Map<String, Object>> listarModelos(ChatRequestConfig config) throws Exception {
        return listarModelosOpenAi(config);
    }

    protected List<Map<String, Object>> listarModelosOpenAi(ChatRequestConfig config) throws Exception {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            return List.of();
        }

        String url = ModelListingSupport.resolveModelsUrl(config.getEndpoint());
        if (url.isBlank()) {
            return List.of();
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + config.getApiKey())
                .GET()
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException(
                    "Error listando modelos " + getProviderId() + " (" + response.statusCode() + "): " + response.body()
            );
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode data = root.get("data");
        if (data == null || !data.isArray()) {
            return List.of();
        }

        List<Map<String, Object>> modelos = new ArrayList<>();
        for (JsonNode item : data) {
            String id = textOrNull(item.get("id"));
            if (!ModelListingSupport.esModeloChat(id)) {
                continue;
            }
            String nombre = textOrNull(item.get("name"));
            if (nombre == null || nombre.isBlank()) {
                nombre = ModelListingSupport.nombreBonito(id);
            }
            modelos.add(ModelListingSupport.modelo(
                    id,
                    nombre,
                    getProviderId(),
                    config.getEndpoint(),
                    128_000
            ));
        }

        modelos.sort(Comparator.comparing(m -> String.valueOf(m.get("nombre")), String.CASE_INSENSITIVE_ORDER));
        return modelos;
    }

    private static String textOrNull(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    protected String completarOpenAi(ChatRequestConfig config, List<Mensaje> historial) throws Exception {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            return "Error: falta la API key para " + getProviderId();
        }

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

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(resolveUrl(config.getEndpoint())))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + config.getApiKey());

        HttpRequest request = builder
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            return "Error " + getProviderId() + " (" + response.statusCode() + "): " + response.body();
        }

        JsonNode root = mapper.readTree(response.body());
        return root.get("choices").get(0).get("message").get("content").asText();
    }
}
