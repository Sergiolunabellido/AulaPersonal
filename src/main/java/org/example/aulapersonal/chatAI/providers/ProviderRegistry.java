package org.example.aulapersonal.chatAI.providers;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class ProviderRegistry {

    private final Map<String, AiProvider> providersById = new HashMap<>();

    public ProviderRegistry(List<AiProvider> providers) {
        for (AiProvider provider : providers) {
            providersById.put(provider.getProviderId(), provider);
        }
    }

    public AiProvider resolve(String providerId) {
        AiProvider provider = providersById.get(providerId);
        if (provider == null) {
            return providersById.get("custom");
        }
        return provider;
    }
}
