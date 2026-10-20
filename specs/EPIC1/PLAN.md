# Program Planner - Implementation Plan (EPIC1)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-21)
- **Scope**: EPIC1 - Mini-juego señuelo 2D (Decoy 2D Survival Game)

---

## User Story Execution Order & Priorities

| Execution Order | User Story | Priority | Dependencies | Summary |
|:---:|---|:---:|:---:|---|
| **1** | **US1.1: Estructura SPA y Pantalla de Inicio / Permiso de Cámara** | High | None | Base SPA shell, Halloween theme styles, `#home` view with activity overview, and webcam permission handshake. |
| **2** | **US1.2: Motor Canvas 2D, Movimiento y Arquitectura Extensible** | High | US1.1 | 60 FPS Canvas engine, 8-directional player movement, arena boundary constraints, and extensible entity factory architecture. |
| **3** | **US1.3: Apuntado con Ratón, Disparo y Sistema de Recarga** | High | US1.2 | Cursor orientation tracking, projectile fire cadence, 6-shot capacity, and reload cooldown mechanic. |
| **4** | **US1.4: Música Ambiental y Efectos de Sonido (SFX)** | Medium | US1.1, US1.3 | Atmospheric audio manager, looping background Halloween track, shoot/reload/hit sound effects, and mute toggle. |
| **5** | **US1.5: Generación de Enemigos, Temporizador y Disparador de Susto** | High | US1.2, US1.3 | Progressive enemy spawning, pursuit AI, collision detection, countdown HUD, and `game:trigger-screamer` event dispatching for EPIC2. |

---

## Technical Dependencies & Architecture Alignment

- **Design Patterns**:
  - *State Pattern* for SPA router and game states (`MENU`, `PLAYING`, `PAUSED`, `TRIGGERED`).
  - *Observer / Event Bus* for decoupling game events (`game:shoot`, `game:reload`, `game:trigger-screamer`).
  - *Factory Pattern* for spawning projectiles and supernatural foes.
  - *Module / Singleton* for audio manager and camera service.
- **Language Standard**: Strict adherence to UK English (`en-GB`) across all identifiers, functions, classes, and code comments.
- **Zero Local Persistence**: No sensitive or temporary data persisted to local disk or Web Storage.
- **Responsiveness**: Fluid layout across standard desktop resolutions (1080p, 720p, laptop screens).

---

## Open Questions & Risks
- *Autoplay policies*: Audio initialization must occur upon player gesture (e.g., clicking "Start / Calibrate" in US1.1) to conform with browser autoplay constraints. (Handled in US1.1/US1.4).
- *Webcam denial*: Handled with an informative, accessible warning alert toast in the UI.
