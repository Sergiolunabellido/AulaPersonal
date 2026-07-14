# AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Chat page with config screen, chat interface, history sidebar, and backend proxy to Ollama/Custom API.

**Architecture:** Backend proxy via Spring Boot (new `chatAI/` package) — frontend calls REST API, backend proxies to Ollama or user's custom OpenAI-compatible endpoint. Config stored in localStorage. Chat sessions + messages persisted in H2.

**Tech Stack:** Spring Boot 4.0.6/Java 17, JPA/H2, Electron, Vanilla JS, Tailwind CSS CDN

## Global Constraints
- Follow existing patterns in `notas/` package (entity → repository → service → controller)
- Use Spanish naming as already established (Conversacion, Mensajes)
- All frontend scripts use IIFE + `'use strict'`
- Communication via `fetch()` to `localhost:8080`
- Config stored in `localStorage` key `chat-config`

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main/java/org/example/aulapersonal/chatAI/Conversacion/Conversacion.java` | Entity — chat session with config snapshot |
| `src/main/java/org/example/aulapersonal/chatAI/Conversacion/ConversacionRepository.java` | JPA repo for sessions |
| `src/main/java/org/example/aulapersonal/chatAI/Mensajes/Mensaje.java` | Entity — individual message (user/assistant) |
| `src/main/java/org/example/aulapersonal/chatAI/Mensajes/MensajeRepository.java` | JPA repo for messages |
| `src/main/java/org/example/aulapersonal/chatAI/ChatService.java` | Business logic — CRUD + proxy to AI |
| `src/main/java/org/example/aulapersonal/chatAI/ChatController.java` | REST endpoints |
| `electron/renderer/chatAI/chat.html` | Config view + chat view HTML |
| `electron/renderer/chatAI/functionChat.js` | All frontend logic |
| `electron/renderer/index.js` | Route `chatIA` → `'chatAI/chat.html'` |

---

### Task 1: Fix and Enhance Backend Entities

**Files:**
- Modify: `src/main/java/org/example/aulapersonal/chatAI/Conversacion/Conversacion.java`
- Modify: `src/main/java/org/example/aulapersonal/chatAI/Mensajes/Mensaje.java`

**Interfaces:**
- Consumes: nothing (standalone entities)
- Produces: `Conversacion` entity with getters/setters including `configSnapshot`, `Mensaje` entity with getters/setters

- [ ] **Step 1: Fix Conversacion.java** — remove static `getId()` bug, add `configSnapshot` field

```java
package org.example.aulapersonal.chatAI.Conversacion;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "conversacion")
public class Conversacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String configSnapshot;

    @Column(nullable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(nullable = false)
    private LocalDateTime actualizadoEn;

    @PrePersist
    public void crearConversacion() {
        this.creadoEn = LocalDateTime.now();
        this.actualizadoEn = LocalDateTime.now();
    }

    @PreUpdate
    public void actualizarConversacion() {
        this.actualizadoEn = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getConfigSnapshot() { return configSnapshot; }
    public void setConfigSnapshot(String configSnapshot) { this.configSnapshot = configSnapshot; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public LocalDateTime getActualizadoEn() { return actualizadoEn; }
}
```

- [ ] **Step 2: Fix Mensaje.java** — add getters/setters (currently missing)

```java
package org.example.aulapersonal.chatAI.Mensajes;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mensaje")
public class Mensaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long conversacionID;

    @Column(nullable = false)
    private String rol;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String contenido;

    @Column(nullable = false, updatable = false)
    private LocalDateTime creadoEn;

    @PrePersist
    public void crearMensaje() {
        creadoEn = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversacionID() { return conversacionID; }
    public void setConversacionID(Long conversacionID) { this.conversacionID = conversacionID; }
    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }
    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
}
```

- [ ] **Step 3: Run Gradle build to verify compilation**

Run: `.\gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add src/main/java/org/example/aulapersonal/chatAI/
git commit -m "feat(chat): fix entities, add configSnapshot field and missing getters/setters"
```

---

### Task 2: Complete ChatService — CRUD + AI Proxy

**Files:**
- Modify: `src/main/java/org/example/aulapersonal/chatAI/ChatService.java`

**Interfaces:**
- Consumes: `ConversacionRepository`, `MensajeRepository`
- Produces: `listarConversaciones()`, `crearConversacion(titulo, configSnapshot)`, `obtenerMensajes(conversacionId)`, `enviarMensaje(conversacionId, contenido, config)` → returns AI response text

- [ ] **Step 1: Rewrite ChatService.java** with complete implementation

```java
package org.example.aulapersonal.chatAI;

import org.example.aulapersonal.chatAI.Conversacion.Conversacion;
import org.example.aulapersonal.chatAI.Conversacion.ConversacionRepository;
import org.example.aulapersonal.chatAI.Mensajes.Mensaje;
import org.example.aulapersonal.chatAI.Mensajes.MensajeRepository;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Optional;

@Service
public class ChatService {

    private final MensajeRepository mensajeRepository;
    private final ConversacionRepository conversacionRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public ChatService(MensajeRepository mensajeRepository, ConversacionRepository conversacionRepository) {
        this.mensajeRepository = mensajeRepository;
        this.conversacionRepository = conversacionRepository;
    }

    public List<Conversacion> listarConversaciones() {
        return conversacionRepository.findAllByOrderByActualizadoEnDesc();
    }

    public Optional<Conversacion> obtenerConversacion(Long id) {
        return conversacionRepository.findById(id);
    }

    public Conversacion crearConversacion(String titulo, String configSnapshot) {
        Conversacion conversacion = new Conversacion();
        conversacion.setTitulo(titulo);
        conversacion.setConfigSnapshot(configSnapshot);
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
            c.setActualizadoEn(java.time.LocalDateTime.now());
            conversacionRepository.save(c);
        });

        return mensaje;
    }

    public String enviarMensajeAI(Long conversacionId, String contenido, String configJson) {
        guardarMensaje(conversacionId, "user", contenido);

        java.util.Map<String, Object> config = new java.util.HashMap<>();
        config.put("provider", "ollama");
        config.put("model", "llama3");
        try {
            config = mapper.readValue(configJson, java.util.Map.class);
        } catch (Exception e) {
            // use defaults
        }

        String provider = (String) config.getOrDefault("provider", "ollama");
        String model = (String) config.getOrDefault("model", "llama3");
        String apiKey = (String) config.getOrDefault("apiKey", "");
        String endpoint = (String) config.getOrDefault("endpoint", "http://localhost:11434");
        String nivel = (String) config.getOrDefault("nivel", "medium");
        String tipoModelo = (String) config.getOrDefault("tipoModelo", "general");
        String tipoTrabajo = (String) config.getOrDefault("tipoTrabajo", "general");

        List<Mensaje> historial = obtenerMensajes(conversacionId);

        String respuestaIA = llamarAPI(provider, model, apiKey, endpoint, nivel, tipoModelo, tipoTrabajo, historial);

        Mensaje assistantMsg = guardarMensaje(conversacionId, "assistant", respuestaIA);

        return respuestaIA;
    }

    private String llamarAPI(String provider, String model, String apiKey, String endpoint,
                             String nivel, String tipoModelo, String tipoTrabajo,
                             List<Mensaje> historial) {

        StringBuilder systemPrompt = new StringBuilder();
        systemPrompt.append("Eres un asistente AI útil. ");
        systemPrompt.append("Nivel: ").append(nivel).append(". ");
        systemPrompt.append("Tipo de modelo: ").append(tipoModelo).append(". ");
        systemPrompt.append("Tipo de trabajo: ").append(tipoTrabajo).append(".");

        try {
            if ("ollama".equals(provider)) {
                return llamarOllama(model, endpoint, systemPrompt.toString(), historial);
            } else {
                return llamarCustomOpenAI(model, apiKey, endpoint, systemPrompt.toString(), historial);
            }
        } catch (Exception e) {
            return "Error al conectar con la IA: " + e.getMessage();
        }
    }

    private String llamarOllama(String model, String endpoint, String systemPrompt, List<Mensaje> historial) throws Exception {
        String baseUrl = endpoint.replaceAll("/+$", "");
        String url = baseUrl + "/api/chat";

        ArrayNode messages = mapper.createArrayNode();

        ObjectNode systemNode = mapper.createObjectNode();
        systemNode.put("role", "system");
        systemNode.put("content", systemPrompt);
        messages.add(systemNode);

        for (Mensaje m : historial) {
            ObjectNode node = mapper.createObjectNode();
            node.put("role", m.getRol());
            node.put("content", m.getContenido());
            messages.add(node);
        }

        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.set("messages", messages);
        body.put("stream", false);

        String jsonBody = mapper.writeValueAsString(body);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            return "Error Ollama (" + response.statusCode() + "): " + response.body();
        }

        com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(response.body());
        return root.get("message").get("content").asText();
    }

    private String llamarCustomOpenAI(String model, String apiKey, String endpoint, String systemPrompt, List<Mensaje> historial) throws Exception {
        String baseUrl = endpoint.replaceAll("/+$", "");
        String url;
        if (baseUrl.endsWith("/v1")) {
            url = baseUrl + "/chat/completions";
        } else if (baseUrl.endsWith("/v1/chat/completions")) {
            url = baseUrl;
        } else {
            url = baseUrl + "/v1/chat/completions";
        }

        ArrayNode messages = mapper.createArrayNode();

        ObjectNode systemNode = mapper.createObjectNode();
        systemNode.put("role", "system");
        systemNode.put("content", systemPrompt);
        messages.add(systemNode);

        for (Mensaje m : historial) {
            ObjectNode node = mapper.createObjectNode();
            node.put("role", m.getRol());
            node.put("content", m.getContenido());
            messages.add(node);
        }

        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.set("messages", messages);

        String jsonBody = mapper.writeValueAsString(body);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json");

        if (apiKey != null && !apiKey.isEmpty()) {
            builder.header("Authorization", "Bearer " + apiKey);
        }

        HttpRequest request = builder
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            return "Error API (" + response.statusCode() + "): " + response.body();
        }

        com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(response.body());
        return root.get("choices").get(0).get("message").get("content").asText();
    }
}
```

- [ ] **Step 2: Run Gradle build to verify compilation**

Run: `.\gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/main/java/org/example/aulapersonal/chatAI/ChatService.java
git commit -m "feat(chat): complete ChatService with Ollama and Custom API proxy"
```

---

### Task 3: Create ChatController (REST Endpoints)

**Files:**
- Create: `src/main/java/org/example/aulapersonal/chatAI/ChatController.java`

**Interfaces:**
- Consumes: `ChatService`
- Produces: REST endpoints at `/api/chat/...`

- [ ] **Step 1: Create ChatController.java**

```java
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

    @GetMapping("/sessions")
    public List<Conversacion> listarSesiones() {
        return chatService.listarConversaciones();
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<Map<String, Object>> obtenerSesion(@PathVariable Long id) {
        return chatService.obtenerConversacion(id)
                .map(conv -> {
                    List<Mensaje> mensajes = chatService.obtenerMensajes(id);
                    return ResponseEntity.ok(Map.of(
                            "conversacion", conv,
                            "mensajes", mensajes
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/sessions")
    public ResponseEntity<Conversacion> crearSesion(@RequestBody Map<String, String> body) {
        String titulo = body.getOrDefault("titulo", "Nueva conversación").trim();
        String configSnapshot = body.getOrDefault("configSnapshot", "{}");
        if (titulo.isEmpty()) titulo = "Nueva conversación";
        Conversacion conv = chatService.crearConversacion(titulo, configSnapshot);
        return ResponseEntity.status(HttpStatus.CREATED).body(conv);
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

        String respuesta = chatService.enviarMensajeAI(id, contenido, configJson);
        List<Mensaje> mensajes = chatService.obtenerMensajes(id);

        return ResponseEntity.ok(Map.of(
                "respuesta", respuesta,
                "mensajes", mensajes
        ));
    }
}
```

- [ ] **Step 2: Run Gradle build to verify compilation**

Run: `.\gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/main/java/org/example/aulapersonal/chatAI/ChatController.java
git commit -m "feat(chat): add ChatController REST endpoints"
```

---

### Task 4: Frontend — Config View + Chat View HTML

**Files:**
- Modify: `electron/renderer/chatAI/chat.html`

**Interfaces:**
- Consumes: `functionChat.js` functions
- Produces: HTML with two views (config and chat) toggled by visibility

- [ ] **Step 1: Replace chat.html** with full config + chat views

```html
<div id="chatAI-config" class="max-w-2xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">AI Chat Configuration</h1>

  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-1">Provider</label>
      <div class="flex gap-2">
        <button id="provider-ollama" class="config-btn provider-btn px-4 py-2 rounded-md border transition-colors" onclick="window.ajustarProvider('ollama')">Ollama (Local)</button>
        <button id="provider-custom" class="config-btn provider-btn px-4 py-2 rounded-md border transition-colors" onclick="window.ajustarProvider('custom')">Custom API</button>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Model</label>
      <select id="config-model" class="w-full p-2 border rounded-md bg-white">
        <option value="llama3">Llama 3</option>
        <option value="mistral">Mistral</option>
        <option value="codellama">CodeLlama</option>
        <option value="phi">Phi</option>
        <option value="gemma">Gemma</option>
      </select>
    </div>

    <div id="custom-api-fields" class="hidden space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">API Key</label>
        <input id="config-apikey" type="password" class="w-full p-2 border rounded-md" placeholder="sk-...">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Endpoint URL</label>
        <input id="config-endpoint" type="text" class="w-full p-2 border rounded-md" placeholder="https://api.openai.com/v1">
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Model Level</label>
      <div class="flex gap-2">
        <button class="level-btn px-4 py-2 rounded-md border transition-colors" data-value="low" onclick="window.ajustarNivel('low', this)">Low</button>
        <button class="level-btn px-4 py-2 rounded-md border transition-colors bg-blue-600 text-white" data-value="medium" onclick="window.ajustarNivel('medium', this)">Medium</button>
        <button class="level-btn px-4 py-2 rounded-md border transition-colors" data-value="high" onclick="window.ajustarNivel('high', this)">High</button>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Model Type</label>
      <div class="flex flex-wrap gap-2">
        <button class="type-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="analyst" onclick="window.ajustarTipoModelo('analyst', this)">Analyst</button>
        <button class="type-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="generative" onclick="window.ajustarTipoModelo('generative', this)">Generative</button>
        <button class="type-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="creative" onclick="window.ajustarTipoModelo('creative', this)">Creative</button>
        <button class="type-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="logical" onclick="window.ajustarTipoModelo('logical', this)">Logical</button>
        <input id="config-tipoModelo-custom" type="text" class="p-1.5 border rounded-md text-sm w-32" placeholder="Custom..." onchange="window.ajustarTipoModelo(this.value, null)">
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Work Type</label>
      <div class="flex flex-wrap gap-2">
        <button class="work-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="code" onclick="window.ajustarTipoTrabajo('code', this)">Code</button>
        <button class="work-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="study" onclick="window.ajustarTipoTrabajo('study', this)">Study</button>
        <button class="work-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="brainstorm" onclick="window.ajustarTipoTrabajo('brainstorm', this)">Brainstorm</button>
        <button class="work-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="general" onclick="window.ajustarTipoTrabajo('general', this)">General</button>
        <button class="work-btn px-3 py-1.5 rounded-md border text-sm transition-colors" data-value="plan" onclick="window.ajustarTipoTrabajo('plan', this)">Plan</button>
        <input id="config-tipoTrabajo-custom" type="text" class="p-1.5 border rounded-md text-sm w-32" placeholder="Custom..." onchange="window.ajustarTipoTrabajo(this.value, null)">
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Theme</label>
      <div class="flex gap-2">
        <button class="theme-btn px-4 py-2 rounded-md border transition-colors" data-value="light" onclick="window.ajustarTema('light', this)">☀️ Light</button>
        <button class="theme-btn px-4 py-2 rounded-md border transition-colors" data-value="dark" onclick="window.ajustarTema('dark', this)">🌙 Dark</button>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Accent Color</label>
      <div class="flex gap-2 items-center">
        <input id="config-accent" type="color" value="#2563eb" class="w-10 h-10 rounded cursor-pointer" onchange="window.ajustarColorAcento(this.value)">
        <span id="config-accent-label" class="text-sm text-gray-500">#2563eb</span>
      </div>
    </div>

    <button onclick="window.guardarConfigYIniciar()" class="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium mt-4">
      Save & Start Chat
    </button>
  </div>
</div>

<div id="chatAI-chat" class="hidden h-full flex">
  <div id="chat-sidebar" class="w-64 border-r border-gray-300 flex flex-col bg-gray-50 shrink-0">
    <div class="p-3 border-b border-gray-300">
      <button onclick="window.nuevaSesion()" class="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
        + New Chat
      </button>
    </div>
    <div id="chat-historial" class="flex-1 overflow-y-auto p-2 space-y-1">
    </div>
    <div class="p-3 border-t border-gray-300">
      <button onclick="window.mostrarConfig()" class="w-full py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-center gap-1">
        ⚙️ Settings
      </button>
    </div>
  </div>

  <div id="chat-main" class="flex-1 flex flex-col">
    <div id="chat-mensajes" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div class="text-center text-gray-400 mt-20">
        <p class="text-lg">Select a conversation or start a new one</p>
      </div>
    </div>
    <div id="chat-input-area" class="border-t border-gray-300 p-4">
      <div class="flex gap-2">
        <textarea id="chat-input" class="flex-1 p-2 border rounded-md resize-none" rows="2" placeholder="Type your message..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window.enviarMensaje()}"></textarea>
        <button onclick="window.enviarMensaje()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors self-end">
          Send
        </button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/chatAI/chat.html
git commit -m "feat(chat): add config and chat HTML views"
```

---

### Task 5: Frontend — Complete functionChat.js

**Files:**
- Modify: `electron/renderer/chatAI/functionChat.js`

**Interfaces:**
- Consumes: REST API at `http://localhost:8080/api/chat/...`
- Produces: All chat and config logic

- [ ] **Step 1: Write functionChat.js** with all logic

```javascript
(function() {
    'use strict';

    const API_BASE = 'http://localhost:8080/api/chat';

    let config = {
        provider: 'ollama',
        model: 'llama3',
        apiKey: '',
        endpoint: 'http://localhost:11434',
        nivel: 'medium',
        tipoModelo: 'general',
        tipoTrabajo: 'general',
        tema: 'light',
        colorAcento: '#2563eb'
    };

    let sesionActiva = null;

    function cargarConfig() {
        const guardada = localStorage.getItem('chat-config');
        if (guardada) {
            try {
                config = { ...config, ...JSON.parse(guardada) };
            } catch(e) {}
        }
    }

    function guardarConfigStorage() {
        localStorage.setItem('chat-config', JSON.stringify(config));
    }

    window.ajustarProvider = function(provider) {
        config.provider = provider;
        document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
        document.getElementById('provider-' + provider).classList.add('bg-blue-600', 'text-white');
        document.getElementById('custom-api-fields').classList.toggle('hidden', provider !== 'custom');
        guardarConfigStorage();
    };

    window.ajustarNivel = function(nivel, btn) {
        config.nivel = nivel;
        document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
        if (btn) btn.classList.add('bg-blue-600', 'text-white');
        guardarConfigStorage();
    };

    window.ajustarTipoModelo = function(tipo, btn) {
        config.tipoModelo = tipo;
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
        if (btn) btn.classList.add('bg-blue-600', 'text-white');
        guardarConfigStorage();
    };

    window.ajustarTipoTrabajo = function(tipo, btn) {
        config.tipoTrabajo = tipo;
        document.querySelectorAll('.work-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
        if (btn) btn.classList.add('bg-blue-600', 'text-white');
        guardarConfigStorage();
    };

    window.ajustarTema = function(tema, btn) {
        config.tema = tema;
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
        if (btn) btn.classList.add('bg-blue-600', 'text-white');
        aplicarTema();
        guardarConfigStorage();
    };

    window.ajustarColorAcento = function(color) {
        config.colorAcento = color;
        document.getElementById('config-accent-label').textContent = color;
        aplicarTema();
        guardarConfigStorage();
    };

    function aplicarTema() {
        const main = document.getElementById('chat-main');
        if (!main) return;
        if (config.tema === 'dark') {
            main.classList.add('bg-gray-900', 'text-white');
            main.classList.remove('bg-white', 'text-gray-900');
            document.getElementById('chat-input').classList.add('bg-gray-800', 'text-white', 'border-gray-700');
            document.getElementById('chat-input').classList.remove('bg-white', 'text-gray-900', 'border-gray-300');
        } else {
            main.classList.add('bg-white', 'text-gray-900');
            main.classList.remove('bg-gray-900', 'text-white');
            document.getElementById('chat-input').classList.add('bg-white', 'text-gray-900', 'border-gray-300');
            document.getElementById('chat-input').classList.remove('bg-gray-800', 'text-white', 'border-gray-700');
        }
        document.documentElement.style.setProperty('--accent-color', config.colorAcento);
    }

    window.guardarConfigYIniciar = function() {
        config.model = document.getElementById('config-model').value;
        config.apiKey = document.getElementById('config-apikey').value;
        config.endpoint = document.getElementById('config-endpoint').value || 'http://localhost:11434';
        guardarConfigStorage();
        mostrarChat();
    };

    window.mostrarConfig = function() {
        document.getElementById('chatAI-chat').classList.add('hidden');
        document.getElementById('chatAI-config').classList.remove('hidden');
    };

    function mostrarChat() {
        document.getElementById('chatAI-config').classList.add('hidden');
        document.getElementById('chatAI-chat').classList.remove('hidden');
        aplicarTema();
        cargarHistorial();
    }

    async function peticion(metodo, ruta, cuerpo) {
        try {
            const opciones = {
                method: metodo,
                headers: { 'Content-Type': 'application/json' }
            };
            if (cuerpo) opciones.body = JSON.stringify(cuerpo);
            const res = await fetch(API_BASE + ruta, opciones);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } catch(e) {
            console.error('API error:', e);
            return null;
        }
    }

    async function cargarHistorial() {
        const data = await peticion('GET', '/sessions');
        const contenedor = document.getElementById('chat-historial');
        contenedor.innerHTML = '';
        if (!data || data.length === 0) {
            contenedor.innerHTML = '<p class="text-sm text-gray-400 text-center mt-4">No conversations yet</p>';
            return;
        }
        data.forEach(s => {
            const div = document.createElement('div');
            div.className = 'p-2 rounded-md cursor-pointer hover:bg-gray-200 text-sm truncate transition-colors' +
                (sesionActiva && sesionActiva.id === s.id ? ' bg-gray-200 font-medium' : '');
            div.textContent = s.titulo || 'Untitled';
            div.onclick = function() { window.seleccionarSesion(s.id); };
            contenedor.appendChild(div);
        });
    }

    window.seleccionarSesion = async function(id) {
        sesionActiva = { id };
        const data = await peticion('GET', '/sessions/' + id);
        if (!data) return;
        sesionActiva = data.conversacion;
        const contenedor = document.getElementById('chat-mensajes');
        contenedor.innerHTML = '';
        (data.mensajes || []).forEach(m => {
            agregarMensajeAlChat(m.rol, m.contenido, false);
        });
        cargarHistorial();
    };

    window.nuevaSesion = async function() {
        const data = await peticion('POST', '/sessions', {
            titulo: 'Nueva conversación',
            configSnapshot: JSON.stringify(config)
        });
        if (data) {
            sesionActiva = data;
            document.getElementById('chat-mensajes').innerHTML =
                '<div class="text-center text-gray-400 mt-20"><p class="text-lg">New conversation started</p></div>';
            cargarHistorial();
        }
    };

    window.enviarMensaje = async function() {
        const input = document.getElementById('chat-input');
        const contenido = input.value.trim();
        if (!contenido || !sesionActiva) return;

        if (!sesionActiva.id) return;

        input.value = '';

        agregarMensajeAlChat('user', contenido, true);

        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'flex justify-start';
        thinkingDiv.innerHTML = '<div class="max-w-[80%] p-3 rounded-lg bg-gray-100 text-gray-500 text-sm">Thinking...</div>';
        document.getElementById('chat-mensajes').appendChild(thinkingDiv);
        document.getElementById('chat-mensajes').scrollTop = document.getElementById('chat-mensajes').scrollHeight;

        const data = await peticion('POST', '/sessions/' + sesionActiva.id + '/messages', {
            contenido: contenido,
            configSnapshot: JSON.stringify(config)
        });

        thinkingDiv.remove();

        if (data && data.respuesta) {
            agregarMensajeAlChat('assistant', data.respuesta, true);
            sesionActiva.titulo = contenido.substring(0, 50);
            cargarHistorial();
        } else {
            agregarMensajeAlChat('assistant', 'Error: Could not get response from AI', true);
        }
    };

    function agregarMensajeAlChat(rol, contenido, reproducir) {
        const contenedor = document.getElementById('chat-mensajes');
        const div = document.createElement('div');
        div.className = 'flex ' + (rol === 'user' ? 'justify-end' : 'justify-start');

        const bg = rol === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800';
        const html = '<div class="max-w-[80%] p-3 rounded-lg ' + bg + ' whitespace-pre-wrap">' +
            escaparHTML(contenido) + '</div>';

        div.innerHTML = html;
        contenedor.appendChild(div);
        contenedor.scrollTop = contenedor.scrollHeight;
    }

    function escaparHTML(texto) {
        const d = document.createElement('div');
        d.textContent = texto;
        return d.innerHTML;
    }

    document.addEventListener('DOMContentLoaded', function() {
        if (document.getElementById('chatAI-config')) {
            cargarConfig();
            const guardada = localStorage.getItem('chat-config');
            if (guardada) {
                mostrarChat();
            }
        }
    });

})();
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/chatAI/functionChat.js
git commit -m "feat(chat): add frontend chat and config logic"
```

---

### Task 6: Update Route in index.js

**Files:**
- Modify: `electron/renderer/index.js`

- [ ] **Step 1: Update route** for `chatIA` to point to the chat HTML

```javascript
        chatIA: 'chatAI/chat.html',
```

- [ ] **Step 2: Verify the change**

Run: `cd electron/renderer && Select-String -Pattern "chatIA" index.js`
Expected output: `chatIA: 'chatAI/chat.html',`

- [ ] **Step 3: Commit**

```bash
git add electron/renderer/index.js
git commit -m "feat(chat): add route for chatAI page"
```

