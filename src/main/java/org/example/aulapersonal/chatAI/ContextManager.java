package org.example.aulapersonal.chatAI;

import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class ContextManager {

    private static final int RESERVA_RESPUESTA = 2048;
    private static final int OVERHEAD_SISTEMA = 250;
    private static final double FACTOR_USO_VENTANA = 0.78;

    public record PreparedContext(
            ChatRequestConfig config,
            List<Mensaje> historial,
            int tokensUsados,
            int contextoMaximo,
            String modeloResuelto,
            boolean historialRecortado
    ) {}

    public PreparedContext preparar(
            ChatRequestConfig config,
            List<Mensaje> historial,
            List<String> modelosOllamaInstalados) {

        if (config.isModoAuto()) {
            return prepararModoAuto(historial, modelosOllamaInstalados, config.getEndpoint());
        }

        ChatRequestConfig configAjustado = ajustarModeloOllamaInstalado(config, modelosOllamaInstalados);
        int contextoMaximo = contextoMaximoModelo(configAjustado.getModel(), configAjustado.getProvider());
        int presupuesto = presupuestoTokens(contextoMaximo);
        int tokensTotales = estimarTokens(historial);

        List<Mensaje> historialAjustado = historial;
        boolean recortado = false;
        if (tokensTotales > presupuesto) {
            historialAjustado = recortarHistorial(historial, presupuesto);
            recortado = historialAjustado.size() < historial.size();
            tokensTotales = estimarTokens(historialAjustado);
        }

        return new PreparedContext(
                configAjustado,
                historialAjustado,
                tokensTotales,
                contextoMaximo,
                configAjustado.getModel(),
                recortado
        );
    }

    public String resolverModeloInstalado(String modeloPreferido, List<String> modelosInstalados) {
        if (modelosInstalados == null || modelosInstalados.isEmpty()) {
            return modeloPreferido;
        }
        if (modeloEstaInstalado(modeloPreferido, modelosInstalados)) {
            return coincidirNombreModelo(modeloPreferido, modelosInstalados);
        }

        List<String> coders = modelosInstalados.stream()
                .filter(m -> m.toLowerCase().contains("coder"))
                .sorted(Comparator.<String>comparingInt(m -> contextoMaximoModelo(m, "ollama")).reversed())
                .toList();
        if (!coders.isEmpty()) {
            return coders.get(0);
        }

        return modelosInstalados.get(0);
    }

    public boolean modeloEstaInstalado(String modelo, List<String> instalados) {
        if (modelo == null || instalados == null || instalados.isEmpty()) {
            return false;
        }
        return instalados.stream().anyMatch(inst -> nombresModeloCoinciden(modelo, inst));
    }

    private ChatRequestConfig ajustarModeloOllamaInstalado(
            ChatRequestConfig config,
            List<String> modelosInstalados) {
        if (!"ollama".equals(config.getProvider())) {
            return config;
        }
        String resuelto = resolverModeloInstalado(config.getModel(), modelosInstalados);
        if (resuelto.equals(config.getModel())) {
            return config;
        }
        ChatRequestConfig ajustado = ChatRequestConfig.of(
                config.getProvider(),
                resuelto,
                config.getApiKey(),
                config.getEndpoint()
        );
        ajustado.setModoAuto(config.isModoAuto());
        return ajustado;
    }

    private PreparedContext prepararModoAuto(
            List<Mensaje> historial,
            List<String> modelosInstalados,
            String endpoint) {

        List<ModeloContexto> candidatos = construirCandidatosOllama(modelosInstalados);
        if (candidatos.isEmpty()) {
            return construirResultado(candidatoPorDefecto(), historial, endpoint, false);
        }
        int tokensNecesarios = estimarTokens(historial);

        for (ModeloContexto candidato : candidatos.stream()
                .sorted(Comparator.comparingInt(ModeloContexto::contextoMaximo))
                .toList()) {
            int presupuesto = presupuestoTokens(candidato.contextoMaximo());
            if (tokensNecesarios <= presupuesto) {
                return construirResultado(candidato, historial, endpoint, false);
            }
        }

        ModeloContexto mayorContexto = candidatos.stream()
                .max(Comparator.comparingInt(ModeloContexto::contextoMaximo))
                .orElse(candidatos.get(0));

        int presupuesto = presupuestoTokens(mayorContexto.contextoMaximo());
        List<Mensaje> recortado = recortarHistorial(historial, presupuesto);

        return construirResultado(mayorContexto, recortado, endpoint, recortado.size() < historial.size());
    }

    private PreparedContext construirResultado(
            ModeloContexto candidato,
            List<Mensaje> historial,
            String endpoint,
            boolean recortado) {

        ChatRequestConfig config = ChatRequestConfig.of(
                "ollama",
                candidato.id(),
                "",
                endpoint != null && !endpoint.isBlank() ? endpoint : "http://127.0.0.1:11434"
        );

        return new PreparedContext(
                config,
                historial,
                estimarTokens(historial),
                candidato.contextoMaximo(),
                candidato.id(),
                recortado
        );
    }

    private List<ModeloContexto> construirCandidatosOllama(List<String> modelosInstalados) {
        if (modelosInstalados == null || modelosInstalados.isEmpty()) {
            return List.of();
        }

        Map<String, ModeloContexto> unicos = new LinkedHashMap<>();
        for (String nombre : modelosInstalados) {
            if (nombre == null || nombre.isBlank()) continue;
            unicos.putIfAbsent(
                    nombre,
                    new ModeloContexto(nombre, contextoMaximoModelo(nombre, "ollama"))
            );
        }

        return unicos.values().stream()
                .sorted(Comparator
                        .comparing((ModeloContexto m) -> m.id().toLowerCase().contains("coder") ? 0 : 1)
                        .thenComparingInt(ModeloContexto::contextoMaximo).reversed())
                .toList();
    }

    private ModeloContexto candidatoPorDefecto() {
        return new ModeloContexto("qwen2.5-coder:3b", contextoMaximoModelo("qwen2.5-coder:3b", "ollama"));
    }

    private String coincidirNombreModelo(String modeloPreferido, List<String> instalados) {
        return instalados.stream()
                .filter(inst -> nombresModeloCoinciden(modeloPreferido, inst))
                .findFirst()
                .orElse(modeloPreferido);
    }

    private boolean nombresModeloCoinciden(String preferido, String instalado) {
        if (preferido == null || instalado == null) return false;
        if (preferido.equals(instalado)) return true;

        String[] pref = preferido.split(":", 2);
        String[] inst = instalado.split(":", 2);
        if (!pref[0].equals(inst[0])) return false;
        if (pref.length < 2) return true;
        if (inst.length < 2) return false;
        return inst[1].equals(pref[1]) || inst[1].startsWith(pref[1] + "-");
    }

    private int presupuestoTokens(int contextoMaximo) {
        int util = (int) Math.floor(contextoMaximo * FACTOR_USO_VENTANA);
        return Math.max(512, util - RESERVA_RESPUESTA - OVERHEAD_SISTEMA);
    }

    public int estimarTokens(List<Mensaje> historial) {
        if (historial == null || historial.isEmpty()) {
            return OVERHEAD_SISTEMA;
        }

        int total = OVERHEAD_SISTEMA;
        for (Mensaje mensaje : historial) {
            total += estimarTokensTexto(mensaje.getContenido()) + 8;
        }
        return total;
    }

    private int estimarTokensTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return 0;
        }
        return Math.max(1, (int) Math.ceil(texto.length() / 4.0));
    }

    private List<Mensaje> recortarHistorial(List<Mensaje> historial, int presupuesto) {
        if (historial == null || historial.isEmpty()) {
            return List.of();
        }

        List<Mensaje> seleccionados = new ArrayList<>();
        int total = OVERHEAD_SISTEMA;

        for (int i = historial.size() - 1; i >= 0; i--) {
            Mensaje mensaje = historial.get(i);
            int coste = estimarTokensTexto(mensaje.getContenido()) + 8;
            if (total + coste > presupuesto && !seleccionados.isEmpty()) {
                break;
            }
            seleccionados.add(0, mensaje);
            total += coste;
        }

        if (seleccionados.isEmpty()) {
            Mensaje ultimo = historial.get(historial.size() - 1);
            seleccionados.add(ultimo);
        }

        if (seleccionados.size() < historial.size()) {
            int omitidos = historial.size() - seleccionados.size();
            Mensaje aviso = new Mensaje();
            aviso.setRol("user");
            aviso.setContenido("[Nota: " + omitidos + " mensajes anteriores fueron omitidos automáticamente para mantener la conversación operativa.]");
            seleccionados.add(0, aviso);
        }

        return seleccionados;
    }

    public int contextoMaximoModelo(String nombreModelo, String provider) {
        if ("ollama".equals(provider) || provider == null || provider.isBlank()) {
            return contextoMaximoOllama(nombreModelo);
        }

        return switch (provider) {
            case "openai" -> nombreModelo != null && nombreModelo.contains("4.1") ? 1_047_576 : 128_000;
            case "anthropic" -> 200_000;
            case "google" -> nombreModelo != null && nombreModelo.contains("1.5-pro") ? 2_097_152 : 1_048_576;
            case "mistral" -> nombreModelo != null && nombreModelo.contains("codestral") ? 256_000 : 128_000;
            case "deepseek" -> 64_000;
            default -> 128_000;
        };
    }

    private int contextoMaximoOllama(String nombreModelo) {
        if (nombreModelo == null) {
            return 8192;
        }
        String nombre = nombreModelo.toLowerCase();
        if (nombre.contains("coder") || nombre.contains("qwen")) return 32_768;
        if (nombre.contains("phi3")) return 128_000;
        if (nombre.contains("gemma")) return 8192;
        if (nombre.contains("llama3")) return 128_000;
        if (nombre.contains("deepseek-coder")) return 64_000;
        if (nombre.contains("mistral")) return 32_768;
        return 8192;
    }

    private record ModeloContexto(String id, int contextoMaximo) {}
}
