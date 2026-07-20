# Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop Shell | Electron | ^42.4.0 |
| Frontend | Vanilla JavaScript | ES2021 |
| Styling | Tailwind CSS | CDN (latest) |
| Font | Poppins | Google Fonts |
| Backend | Spring Boot | 4.0.6 |
| Language | Java | 17 |
| Build | Gradle | 9.5.1 |
| ORM | JPA / Hibernate | via Spring Boot |
| Database (prod) | H2 | File-based (AUTO_SERVER) |
| Database (dev) | MySQL | Optional profile |
| JSON | Jackson | 3.x (tools.jackson.*) |
| Packaging | electron-builder | ^25.1.8 |
| Installer (Win) | NSIS | via electron-builder |

## Constraintes
- No Node.js required at runtime (JRE bundled via jlink ~55MB)
- No TypeScript — pure JavaScript
- No build step for frontend (Tailwind via CDN)
- Cross-platform: Windows (NSIS) and Linux (dir)
