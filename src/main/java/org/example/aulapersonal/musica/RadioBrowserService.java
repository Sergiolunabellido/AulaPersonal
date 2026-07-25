package org.example.aulapersonal.musica;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class RadioBrowserService {

    private static final String API_BASE = "https://de1.api.radio-browser.info/json";
    private static final int LIMITE = 200;

    private final RestClient client;

    public RadioBrowserService() {
        this.client = RestClient.builder()
                .baseUrl(API_BASE)
                .defaultHeader("User-Agent", "AulaPersonal/1.0")
                .build();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> buscar(String query) {
        try {
            var respuesta = client.get()
                    .uri("/stations/search?name=" + query
                            + "&limit=" + LIMITE + "&offset=0"
                            + "&order=clickcount")
                    .retrieve()
                    .body(List.class);

            List<Map<String, Object>> resultados = new ArrayList<>();
            if (respuesta != null) {
                for (Object obj : (List<Object>) respuesta) {
                    if (obj instanceof Map) {
                        resultados.add((Map<String, Object>) obj);
                    }
                }
            }
            return resultados;
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> buscarPorTag(String tag) {
        try {
            var respuesta = client.get()
                    .uri("/stations/bytag/" + tag
                            + "?limit=" + LIMITE + "&offset=0"
                            + "&order=clickcount")
                    .retrieve()
                    .body(List.class);

            List<Map<String, Object>> resultados = new ArrayList<>();
            if (respuesta != null) {
                for (Object obj : (List<Object>) respuesta) {
                    if (obj instanceof Map) {
                        resultados.add((Map<String, Object>) obj);
                    }
                }
            }
            return resultados;
        } catch (Exception e) {
            return List.of();
        }
    }
}
