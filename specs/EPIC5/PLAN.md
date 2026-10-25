# Implementation Plan: EPIC5 - Ronda de Feedback 1: UI, HUD & Optimización

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-25)
- **Scope**: EPIC5 - Feedback 1 (Spanish Localisation, HUD Relocation, Timer Removal, Death Jumpscare, Mobile 2-column Grid & IntersectionObserver)

---

## 1. User Story Implementation Order

### Story 1: US5.2 - Reubicación de HUD, Supresión de Cuenta Atrás & Jumpscare por Muerte
- **Priority**: High (P1 - Core Gameplay & Tension Loop)
- **Rationale**: Direct impacts on the Canvas 2D engine (`src/game/engine.js`), Game HUD markup/styles (`src/views/gameView.js`, `styles/game.css`), and the climax trigger event bus flow. Positioning health and ammo in the top-left corner and suppressing the visible countdown clock avoids giving away the surprise climax, while triggering the jumpscare immediately on player defeat guarantees the intended experience.
- **Dependencies**: None.

### Story 2: US5.1 - Localización Completa al Castellano de España
- **Priority**: High (P2 - Global UI/UX & Consistency)
- **Rationale**: Governed by new Rule 8 in `AGENTS.md`. With the game HUD layout and templates stabilised in US5.2, perform a comprehensive review and translation into natural European Spanish (`es-ES`) across all views (`welcomeView`, `gameView`, `screamerView`, `registerView`, `hallOfFameView`, and `alerts.js`), respecting diacritics, tildes, and thematic tone.
- **Dependencies**: Benefits from US5.2 establishing the final HUD element structure.

### Story 3: US5.3 - Optimización del Hall of Fame (2 Vídeos por Fila en Móvil & IntersectionObserver)
- **Priority**: Medium/High (P3 - Presentation, Performance & Mobile Responsiveness)
- **Rationale**: Enhances the public gallery view for mobile screens (< 768px) with a 2-column CSS Grid (`grid-template-columns: repeat(2, 1fr)`) and integrates an `IntersectionObserver` in `HallOfFameView` so that looping video playback is restricted strictly to elements within the visible scroll viewport, eliminating needless CPU/GPU drain.
- **Dependencies**: Independent of gameplay loop.

---

## 2. Technical Dependencies & Constraints

1. **Constitutional Rules (AGENTS.md)**:
   - Rule 7: UK English (`en-GB`) for code symbols, functions, variables, comments, and unit tests.
   - Rule 8: European Spanish (`es-ES`) for all user-facing interface copy, HUD labels, dialogues, and notifications.
2. **Decoupled Architecture**:
   - `game:trigger-screamer` event continues to serve as the unified trigger contract for transitioning from game to jumpscare.
3. **Clean Up & Lifecycle**:
   - The `IntersectionObserver` instantiated in `HallOfFameView` must be disconnected and cleared upon view `destroy()` to prevent memory leaks.
