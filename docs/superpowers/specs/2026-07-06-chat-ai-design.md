# AI Chat — Design Spec

## Overview
AI Chat page for Aula Personal that supports two provider modes: Ollama (local/free) and Custom API (any OpenAI-compatible endpoint). The page shows a configuration screen on first visit, then transitions to a chat interface with a settings button to return to config.

## Page Flow
1. **Config View** — shown on first visit or when user clicks ⚙️ button
2. **Chat View** — shown after config is saved, with sidebar for chat history

## Configuration Options

| Field | Type | Behavior |
|-------|------|----------|
| Provider | Toggle | Ollama or Custom API |
| Model | Dropdown / Text | Ollama: fetches available models. Custom: user types name |
| API Key | Password | Only shown for Custom API |
| Endpoint | Text | Only shown for Custom API. Default `https://api.openai.com/v1` |
| Level | Buttons | High / Medium / Low — affects system prompt |
| Model Type | Dropdown + custom | Analyst, Generative, Creative, Logical, or custom |
| Work Type | Dropdown + custom | Code, Study, Brainstorm, General, Plan, or custom |
| Theme | Dark / Light | Applied via CSS variables |
| Accent Color | Color picker | Applied to UI accents |

Config is stored in `localStorage` key `chat-config`.

## Backend Architecture (Spring Boot)

New package `org.example.aulapersonal.chat`:

### Entities
- **ChatSession** — id (Long), title (String), configSnapshot (JSON/text), createdAt, updatedAt
- **ChatMessage** — id (Long), sessionId (Long), role (String: "user"|"assistant"), content (TEXT), timestamp

### REST API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/chat/sessions` | List all sessions (id, title, updatedAt) |
| POST | `/api/chat/sessions` | Create new session (body: title, configSnapshot) |
| GET | `/api/chat/sessions/{id}` | Get session + all messages |
| DELETE | `/api/chat/sessions/{id}` | Delete session + its messages |
| POST | `/api/chat/sessions/{id}/messages` | Send user message, returns AI response |

### Proxy Logic (ChatService)
- If provider = Ollama: POST to `http://localhost:11434/api/chat`
- If provider = Custom: POST to user's endpoint (OpenAI-compatible format `/v1/chat/completions`)
- System prompt assembled from Level + Model Type + Work Type
- Request/response adapted to each format

## Frontend Architecture (Electron)

### Files
- `electron/renderer/chatAI/chat.html` — Template with both config and chat views
- `electron/renderer/chatAI/functionChat.js` — All logic

### Chat View Layout
```
┌──────────────────────────────────────────┐
│ ┌────────┐  ┌─────────────────────────┐  │
│ │ Chat   │  │ Messages Area           │  │
│ │ History│  │                         │  │
│ │ List   │  │  message bubbles...     │  │
│ │        │  │                         │  │
│ │ [New   │  │  ┌─Input───────────┐    │  │
│ │ Chat]  │  │  │ Type... [Send]  │    │  │
│ └────────┘  └─────────────────────────┘  │
│         [⚙️]                      [🌙]   │
└──────────────────────────────────────────┘
```

### Key Functions
- `cargarConfig()` — renders config view
- `guardarConfig()` — saves to localStorage, transitions to chat
- `cargarChat()` — renders chat view
- `cargarHistorial()` — GET /api/chat/sessions, renders sidebar
- `seleccionarSesion(id)` — loads messages for a session
- `nuevaSesion()` — creates new session via POST
- `enviarMensaje()` — POST message, appends AI response

### Theme
- Config values for dark/light + accent color stored in localStorage
- Applied via CSS variables on the chat container
- Toggle button in chat view header

## Implementation Order
1. Backend: ChatSession + ChatMessage entities and repos
2. Backend: ChatService (Ollama + Custom proxy logic)
3. Backend: ChatController (REST endpoints)
4. Frontend: chat.html with both views
5. Frontend: functionChat.js (config + chat + history)
6. Integration: update index.js route for chatIA
7. Test: manual verification
