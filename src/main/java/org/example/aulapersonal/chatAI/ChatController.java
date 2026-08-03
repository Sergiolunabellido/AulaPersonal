package org.example.aulapersonal.chatAI;

import org.example.aulapersonal.chatAI.Conversacion.Conversacion;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/status")
    public Map<String, Object> obtenerEstado() {
        return chatService.obtenerEstado();
    }

    @GetMapping("/models")
    public Map<String, Object> listarModelos(
            @RequestParam(required = false) String ollamaEndpoint) {
        return chatService.listarModelos(ollamaEndpoint);
    }

    @PostMapping("/ollama/pull")
    public ResponseEntity<Map<String, Object>> pullModeloOllama(@RequestBody Map<String, String> body) {
        String model = body.getOrDefault("model", "").trim();
        if (model.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            return ResponseEntity.ok(chatService.pullModeloOllama(model));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("ok", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/keys/validate")
    public Map<String, Object> validarApiKey(@RequestBody Map<String, String> body) {
        return chatService.validarApiKey(
                body.getOrDefault("provider", ""),
                body.getOrDefault("apiKey", ""),
                body.getOrDefault("model", ""),
                body.getOrDefault("endpoint", "")
        );
    }

    @PostMapping("/models/remote")
    public Map<String, Object> listarModelosRemotos(@RequestBody Map<String, String> body) {
        return chatService.listarModelosRemotos(
                body.getOrDefault("provider", ""),
                body.getOrDefault("apiKey", ""),
                body.getOrDefault("endpoint", "")
        );
    }

    @GetMapping("/sessions")
    public List<Conversacion> listarSesiones() {
        return chatService.listarConversaciones();
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<Map<String, Object>> obtenerSesion(@PathVariable Long id) {
        return chatService.obtenerConversacion(id)
                .map(conv -> {
                    List<Mensaje> mensajes = chatService.obtenerMensajes(id);
                    if (mensajes.isEmpty()) {
                        chatService.eliminarConversacion(id);
                        return ResponseEntity.notFound().<Map<String, Object>>build();
                    }
                    return ResponseEntity.ok(Map.of(
                            "conversacion", conv,
                            "mensajes", mensajes
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/sessions/renombrar-pendientes")
    public Map<String, Object> renombrarConversacionesPendientes() {
        int renombradas = chatService.renombrarConversacionesPendientes();
        return Map.of("renombradas", renombradas);
    }

    @PostMapping("/sessions")
    public ResponseEntity<Conversacion> crearSesion(@RequestBody Map<String, String> body) {
        String titulo = body.getOrDefault("titulo", "").trim();
        String configSnapshot = body.getOrDefault("configSnapshot", "{}");
        if (titulo.isEmpty() || esTituloProvisionalEntrada(titulo)) {
            titulo = "";
        }
        Conversacion conv = chatService.crearConversacion(titulo, configSnapshot);
        return ResponseEntity.status(HttpStatus.CREATED).body(conv);
    }

    private boolean esTituloProvisionalEntrada(String titulo) {
        String normalizado = titulo.trim().toLowerCase();
        return normalizado.startsWith("nueva convers");
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> eliminarSesion(@PathVariable Long id) {
        return chatService.eliminarConversacion(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @GetMapping("/sessions/{id}/messages")
    public ResponseEntity<List<Mensaje>> obtenerMensajes(@PathVariable Long id) {
        if (chatService.obtenerConversacion(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(chatService.obtenerMensajes(id));
    }

    @PostMapping("/sessions/{id}/messages")
    public ResponseEntity<Map<String, Object>> enviarMensaje(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String contenido = body.getOrDefault("contenido", "").trim();
        String configJson = body.getOrDefault("configSnapshot", "{}");
        if (contenido.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        if (chatService.obtenerConversacion(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> resultado = chatService.enviarMensajeAI(id, contenido, configJson);
        List<Mensaje> mensajes = chatService.obtenerMensajes(id);

        Map<String, Object> response = new java.util.LinkedHashMap<>(resultado);
        response.put("mensajes", mensajes);
        return ResponseEntity.ok(response);
    }
}
