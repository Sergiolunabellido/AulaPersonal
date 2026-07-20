# Coding Conventions

## JavaScript (Frontend)
- All scripts use IIFE: `(function() { 'use strict'; ... })();`
- Communication with main process via `window.electronAPI.*`
- REST calls via `fetch()` to `http://localhost:8080`
- SPA navigation: pages load via `cargarPagina()` (HTML fetch + script recreation)
- Tailwind utility classes only — no custom CSS files
- Spanish variable names in domain logic (apps-bloqueo, pomodoro-config)

## Java (Backend)
- Package structure: `org.example.aulapersonal.<modulo>/`
- 3-layer pattern: Controller (@RestController) → Service (@Service) → Repository (@Repository)
- Entities (@Entity) in subdirectories with JPA repositories
- Constructor injection (no @Autowired fields)
- Spanish naming for entities (Nota, Conversacion, Mensaje)
- REST endpoints under `/api/<recurso>`

## Database
- H2 file-based (default), MySQL profile available
- JPA ddl-auto=update (Hibernate manages schema)
- Timestamps managed via @PrePersist / @PreUpdate

## Git
- Descriptive commit messages in English
- Separate commits per logical change
