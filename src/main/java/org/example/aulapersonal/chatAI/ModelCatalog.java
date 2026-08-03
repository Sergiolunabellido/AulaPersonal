package org.example.aulapersonal.chatAI;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class ModelCatalog {

    public List<Map<String, Object>> listarProveedoresDePago() {
        List<Map<String, Object>> proveedores = new ArrayList<>();
        proveedores.add(proveedor("openai", "OpenAI", "https://api.openai.com/v1"));
        proveedores.add(proveedor("anthropic", "Anthropic", "https://api.anthropic.com/v1"));
        proveedores.add(proveedor("google", "Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai"));
        proveedores.add(proveedor("mistral", "Mistral", "https://api.mistral.ai/v1"));
        proveedores.add(proveedor("deepseek", "DeepSeek", "https://api.deepseek.com/v1"));
        proveedores.add(proveedor("custom", "Personalizado", ""));
        return proveedores;
    }

    public List<Map<String, Object>> listarModelosDePago() {
        List<Map<String, Object>> modelos = new ArrayList<>();

        modelos.add(modelo("gpt-4o", "GPT-4o", "openai", "https://api.openai.com/v1", 128_000));
        modelos.add(modelo("gpt-4o-mini", "GPT-4o Mini", "openai", "https://api.openai.com/v1", 128_000));
        modelos.add(modelo("gpt-4.1", "GPT-4.1", "openai", "https://api.openai.com/v1", 1_047_576));
        modelos.add(modelo("o3-mini", "o3 Mini", "openai", "https://api.openai.com/v1", 200_000));

        modelos.add(modelo("claude-opus-4-20250514", "Claude Opus 4", "anthropic", "https://api.anthropic.com/v1", 200_000));
        modelos.add(modelo("claude-sonnet-4-20250514", "Claude Sonnet 4", "anthropic", "https://api.anthropic.com/v1", 200_000));
        modelos.add(modelo("claude-3-5-haiku-20241022", "Claude Haiku 3.5", "anthropic", "https://api.anthropic.com/v1", 200_000));

        modelos.add(modelo("gemini-2.0-flash", "Gemini 2.0 Flash", "google", "https://generativelanguage.googleapis.com/v1beta/openai", 1_048_576));
        modelos.add(modelo("gemini-1.5-pro", "Gemini 1.5 Pro", "google", "https://generativelanguage.googleapis.com/v1beta/openai", 2_097_152));

        modelos.add(modelo("mistral-large-latest", "Mistral Large", "mistral", "https://api.mistral.ai/v1", 128_000));
        modelos.add(modelo("codestral-latest", "Codestral", "mistral", "https://api.mistral.ai/v1", 256_000));

        modelos.add(modelo("deepseek-chat", "DeepSeek Chat", "deepseek", "https://api.deepseek.com/v1", 64_000));
        modelos.add(modelo("deepseek-reasoner", "DeepSeek Reasoner", "deepseek", "https://api.deepseek.com/v1", 64_000));

        modelos.add(modelo("custom", "Modelo personalizado", "custom", "", 128_000));

        return modelos;
    }

    public List<Map<String, Object>> listarModelosFallbackPorProveedor(String provider) {
        if (provider == null || provider.isBlank()) {
            return List.of();
        }
        return listarModelosDePago().stream()
                .filter(m -> provider.equals(String.valueOf(m.get("provider"))))
                .toList();
    }

    public String endpointPorDefecto(String provider) {
        return listarProveedoresDePago().stream()
                .filter(p -> provider.equals(String.valueOf(p.get("id"))))
                .map(p -> String.valueOf(p.get("endpoint")))
                .findFirst()
                .orElse("");
    }

    public String nombreProveedor(String provider) {
        return listarProveedoresDePago().stream()
                .filter(p -> provider.equals(String.valueOf(p.get("id"))))
                .map(p -> String.valueOf(p.get("nombre")))
                .findFirst()
                .orElse(provider);
    }

    public List<String> listarProveedores() {
        return List.of("ollama", "openai", "anthropic", "google", "mistral", "deepseek", "custom");
    }

    private Map<String, Object> proveedor(String id, String nombre, String endpoint) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", id);
        map.put("nombre", nombre);
        map.put("endpoint", endpoint);
        map.put("requiereApiKey", true);
        return map;
    }

    private Map<String, Object> modelo(String id, String nombre, String provider, String endpoint, int contextoMaximo) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", id);
        map.put("nombre", nombre);
        map.put("provider", provider);
        map.put("endpoint", endpoint);
        map.put("requiereApiKey", !"ollama".equals(provider));
        map.put("contextoMaximo", contextoMaximo);
        return map;
    }
}
