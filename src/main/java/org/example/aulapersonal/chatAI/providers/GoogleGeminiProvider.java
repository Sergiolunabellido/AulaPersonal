package org.example.aulapersonal.chatAI.providers;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.example.aulapersonal.chatAI.ChatRequestConfig;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Component
public class GoogleGeminiProvider extends OpenAiCompatibleProvider {

    private final ObjectMapper googleMapper = new ObjectMapper();

    @Override
    public String getProviderId() {
        return "google";
    }

    @Override
    public String completarChat(ChatRequestConfig config, List<Mensaje> historial) throws Exception {
        return completarOpenAi(config, historial);
    }

    @Override
    public List<Map<String, Object>> listarModelos(ChatRequestConfig config) throws Exception {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            return List.of();
        }

        try {
            List<Map<String, Object>> nativos = listarModelosNativos(config);
            if (!nativos.isEmpty()) {
                return nativos;
            }
        } catch (Exception ignored) {
            // Fallback a endpoint compatible OpenAI
        }

        return listarModelosOpenAi(config);
    }

    private List<Map<String, Object>> listarModelosNativos(ChatRequestConfig config) throws Exception {
        String key = URLEncoder.encode(config.getApiKey(), StandardCharsets.UTF_8);
        String url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + key;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException(
                    "Error listando modelos Google (" + response.statusCode() + "): " + response.body()
            );
        }

        JsonNode root = googleMapper.readTree(response.body());
        JsonNode models = root.get("models");
        if (models == null || !models.isArray()) {
            return List.of();
        }

        String endpointChat = config.getEndpoint() != null && !config.getEndpoint().isBlank()
                ? config.getEndpoint()
                : "https://generativelanguage.googleapis.com/v1beta/openai";

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (JsonNode item : models) {
            String name = item.get("name") != null ? item.get("name").asText() : null;
            if (name == null || name.isBlank()) {
                continue;
            }
            String id = name.startsWith("models/") ? name.substring("models/".length()) : name;

            boolean soportaGenerate = false;
            JsonNode methods = item.get("supportedGenerationMethods");
            if (methods != null && methods.isArray()) {
                for (JsonNode method : methods) {
                    String m = method.asText("");
                    if ("generateContent".equals(m) || "createChatCompletion".equals(m)) {
                        soportaGenerate = true;
                        break;
                    }
                }
            }
            if (!soportaGenerate || !ModelListingSupport.esModeloChat(id)) {
                continue;
            }

            String display = item.get("displayName") != null ? item.get("displayName").asText() : null;
            resultado.add(ModelListingSupport.modelo(
                    id,
                    display != null && !display.isBlank() ? display : ModelListingSupport.nombreBonito(id),
                    getProviderId(),
                    endpointChat,
                    1_048_576
            ));
        }

        resultado.sort(Comparator.comparing(m -> String.valueOf(m.get("nombre")), String.CASE_INSENSITIVE_ORDER));
        return resultado;
    }
}
