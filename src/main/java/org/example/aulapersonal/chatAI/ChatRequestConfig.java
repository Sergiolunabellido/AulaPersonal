package org.example.aulapersonal.chatAI;

import java.util.HashMap;
import java.util.Map;

public class ChatRequestConfig {

    private String provider = "ollama";
    private String model = "qwen2.5-coder:3b";
    private String apiKey = "";
    private String endpoint = "http://127.0.0.1:11434";
    private String nivel = "medium";
    private String tipoModelo = "general";
    private String tipoTrabajo = "general";
    private boolean modoAuto = false;

    public static ChatRequestConfig fromMap(Map<String, Object> raw) {
        ChatRequestConfig config = new ChatRequestConfig();
        if (raw == null) return config;

        config.provider = stringValue(raw.get("provider"), config.provider);
        config.model = stringValue(raw.get("model"), config.model);
        config.apiKey = stringValue(raw.get("apiKey"), config.apiKey);
        config.endpoint = stringValue(raw.get("endpoint"), config.endpoint);
        config.nivel = stringValue(raw.get("nivel"), config.nivel);
        config.tipoModelo = stringValue(raw.get("tipoModelo"), config.tipoModelo);
        config.tipoTrabajo = stringValue(raw.get("tipoTrabajo"), config.tipoTrabajo);
        config.modoAuto = booleanValue(raw.get("modoAuto"), config.modoAuto);
        return config;
    }

    public static ChatRequestConfig of(String provider, String model, String apiKey, String endpoint) {
        ChatRequestConfig config = new ChatRequestConfig();
        config.provider = provider;
        config.model = model;
        config.apiKey = apiKey;
        config.endpoint = endpoint;
        return config;
    }

    public static ChatRequestConfig forTitleGeneration(ChatRequestConfig base) {
        ChatRequestConfig config = of(
                base.getProvider(),
                base.getModel(),
                base.getApiKey(),
                base.getEndpoint()
        );
        config.tipoTrabajo = "__title__";
        return config;
    }

    public boolean isTitleGeneration() {
        return "__title__".equals(tipoTrabajo);
    }

    public Map<String, Object> toPersistedMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("provider", provider);
        map.put("model", model);
        map.put("endpoint", endpoint);
        map.put("nivel", nivel);
        map.put("tipoModelo", tipoModelo);
        map.put("tipoTrabajo", tipoTrabajo);
        map.put("modoAuto", modoAuto);
        return map;
    }

    private static boolean booleanValue(Object value, boolean fallback) {
        if (value == null) return fallback;
        if (value instanceof Boolean bool) return bool;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private static String stringValue(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? fallback : text;
    }

    public String getProvider() { return provider; }
    public String getModel() { return model; }
    public String getApiKey() { return apiKey; }
    public String getEndpoint() { return endpoint; }
    public String getNivel() { return nivel; }
    public String getTipoModelo() { return tipoModelo; }
    public String getTipoTrabajo() { return tipoTrabajo; }
    public boolean isModoAuto() { return modoAuto; }
    public void setModoAuto(boolean modoAuto) { this.modoAuto = modoAuto; }

    public String buildSystemPrompt() {
        if (isTitleGeneration()) {
            return "Eres un asistente que nombra conversaciones de chat. "
                    + "Genera títulos muy breves (3-5 palabras) en español: descriptivos y concretos, "
                    + "como encabezados de un hilo. No copies el mensaje del usuario, no uses saludos ni preguntas. "
                    + "Responde únicamente con el título.";
        }
        return "Eres un asistente AI experto en programación y desarrollo de software. "
                + "Responde con código claro, explicaciones precisas y buenas prácticas. "
                + "Nivel: " + nivel + ". "
                + "Tipo de trabajo: " + tipoTrabajo + ".";
    }
}
