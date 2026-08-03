package org.example.aulapersonal.chatAI;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.example.aulapersonal.chatAI.Conversacion.Conversacion;
import org.example.aulapersonal.chatAI.Conversacion.ConversacionRepository;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.example.aulapersonal.chatAI.Mensajes.MensajeRepository;
import org.example.aulapersonal.chatAI.providers.AiProvider;
import org.example.aulapersonal.chatAI.providers.ProviderRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ChatService {

    private final MensajeRepository mensajeRepository;
    private final ConversacionRepository conversacionRepository;
    private final ModelCatalog modelCatalog;
    private final ProviderRegistry providerRegistry;
    private final ContextManager contextManager;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${chat.ollama.base-url:http://127.0.0.1:11434}")
    private String ollamaBaseUrl;

    public ChatService(
            MensajeRepository mensajeRepository,
            ConversacionRepository conversacionRepository,
            ModelCatalog modelCatalog,
            ProviderRegistry providerRegistry,
            ContextManager contextManager) {
        this.mensajeRepository = mensajeRepository;
        this.conversacionRepository = conversacionRepository;
        this.modelCatalog = modelCatalog;
        this.providerRegistry = providerRegistry;
        this.contextManager = contextManager;
    }

    public List<Conversacion> listarConversaciones() {
        limpiarConversacionesVacias();
        return conversacionRepository.findAllByOrderByActualizadoEnDesc();
    }

    public int renombrarConversacionesPendientes() {
        List<Conversacion> conversaciones = conversacionRepository.findAllByOrderByActualizadoEnDesc();
        int renombradas = 0;
        for (Conversacion conversacion : conversaciones) {
            List<Mensaje> mensajes = mensajeRepository.findByConversacionIDOrderByCreadoEnAsc(conversacion.getId());
            if (mensajes.isEmpty() || !necesitaRenombrarTitulo(conversacion.getTitulo(), mensajes)) {
                continue;
            }
            String titulo = generarTituloDesdeHistorial(mensajes);
            if (titulo != null) {
                conversacion.setTitulo(titulo);
                conversacionRepository.save(conversacion);
                renombradas++;
            }
        }
        return renombradas;
    }

    private void limpiarConversacionesVacias() {
        conversacionRepository.findAll().forEach(conversacion -> {
            if (mensajeRepository.countByConversacionID(conversacion.getId()) == 0) {
                conversacionRepository.deleteById(conversacion.getId());
            }
        });
    }

    public boolean conversacionTieneMensajes(Long conversacionId) {
        return mensajeRepository.countByConversacionID(conversacionId) > 0;
    }

    public Optional<Conversacion> obtenerConversacion(Long id) {
        return conversacionRepository.findById(id).map(this::renombrarConversacionSiProvisional);
    }

    public Conversacion renombrarConversacionSiProvisional(Conversacion conversacion) {
        List<Mensaje> mensajes = mensajeRepository.findByConversacionIDOrderByCreadoEnAsc(conversacion.getId());
        if (mensajes.isEmpty() || !necesitaRenombrarTitulo(conversacion.getTitulo(), mensajes)) {
            return conversacion;
        }

        String titulo = generarTituloDesdeHistorial(mensajes);
        if (titulo == null) {
            return conversacion;
        }

        conversacion.setTitulo(titulo);
        return conversacionRepository.save(conversacion);
    }

    public Conversacion crearConversacion(String titulo, String configSnapshot) {
        Conversacion conversacion = new Conversacion();
        conversacion.setTitulo(titulo);
        conversacion.setConfigSnapshot(sanitizeConfigSnapshot(configSnapshot));
        return conversacionRepository.save(conversacion);
    }

    public boolean eliminarConversacion(Long id) {
        if (conversacionRepository.existsById(id)) {
            mensajeRepository.findByConversacionIDOrderByCreadoEnAsc(id)
                    .forEach(mensajeRepository::delete);
            conversacionRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public List<Mensaje> obtenerMensajes(Long conversacionId) {
        return mensajeRepository.findByConversacionIDOrderByCreadoEnAsc(conversacionId);
    }

    public Mensaje guardarMensaje(Long conversacionId, String rol, String contenido) {
        Mensaje mensaje = new Mensaje();
        mensaje.setConversacionID(conversacionId);
        mensaje.setRol(rol);
        mensaje.setContenido(contenido);
        mensaje = mensajeRepository.save(mensaje);

        conversacionRepository.findById(conversacionId).ifPresent(c -> {
            c.setActualizadoEn(LocalDateTime.now());
            conversacionRepository.save(c);
        });

        return mensaje;
    }

    public Map<String, Object> obtenerEstado() {
        List<String> modelosInstalados = listarNombresModelosOllama();
        Map<String, Object> ollama = new LinkedHashMap<>();
        ollama.put("online", !modelosInstalados.isEmpty() || pingOllama());
        ollama.put("baseUrl", ollamaBaseUrl);
        ollama.put("modelosInstalados", modelosInstalados);

        Map<String, Object> estado = new LinkedHashMap<>();
        estado.put("ollama", ollama);
        estado.put("proveedores", modelCatalog.listarProveedores());
        return estado;
    }

    public Map<String, Object> listarModelos(String ollamaEndpoint) {
        String endpoint = (ollamaEndpoint != null && !ollamaEndpoint.isBlank()) ? ollamaEndpoint : ollamaBaseUrl;
        List<Map<String, Object>> gratuitos = obtenerModelosOllama(endpoint);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("gratuitos", gratuitos);
        result.put("dePago", modelCatalog.listarModelosDePago());
        result.put("proveedoresDePago", modelCatalog.listarProveedoresDePago());
        return result;
    }

    public Map<String, Object> listarModelosRemotos(String provider, String apiKey, String endpoint) {
        Map<String, Object> result = new LinkedHashMap<>();
        String providerId = provider == null ? "" : provider.trim().toLowerCase();
        result.put("provider", providerId);
        result.put("ok", false);
        result.put("modelos", List.of());
        result.put("fuente", "ninguna");

        if (providerId.isBlank() || "ollama".equals(providerId)) {
            result.put("message", "Proveedor no válido para listado remoto");
            return result;
        }
        if (apiKey == null || apiKey.isBlank()) {
            result.put("message", "API key vacía");
            return result;
        }

        String endpointFinal = (endpoint != null && !endpoint.isBlank())
                ? endpoint
                : modelCatalog.endpointPorDefecto(providerId);
        if (endpointFinal == null || endpointFinal.isBlank()) {
            endpointFinal = defaultEndpointForProvider(providerId);
        }

        try {
            ChatRequestConfig config = ChatRequestConfig.of(
                    providerId,
                    defaultModelForProvider(providerId),
                    apiKey,
                    endpointFinal
            );
            AiProvider aiProvider = providerRegistry.resolve(providerId);
            List<Map<String, Object>> modelos = aiProvider.listarModelos(config);
            if (modelos == null || modelos.isEmpty()) {
                modelos = modelCatalog.listarModelosFallbackPorProveedor(providerId);
                result.put("fuente", "fallback");
                result.put("message", "No se obtuvieron modelos remotos; se usa catálogo local");
            } else {
                result.put("fuente", "remoto");
                result.put("message", "Modelos actualizados desde el proveedor");
            }
            result.put("ok", true);
            result.put("modelos", modelos);
            result.put("endpoint", endpointFinal);
        } catch (Exception e) {
            List<Map<String, Object>> fallback = modelCatalog.listarModelosFallbackPorProveedor(providerId);
            result.put("ok", !fallback.isEmpty());
            result.put("modelos", fallback);
            result.put("fuente", "fallback");
            result.put("endpoint", endpointFinal);
            result.put("message", "No se pudo listar modelos remotos: " + e.getMessage());
        }

        return result;
    }

    public Map<String, Object> pullModeloOllama(String model) throws Exception {
        String url = ollamaBaseUrl.replaceAll("/+$", "") + "/api/pull";
        String body = mapper.createObjectNode().put("name", model).put("stream", false).toString();

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("model", model);
        result.put("statusCode", response.statusCode());
        result.put("ok", response.statusCode() == 200);
        result.put("body", response.body());
        return result;
    }

    public Map<String, Object> validarApiKey(String provider, String apiKey, String model, String endpoint) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("provider", provider);
        result.put("valid", false);

        if (apiKey == null || apiKey.isBlank()) {
            result.put("message", "API key vacía");
            return result;
        }

        try {
            ChatRequestConfig config = ChatRequestConfig.of(
                    provider,
                    model != null && !model.isBlank() ? model : defaultModelForProvider(provider),
                    apiKey,
                    endpoint != null && !endpoint.isBlank() ? endpoint : defaultEndpointForProvider(provider)
            );

            Mensaje ping = new Mensaje();
            ping.setRol("user");
            ping.setContenido("Responde solo: OK");

            AiProvider aiProvider = providerRegistry.resolve(provider);
            String respuesta = aiProvider.completarChat(config, List.of(ping));
            boolean valid = respuesta != null && !respuesta.startsWith("Error");
            result.put("valid", valid);
            result.put("message", valid ? "API key válida" : respuesta);

            Map<String, Object> remoto = listarModelosRemotos(provider, apiKey, config.getEndpoint());
            result.put("modelos", remoto.getOrDefault("modelos", List.of()));
            result.put("fuenteModelos", remoto.getOrDefault("fuente", "ninguna"));
        } catch (Exception e) {
            result.put("message", "No se pudo validar: " + e.getMessage());
            Map<String, Object> remoto = listarModelosRemotos(provider, apiKey, endpoint);
            result.put("modelos", remoto.getOrDefault("modelos", List.of()));
            result.put("fuenteModelos", remoto.getOrDefault("fuente", "ninguna"));
        }

        return result;
    }

    public Map<String, Object> enviarMensajeAI(Long conversacionId, String contenido, String configJson) {
        guardarMensaje(conversacionId, "user", contenido);

        ChatRequestConfig config = parseConfig(configJson);
        List<Mensaje> historial = obtenerMensajes(conversacionId);

        ContextManager.PreparedContext preparacion = contextManager.preparar(
                config,
                historial,
                listarNombresModelosOllama()
        );

        String respuestaIA;
        String modeloUsado;
        var completion = completarChatConFallback(preparacion);
        respuestaIA = completion.respuesta();
        modeloUsado = completion.modeloUsado();

        Mensaje mensajeAsistente = guardarMensaje(conversacionId, "assistant", respuestaIA);

        List<Mensaje> historialParaTitulo = new ArrayList<>(historial);
        historialParaTitulo.add(mensajeAsistente);

        String titulo = null;
        if (!esRespuestaError(respuestaIA)) {
            titulo = generarTituloDescriptivoSiProvisional(conversacionId, historialParaTitulo);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("respuesta", respuestaIA);
        result.put("modeloResuelto", modeloUsado);
        result.put("contextoMaximo", contextManager.contextoMaximoModelo(modeloUsado, preparacion.config().getProvider()));
        result.put("tokensUsados", preparacion.tokensUsados());
        result.put("contextoRecortado", preparacion.historialRecortado());
        result.put("modoAuto", config.isModoAuto());
        if (titulo != null && !titulo.isBlank()) {
            result.put("titulo", titulo);
        }
        return result;
    }

    private record ChatCompletion(String respuesta, String modeloUsado) {}

    private ChatCompletion completarChatConFallback(ContextManager.PreparedContext preparacion) {
        List<String> instalados = listarNombresModelosOllama();

        if ("ollama".equals(preparacion.config().getProvider()) && instalados.isEmpty()) {
            return new ChatCompletion(
                    "No hay modelos Ollama instalados. Reinicia la app para descargarlos o ejecuta: ollama pull qwen2.5-coder:3b",
                    preparacion.modeloResuelto()
            );
        }

        List<String> modelosProbar = new ArrayList<>();
        modelosProbar.add(preparacion.modeloResuelto());
        for (String instalado : instalados) {
            if (!modelosProbar.contains(instalado)) {
                modelosProbar.add(instalado);
            }
        }

        String ultimoError = null;
        AiProvider provider = providerRegistry.resolve(preparacion.config().getProvider());

        for (String modelo : modelosProbar) {
            ChatRequestConfig configIntento = configurarIntentoModelo(preparacion, modelo);
            try {
                String respuesta = provider.completarChat(configIntento, preparacion.historial());
                if (respuesta != null && !respuesta.startsWith("Error")) {
                    return new ChatCompletion(respuesta, modelo);
                }
                if (respuesta != null && respuesta.contains("not found")) {
                    ultimoError = respuesta;
                    continue;
                }
                return new ChatCompletion(respuesta, modelo);
            } catch (Exception e) {
                ultimoError = "Error al conectar con la IA: " + e.getMessage();
            }
        }

        return new ChatCompletion(
                ultimoError != null
                        ? ultimoError
                        : "No se pudo obtener respuesta del modelo. Comprueba que Ollama esté activo.",
                preparacion.modeloResuelto()
        );
    }

    private ChatRequestConfig configurarIntentoModelo(ContextManager.PreparedContext preparacion, String modelo) {
        ChatRequestConfig origen = preparacion.config();
        ChatRequestConfig intento = ChatRequestConfig.of(
                origen.getProvider(),
                modelo,
                origen.getApiKey(),
                origen.getEndpoint()
        );
        if (origen.isTitleGeneration()) {
            return ChatRequestConfig.forTitleGeneration(intento);
        }
        return intento;
    }

    private ChatRequestConfig parseConfig(String configJson) {
        try {
            Map<String, Object> raw = mapper.readValue(configJson, Map.class);
            return ChatRequestConfig.fromMap(raw);
        } catch (Exception e) {
            return ChatRequestConfig.fromMap(Map.of(
                    "provider", "ollama",
                    "model", "qwen2.5-coder:3b",
                    "endpoint", ollamaBaseUrl
            ));
        }
    }

    private String sanitizeConfigSnapshot(String configSnapshot) {
        try {
            Map<String, Object> raw = mapper.readValue(configSnapshot, Map.class);
            raw.remove("apiKey");
            return mapper.writeValueAsString(ChatRequestConfig.fromMap(raw).toPersistedMap());
        } catch (Exception e) {
            return "{}";
        }
    }

    private String generarTituloDescriptivoSiProvisional(
            Long conversacionId,
            List<Mensaje> historial) {
        Optional<Conversacion> conversacionOpt = conversacionRepository.findById(conversacionId);
        if (conversacionOpt.isEmpty() || !tieneMensajeUsuario(historial)) {
            return null;
        }

        Conversacion conversacion = conversacionOpt.get();
        if (!necesitaRenombrarTitulo(conversacion.getTitulo(), historial)) {
            return null;
        }

        String tituloGenerado = generarTituloDesdeHistorial(historial);
        if (tituloGenerado == null) {
            return null;
        }

        conversacion.setTitulo(tituloGenerado);
        conversacionRepository.save(conversacion);
        return tituloGenerado;
    }

    private String generarTituloDesdeHistorial(List<Mensaje> historial) {
        if (!tieneMensajeUsuario(historial)) {
            return null;
        }

        String tituloGenerado = solicitarTituloDescriptivo(historial);
        if (esTituloValido(tituloGenerado)) {
            return tituloGenerado;
        }

        tituloGenerado = solicitarTituloDesdeMensajeInicial(historial);
        if (esTituloValido(tituloGenerado)) {
            return tituloGenerado;
        }

        return null;
    }

    private boolean esTituloValido(String titulo) {
        return titulo != null && !titulo.isBlank() && !tituloEsProvisional(titulo);
    }

    private boolean necesitaRenombrarTitulo(String titulo, List<Mensaje> mensajes) {
        return tituloEsProvisional(titulo) || tituloParecePrimerMensaje(titulo, mensajes);
    }

    private boolean tituloParecePrimerMensaje(String titulo, List<Mensaje> historial) {
        String primerMensaje = obtenerPrimerMensajeUsuario(historial);
        if (primerMensaje == null || titulo == null || titulo.isBlank()) {
            return false;
        }

        String tituloNorm = normalizarTexto(titulo);
        String mensajeNorm = normalizarTexto(primerMensaje);

        if (tituloNorm.equals(mensajeNorm)) {
            return true;
        }

        String mensajeTruncado = normalizarTexto(truncarTexto(primerMensaje, 59) + "…");
        if (tituloNorm.equals(mensajeTruncado)) {
            return true;
        }

        if (mensajeNorm.startsWith(tituloNorm) && tituloNorm.length() >= 12) {
            return true;
        }

        if (tituloNorm.startsWith(mensajeNorm.substring(0, Math.min(mensajeNorm.length(), 20)))
                && tituloNorm.length() <= mensajeNorm.length()) {
            return true;
        }

        return false;
    }

    private String obtenerPrimerMensajeUsuario(List<Mensaje> historial) {
        return historial.stream()
                .filter(m -> "user".equals(m.getRol()))
                .map(Mensaje::getContenido)
                .filter(c -> c != null && !c.isBlank())
                .findFirst()
                .orElse(null);
    }

    private String normalizarTexto(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replaceAll("\\s+", " ").trim().toLowerCase();
    }

    private boolean tieneMensajeUsuario(List<Mensaje> historial) {
        return historial.stream()
                .anyMatch(m -> "user".equals(m.getRol()) && m.getContenido() != null && !m.getContenido().isBlank());
    }

    private boolean esRespuestaError(String respuesta) {
        if (respuesta == null || respuesta.isBlank()) {
            return true;
        }
        String texto = respuesta.trim();
        return texto.startsWith("Error")
                || texto.startsWith("No hay modelos Ollama")
                || texto.startsWith("No se pudo obtener respuesta");
    }

    private boolean tituloEsProvisional(String titulo) {
        if (titulo == null || titulo.isBlank()) {
            return true;
        }
        String normalizado = titulo.trim().toLowerCase();
        return normalizado.startsWith("nueva convers")
                || normalizado.equals("conversación")
                || normalizado.equals("conversacion")
                || normalizado.equals("sin título")
                || normalizado.equals("sin titulo")
                || normalizado.startsWith("escribe un mensaje");
    }

    private String solicitarTituloDescriptivo(List<Mensaje> historial) {
        List<Mensaje> historialUtil = historialSinErrores(historial);
        if (historialUtil.isEmpty()) {
            historialUtil = historial;
        }

        Mensaje prompt = new Mensaje();
        prompt.setRol("user");
        prompt.setContenido(
                "Escribe un título breve (3-5 palabras) que resuma el tema de esta conversación.\n"
                        + "Debe ser descriptivo, como el nombre de un hilo de chat: sustantivos y conceptos clave, "
                        + "sin saludos, sin preguntas literales y sin copiar frases del usuario.\n"
                        + "Ejemplos: \"Ecuaciones de segundo grado\", \"Harness en Minecraft\", \"NullPointer en Java\".\n"
                        + "Responde SOLO con el título, sin comillas ni puntuación final.\n\n"
                        + "Conversación:\n"
                        + construirContextoParaTitulo(historialUtil)
        );

        return completarTituloConLlm(prompt);
    }

    private String solicitarTituloDesdeMensajeInicial(List<Mensaje> historial) {
        String primerMensaje = obtenerPrimerMensajeUsuario(historial);
        if (primerMensaje == null) {
            return null;
        }

        Mensaje prompt = new Mensaje();
        prompt.setRol("user");
        prompt.setContenido(
                "El usuario abrió un chat con este mensaje:\n\""
                        + truncarTexto(primerMensaje, 400)
                        + "\"\n\n"
                        + "Genera un título breve (3-5 palabras) que describa el tema, no copies el mensaje.\n"
                        + "Responde SOLO con el título, sin comillas ni puntuación final."
        );

        return completarTituloConLlm(prompt);
    }

    private String completarTituloConLlm(Mensaje prompt) {
        ChatRequestConfig titleConfig = configParaGeneracionTitulo();
        ContextManager.PreparedContext preparacion = new ContextManager.PreparedContext(
                titleConfig,
                List.of(prompt),
                0,
                contextManager.contextoMaximoModelo(titleConfig.getModel(), "ollama"),
                titleConfig.getModel(),
                false
        );

        ChatCompletion completion = completarChatConFallback(preparacion);
        return limpiarTituloGenerado(completion.respuesta());
    }

    private List<Mensaje> historialSinErrores(List<Mensaje> historial) {
        List<Mensaje> filtrado = new ArrayList<>();
        for (Mensaje mensaje : historial) {
            if ("assistant".equals(mensaje.getRol())
                    && mensaje.getContenido() != null
                    && mensaje.getContenido().trim().startsWith("Error")) {
                continue;
            }
            filtrado.add(mensaje);
        }
        return filtrado;
    }

    private ChatRequestConfig configParaGeneracionTitulo() {
        List<String> instalados = listarNombresModelosOllama();
        String modelo = contextManager.resolverModeloInstalado("qwen2.5-coder:1.5b", instalados);
        return ChatRequestConfig.forTitleGeneration(
                ChatRequestConfig.of("ollama", modelo, "", ollamaBaseUrl)
        );
    }

    private String construirContextoParaTitulo(List<Mensaje> historial) {
        StringBuilder contexto = new StringBuilder();
        int mensajesIncluidos = 0;
        for (Mensaje mensaje : historial) {
            if (mensajesIncluidos >= 6) {
                break;
            }
            String rol = "user".equals(mensaje.getRol()) ? "Usuario" : "Asistente";
            contexto.append(rol)
                    .append(": ")
                    .append(truncarTexto(mensaje.getContenido(), 300))
                    .append('\n');
            mensajesIncluidos++;
        }
        return contexto.toString().trim();
    }

    private String limpiarTituloGenerado(String raw) {
        if (raw == null) {
            return null;
        }

        String titulo = raw.trim();
        if (titulo.isBlank() || titulo.startsWith("Error")) {
            return null;
        }

        titulo = titulo.replaceAll("(?s)```.*?```", " ");
        titulo = titulo.replaceAll("`+", "");
        titulo = titulo.replaceAll("^[\"'«»]+|[\"'«»]+$", "");
        titulo = titulo.replaceFirst("(?i)^t[ií]tulo:\\s*", "");
        titulo = titulo.split("\\R", 2)[0].trim();
        titulo = titulo.replaceAll("[.!?…]+$", "").trim();
        titulo = titulo.replaceAll("\\s+", " ");

        if (titulo.contains(":")) {
            String partePrincipal = titulo.substring(0, titulo.indexOf(':')).trim();
            if (partePrincipal.split("\\s+").length >= 2) {
                titulo = partePrincipal;
            }
        }

        if (titulo.isBlank() || tituloEsProvisional(titulo)) {
            return null;
        }

        String[] palabras = titulo.split("\\s+");
        if (palabras.length > 6) {
            titulo = String.join(" ", java.util.Arrays.copyOf(palabras, 6));
        }

        if (titulo.length() > 50) {
            titulo = titulo.substring(0, 49).trim();
        }

        return titulo;
    }

    private String truncarTexto(String texto, int maximo) {
        if (texto == null || texto.length() <= maximo) {
            return texto;
        }
        return texto.substring(0, maximo - 1) + "…";
    }

    private boolean pingOllama() {
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ollamaBaseUrl.replaceAll("/+$", "") + "/api/tags"))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    private List<String> listarNombresModelosOllama() {
        List<Map<String, Object>> modelos = obtenerModelosOllama(ollamaBaseUrl);
        return modelos.stream().map(m -> String.valueOf(m.get("id"))).toList();
    }

    private List<Map<String, Object>> obtenerModelosOllama(String endpoint) {
        List<Map<String, Object>> modelos = new ArrayList<>();
        String baseUrl = (endpoint != null && !endpoint.isBlank())
                ? endpoint.replaceAll("/+$", "")
                : ollamaBaseUrl.replaceAll("/+$", "");

        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/tags"))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return modelos;
            }

            JsonNode root = mapper.readTree(response.body());
            JsonNode modelsNode = root.get("models");
            if (modelsNode == null || !modelsNode.isArray()) {
                return modelos;
            }

            for (JsonNode modelNode : modelsNode) {
                String nombre = modelNode.has("name") ? modelNode.get("name").asText() : null;
                if (nombre == null || nombre.isBlank()) continue;
                Map<String, Object> modelo = new LinkedHashMap<>();
                modelo.put("id", nombre);
                modelo.put("nombre", nombreLegibleOllama(nombre));
                modelo.put("provider", "ollama");
                modelo.put("endpoint", baseUrl);
                modelo.put("requiereApiKey", false);
                modelo.put("contextoMaximo", contextManager.contextoMaximoModelo(nombre, "ollama"));
                modelos.add(modelo);
            }
        } catch (Exception ignored) {
            // Ollama no disponible
        }

        return modelos;
    }

    private String nombreLegibleOllama(String id) {
        if (id == null) return "Modelo local";
        return switch (id) {
            case "qwen2.5-coder:0.5b" -> "Qwen2.5 Coder 0.5B";
            case "qwen2.5-coder:1.5b" -> "Qwen2.5 Coder 1.5B";
            case "qwen2.5-coder:3b" -> "Qwen2.5 Coder 3B";
            case "qwen2.5-coder:7b" -> "Qwen2.5 Coder 7B";
            case "qwen2.5-coder:14b" -> "Qwen2.5 Coder 14B";
            case "qwen2.5-coder:32b" -> "Qwen2.5 Coder 32B";
            default -> id.contains("coder") ? id.replace(":", " · ") : id;
        };
    }

    private String defaultModelForProvider(String provider) {
        return switch (provider) {
            case "anthropic" -> "claude-3-5-haiku-20241022";
            case "google" -> "gemini-2.0-flash";
            case "mistral" -> "mistral-large-latest";
            case "deepseek" -> "deepseek-chat";
            case "openai" -> "gpt-4o-mini";
            default -> "gpt-4o-mini";
        };
    }

    private String defaultEndpointForProvider(String provider) {
        return switch (provider) {
            case "anthropic" -> "https://api.anthropic.com/v1";
            case "google" -> "https://generativelanguage.googleapis.com/v1beta/openai";
            case "mistral" -> "https://api.mistral.ai/v1";
            case "deepseek" -> "https://api.deepseek.com/v1";
            case "openai" -> "https://api.openai.com/v1";
            default -> "https://api.openai.com/v1";
        };
    }
}
