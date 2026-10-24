# Program Planner - Task Backlog (EPIC1)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-22)
- **Scope**: EPIC1 - Mini-juego señuelo 2D (Decoy 2D Survival Game)

---

## Task Backlog

### US1.1: Sistema de Diseño Visual y Guía de Estilo Frontend
- [<] [T0] [US1.1] Create `docs/DESIGN_GUIDE.md` with complete art direction, visual specification, CSS variable definitions (Halloween palette, typography, glow/elevations, micro-animations, responsive layout rules for desktop and mobile Hall of Fame), and component guidelines.
- [<] [T1] [US1.1] Implement core CSS design system in `styles/main.css` with CSS custom properties (`--colour-bg`, `--colour-pumpkin`, `--colour-ectoplasm`, `--colour-spectral-purple`, etc.), Google Fonts imports, CSS reset, atmospheric keyframe animations, and base utility classes.

### US1.2: Estructura SPA y Pantalla de Inicio / Permiso de Cámara
- [<] [T2] [US1.2] Create root HTML shell `index.html` with semantic structure, accessibility attributes, viewport meta tags, stylesheet links, and root mount container.
- [<] [T3] [US1.2] Implement Event Bus module (`src/utils/eventBus.js`) and UI notification service (`src/ui/alerts.js`) for toast notifications and decoupled messaging across the application.
- [<] [T4] [US1.2] Implement client-side SPA State Router (`src/app.js`) with hash-based routing and view rendering lifecycle supporting `#home`, `#play`, `#screamer`, `#register`, and `#hall-of-fame`.
- [<] [T5] [US1.2] Implement Camera service (`src/screamer/camera.js`) to handle webcam permission handshake (`getUserMedia`), stream lifecycle, and friendly UI alerts upon denial or errors.
- [<] [T6] [US1.2] Build Welcome view (`src/views/welcomeView.js`) with responsive Halloween UI,  activity overview, camera calibration trigger button, and seamless transition to `#play`.

### US1.3: Motor Canvas 2D, Movimiento y Arquitectura Extensible
- [<] [T7] [US1.3] Implement Game View component (`src/views/gameView.js`) and game styles (`styles/game.css`) containing the responsive `<canvas>` element and HUD overlay.
- [<] [T8] [US1.3] Implement Player entity and extensible Entity Factory (`src/game/entities.js`) with vector maths, arena collision boundaries, and 8-directional movement logic.
- [-] [T9] [US1.3] Implement 60 FPS Canvas Game Engine (`src/game/engine.js`) with fixed/delta-time game loop, keyboard input management (WASD/Arrows), entity update/render lifecycle, and unit tests for vector and boundary calculations.

### US1.4: Apuntado con Ratón, Disparo y Sistema de Recarga
- [ ] [T10] [US1.4] Implement cursor tracking and mouse aiming logic in `src/game/engine.js` so the player rotates towards the crosshair coordinates.
- [ ] [T11] [US1.4] Implement Projectile entity in `src/game/entities.js` and ballistic motion system with boundary despawning and collision detection algorithms.
- [ ] [T12] [US1.4] Implement weapon mechanics: 6-round magazine, fire rate throttle, reload cooldown timer (1.5-2.0s), reload HUD indicator, and unit tests for weapon state transitions.

### US1.5: Música Ambiental y Efectos de Sonido (SFX)
- [ ] [T13] [US1.5] Implement Audio Manager (`src/services/audio.js`) utilizing Web Audio API / audio buffers for synthesised/procedural or asset-based Halloween sound effects (shoot, reload, hit) and looping ambient background track.
- [ ] [T14] [US1.5] Integrate audio controls into HUD with accessible mute/unmute toggle button and user-gesture activation meeting browser autoplay policies.

### US1.6: Generación de Enemigos, Temporizador y Disparador de Susto
- [ ] [T15] [US1.6] Implement Enemy entity types and pursuit AI in `src/game/entities.js` with variable speeds, animation frames, and collision hitboxes.
- [ ] [T16] [US1.6] Implement progressive wave spawner in `src/game/engine.js` that scales enemy spawn rate over time around arena perimeters.
- [ ] [T17] [US1.6] Implement survival countdown timer (30-60s) in the HUD with progressive visual tension (colour shift, pulsing animations).
- [ ] [T18] [US1.6] Implement game climax trigger: halt game loop upon timer expiration or player defeat, and emit `game:trigger-screamer` payload via Event Bus with verification tests.
