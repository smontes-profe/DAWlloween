# Program Planner - Task Backlog (EPIC5)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-25)
- **Scope**: EPIC5 - Ronda de Feedback 1: UI, HUD & Optimización

---

## Task Backlog

### US5.2: Reubicación de HUD, Supresión de Cuenta Atrás & Jumpscare por Muerte
- [x] [T0] [US5.2] Update `styles/game.css` and `src/views/gameView.js` to remove the visual countdown timer element from the HUD and relocate the health meter and ammo cylinder to the top-left corner of the viewport/canvas container with high-contrast thematic styling.
- [x] [T1] [US5.2] Synchronise and optimise jumpscare activation reliability: preload `assets/jumpscare.mp4` on game mount/initialisation to eliminate video buffering latency, ensure the `ScreamerView` safety fallback timer only begins after video playback actually starts (or maintains a generous 8s safety margin if video fails), and coordinate webcam recording duration so the player always experiences the full scare exposure before transitioning to `#register`, with unit tests in `tests/screamerReliability.test.js`.
- [x] [T2] [US5.2] Update `src/game/engine.js` so that when player health drops to zero (`!player.isAlive`), the gameplay loop immediately halts, secondary timers are cleared, and the engine fires the `game:trigger-screamer` event directly, with unit tests in `tests/engineDeathTrigger.test.js`.
- [x] [T3] [US5.2] Update existing tests in `tests/gameView.test.js` and `tests/engine.test.js` to align with the removed countdown display, top-left HUD positioning, and death screamer trigger.
- [x] [T9] [US5.2] Update `ScreamerView` (`src/views/screamerView.js`) to publish `screamer:playback-started` when the jumpscare video fires the native `playing` event (or when SVG fallback engages), start the exact `durationMs` timer from that moment, and prevent accidental skips via mouse clicks or Space/Enter keys during the active shock exposure.
- [x] [T10] [US5.2] Update `ReactionRecorderService` (`src/screamer/recorder.js`) to start webcam reaction recording upon `screamer:playback-started` rather than the initial trigger, guaranteeing exact synchronisation with the visual shock for `SCREAMER_CONFIG.durationMs`.
- [x] [T11] [US5.2] Update `GameEngine` (`src/game/engine.js`) to maintain simulation loop and background rendering during the entire jumpscare exposure duration for both player defeat and timer expiration, cleanly halting upon `screamer:transition-complete`, with unit tests in `tests/screamerSync.test.js`.

### US5.1: Localización Completa al Castellano de España
- [x] [T4] [US5.1] Localise all user-facing strings, dialogues, instructions, HUD labels, and buttons in `WelcomeView` (`src/views/welcomeView.js`), `GameView` (`src/views/gameView.js`), and `ScreamerView` (`src/views/screamerView.js`) into natural European Spanish (`es-ES`) with correct orthography and diacritics.
- [x] [T5] [US5.1] Localise all user-facing strings, forms, placeholders, and buttons in `RegisterView` (`src/views/registerView.js`), `HallOfFameView` (`src/views/hallOfFameView.js`), and toast notifications in `AlertsService` (`src/ui/alerts.js`), plus update unit tests across `tests/welcomeView.test.js`, `tests/registerView.test.js`, and `tests/alerts.test.js`.

### US5.3: Optimización del Hall of Fame (2 Vídeos por Fila en Móvil & IntersectionObserver)
- [x] [T6] [US5.3] Update `styles/hallOfFame.css` mobile media queries (< 768px) to render reaction cards in a responsive 2-column grid (`repeat(2, 1fr)`) with compact padding, fluid typography, and proportional card aspect ratios.
- [x] [T7] [US5.3] Implement an `IntersectionObserver` in `HallOfFameView` (`src/views/hallOfFameView.js`) to automatically play looping videos when cards enter the viewport and pause them when scrolled out of view, with proper observer disconnection on `destroy()`.
- [x] [T8] [US5.3] Implement unit tests in `tests/hallOfFameIntersection.test.js` validating the 2-column mobile layout classes and `IntersectionObserver` play/pause lifecycle and cleanup.
