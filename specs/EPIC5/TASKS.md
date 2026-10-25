# Program Planner - Task Backlog (EPIC5)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-25)
- **Scope**: EPIC5 - Ronda de Feedback 1: UI, HUD & Optimización

---

## Task Backlog

### US5.2: Reubicación de HUD, Supresión de Cuenta Atrás & Jumpscare por Muerte
- [<] [T0] [US5.2] Update `styles/game.css` and `src/views/gameView.js` to remove the visual countdown timer element from the HUD and relocate the health meter and ammo cylinder to the top-left corner of the viewport/canvas container with high-contrast thematic styling.
- [<] [T1] [US5.2] Synchronise and optimise jumpscare activation reliability: preload `assets/jumpscare.mp4` on game mount/initialisation to eliminate video buffering latency, ensure the `ScreamerView` safety fallback timer only begins after video playback actually starts (or maintains a generous 8s safety margin if video fails), and coordinate webcam recording duration so the player always experiences the full scare exposure before transitioning to `#register`, with unit tests in `tests/screamerReliability.test.js`.
- [ ] [T2] [US5.2] Update `src/game/engine.js` so that when player health drops to zero (`!player.isAlive`), the gameplay loop immediately halts, secondary timers are cleared, and the engine fires the `game:trigger-screamer` event directly, with unit tests in `tests/engineDeathTrigger.test.js`.
- [ ] [T3] [US5.2] Update existing tests in `tests/gameView.test.js` and `tests/engine.test.js` to align with the removed countdown display, top-left HUD positioning, and death screamer trigger.

### US5.1: Localización Completa al Castellano de España
- [ ] [T4] [US5.1] Localise all user-facing strings, dialogues, instructions, HUD labels, and buttons in `WelcomeView` (`src/views/welcomeView.js`), `GameView` (`src/views/gameView.js`), and `ScreamerView` (`src/views/screamerView.js`) into natural European Spanish (`es-ES`) with correct orthography and diacritics.
- [ ] [T5] [US5.1] Localise all user-facing strings, forms, placeholders, and buttons in `RegisterView` (`src/views/registerView.js`), `HallOfFameView` (`src/views/hallOfFameView.js`), and toast notifications in `AlertsService` (`src/ui/alerts.js`), plus update unit tests across `tests/welcomeView.test.js`, `tests/registerView.test.js`, and `tests/alerts.test.js`.

### US5.3: Optimización del Hall of Fame (2 Vídeos por Fila en Móvil & IntersectionObserver)
- [ ] [T6] [US5.3] Update `styles/hallOfFame.css` mobile media queries (< 768px) to render reaction cards in a responsive 2-column grid (`repeat(2, 1fr)`) with compact padding, fluid typography, and proportional card aspect ratios.
- [ ] [T7] [US5.3] Implement an `IntersectionObserver` in `HallOfFameView` (`src/views/hallOfFameView.js`) to automatically play looping videos when cards enter the viewport and pause them when scrolled out of view, with proper observer disconnection on `destroy()`.
- [ ] [T8] [US5.3] Implement unit tests in `tests/hallOfFameIntersection.test.js` validating the 2-column mobile layout classes and `IntersectionObserver` play/pause lifecycle and cleanup.
