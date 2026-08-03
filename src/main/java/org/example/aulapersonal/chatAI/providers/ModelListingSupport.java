package org.example.aulapersonal.chatAI.providers;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class ModelListingSupport {

    private static final Set<String> EXCLUIDOS = Set.of(
            "embedding", "embeddings", "whisper", "tts", "dall-e", "dalle", "image",
            "moderation", "audio", "realtime", "transcribe", "speech", "vision-preview-only"
    );

    private ModelListingSupport() {}

    static boolean esModeloChat(String id) {
        if (id == null || id.isBlank()) {
            return false;
        }
        String lower = id.toLowerCase(Locale.ROOT);
        for (String excluir : EXCLUIDOS) {
            if (lower.contains(excluir)) {
                return false;
            }
        }
        return true;
    }

    static String nombreBonito(String id) {
        if (id == null || id.isBlank()) {
            return "Modelo";
        }
        String limpio = id;
        if (limpio.startsWith("models/")) {
            limpio = limpio.substring("models/".length());
        }
        String[] partes = limpio.replace('_', ' ').replace('-', ' ').split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String parte : partes) {
            if (parte.isBlank()) continue;
            if (sb.length() > 0) sb.append(' ');
            if (parte.length() <= 3 && parte.equals(parte.toLowerCase(Locale.ROOT))) {
                sb.append(parte.toUpperCase(Locale.ROOT));
            } else {
                sb.append(Character.toUpperCase(parte.charAt(0)));
                if (parte.length() > 1) sb.append(parte.substring(1));
            }
        }
        return sb.toString();
    }

    static Map<String, Object> modelo(
            String id,
            String nombre,
            String provider,
            String endpoint,
            int contextoMaximo) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", id);
        map.put("nombre", nombre != null && !nombre.isBlank() ? nombre : nombreBonito(id));
        map.put("provider", provider);
        map.put("endpoint", endpoint == null ? "" : endpoint);
        map.put("requiereApiKey", !"ollama".equals(provider));
        map.put("contextoMaximo", contextoMaximo > 0 ? contextoMaximo : 128_000);
        return map;
    }

    static String resolveModelsUrl(String endpoint) {
        String baseUrl = endpoint == null ? "" : endpoint.replaceAll("/+$", "");
        if (baseUrl.isBlank()) {
            return "";
        }
        if (baseUrl.endsWith("/v1/models")) {
            return baseUrl;
        }
        if (baseUrl.endsWith("/models")) {
            return baseUrl;
        }
        if (baseUrl.endsWith("/v1/chat/completions")) {
            return baseUrl.replace("/v1/chat/completions", "/v1/models");
        }
        if (baseUrl.endsWith("/chat/completions")) {
            return baseUrl.replace("/chat/completions", "/models");
        }
        if (baseUrl.endsWith("/v1")) {
            return baseUrl + "/models";
        }
        if (baseUrl.endsWith("/openai")) {
            return baseUrl + "/models";
        }
        return baseUrl + "/v1/models";
    }
}
