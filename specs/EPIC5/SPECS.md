# Specifications: EPIC5 - Ronda de Feedback 1: UI, HUD & Optimización

## Status
`spec` (Agreed with PM)

## Scope & Objectives
Implement the initial wave of student and teacher feedback collected during classroom testing:
1. Complete localisation of the user interface, briefing dialogues, buttons, and HUD elements into European Spanish (castellano de España).
2. Refinement of in-game tension by removing the visible countdown timer from the HUD, moving vital HUD statistics (player health, ammo cylinder) to the top-left corner, and immediately triggering the surprise jumpscare if the player's health reaches zero prior to time exhaustion.
3. Optimisation of the public Hall of Fame exhibition view by enhancing the mobile viewport layout to display a 2-column video card grid and implementing an `IntersectionObserver` to automatically pause videos outside the visible scroll viewport, ensuring optimal battery and memory usage on mobile devices.

Code entities, functions, comments, docstrings, and tests strictly remain in **UK English (`en-GB`)**.

---

## User Stories

### US5.1: Localización Completa al Castellano de España
- **Story**: **As a** student or visitor participating in the DAWlloween attraction, **I want** all user-facing interface copy, instructions, HUD labels, and alerts to be written in natural European Spanish, **so I can** immediately understand game controls and feel immersed in the thematic storyline.
- **Acceptance Criteria**:
  - All text strings in `WelcomeView`, `GameView`, `ScreamerView`, `RegisterView`, and `HallOfFameView` must use proper European Spanish terminology, spelling, and diacritics.
  - Standardise button copy: e.g. "Calibrar Cámara", "Recargar", "Volver al Inicio", "Inmortalizar Reacción", "Actualizar".
  - Alert toasts and error dialogs emit messages in natural Spanish without broken grammar or literal translations.
  - Internal codebase identifiers, constants, methods, and comments strictly remain in **UK English (`en-GB`)** (`initialise`, `colour`, `synchronise`, `optimise`).

### US5.2: Reubicación de HUD, Supresión de Cuenta Atrás & Jumpscare por Muerte
- **Story**: **As a** player engaged in the decoy survival game, **I want** my health and ammunition status displayed unobtrusively in the top-left corner with no visible countdown clock, and for the jumpscare to trigger immediately if I am defeated, **so I can** stay focused on survival without suspecting a scripted scare and still experience the surprise climax even if I perish early.
- **Acceptance Criteria**:
  - Hide or remove the visual countdown timer element from the Game HUD.
  - Internal climax timer (30–60s) continues operating in background as a secondary guarantee.
  - Position the player health indicator and ammunition cylinder in the top-left corner of the viewport/HUD with adequate contrast and spacing.
  - When player health drops to zero (`isAlive = false`), immediately halt the gameplay loop, cancel the secondary timer, and publish the `game:trigger-screamer` event to transition into the jumpscare sequence.

### US5.3: Optimización del Hall of Fame (2 Vídeos por Fila en Móvil & IntersectionObserver)
- **Story**: **As a** student browsing the Hall of Fame from a smartphone, **I want** to see a compact 2-column reaction grid and have off-screen videos pause automatically, **so I can** browse reactions smoothly without overwhelming device hardware or battery.
- **Acceptance Criteria**:
  - Update `styles/hallOfFame.css` so that mobile viewports (< 768px) display reaction cards in a 2-column grid (`grid-template-columns: repeat(2, 1fr)`) with compact padding and fluid text sizing.
  - Implement an `IntersectionObserver` in `HallOfFameView` observing all rendered reaction cards.
  - Videos intersecting the visible viewport threshold (e.g. `threshold: 0.25` or `0.5`) automatically call `.play()`.
  - Videos scrolled out of the visible viewport automatically call `.pause()` to conserve CPU/GPU cycles.
  - Clean up observer references upon `destroy()` / `unmount()`.

---

## Technical Constraints & Design Patterns
- **Strict Tech Stack**: Vanilla JavaScript (ES Modules), HTML5 Canvas 2D, Vanilla CSS (CSS Grid, Flexbox, Custom Properties).
- **Zero Local Persistence**: No `localStorage` or `sessionStorage` usage for user reactions or game state.
- **Observer Pattern**: Maintain event decoupling via `EventBus` (`game:trigger-screamer`, `game:player-death`).
- **Resource Management**: Efficient cleanup of `IntersectionObserver`, animation frames, and media streams.
- **Language Standards**: Strict UK English (`en-GB`) for all code entities, identifiers, tests, and commit messages.
