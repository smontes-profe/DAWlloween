# Program Planner - Task Backlog (EPIC6)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-25)
- **Scope**: EPIC6 - Ronda de Feedback 2: Mecánicas & Admin

---

## Task Backlog

### US6.1: Modo Administrador con Autenticación Simple para Moderación y Borrado en Supabase
- [x] [T0] [US6.1] Configure `ADMIN_CONFIG` in `src/config.js` and extend `SupabaseService` (`src/services/supabase.js`) with `deleteReactionRecord(id, { videoUrl, photoUrl })` to delete assets from Supabase Storage bucket `reactions` and delete the corresponding row from table `hall_of_fame` with fault-tolerant error handling and retries, with unit tests in `tests/supabaseAdmin.test.js`.
- [x] [T1] [US6.1] Create `AdminView` (`src/views/adminView.js`), register route `#admin` in `src/app.js`, and add styles in `styles/admin.css`: accessible login form in European Spanish (`es-ES`), strictly in-memory authentication state (zero local persistence), and active admin session lifecycle.
- [x] [T2] [US6.1] Update `HallOfFameView` (`src/views/hallOfFameView.js`) to support admin mode: individual "Eliminar" (Delete) action button on each card, accessible confirmation dialog in European Spanish, live reactive DOM removal upon deletion without full page refresh, "Cerrar Sesión" (Log out) action, and unit tests in `tests/adminView.test.js`.

### US6.2: Sistema de 5 Puntos de Vida (PV) y Daño por Contacto
- [>] [T3] [US6.2] Update `Player` entity (`src/game/player.js`), `src/config.js`, and `GameEngine` (`src/game/engine.js`) to manage 5 discrete Health Points (`maxHp = 5`, `hp = 5`): enemy collision decrements 1 HP, immediately destroys the colliding enemy on impact, triggers visual screen flash/shake and impact sound, and emits `game:health-updated`. Reaching 0 HP immediately triggers defeat jumpscare climax, with unit tests in `tests/playerHealth.test.js`.
- [>] [T4] [US6.2] Update `GameView` (`src/views/gameView.js`) and `styles/game.css` to replace the continuous percentage health meter with 5 discrete gothic tokens (skulls/hearts) in the top-left HUD cluster that empty upon each damage event, updating unit tests in `tests/gameView.test.js`.

### US6.3: Recarga Manual con Espacio y Alerta Parpadeante
- [<] [T5] [US6.3] Update `Weapon` (`src/game/weapon.js`) and `GameEngine` (`src/game/engine.js`) to suppress automatic reload when ammunition reaches 0 (`currentRounds === 0`), block firing attempts, and listen for the Spacebar (`Space` key) to manually trigger `reload()`, with unit tests in `tests/weaponManualReload.test.js`.
- [<] [T6] [US6.3] Update `GameView` (`src/views/gameView.js`) and `styles/game.css` to render a prominent high-contrast flashing text warning *"¡Recarga! (pulsar espacio)"* while ammunition is 0, dismissing it immediately when manual reload begins.

### US6.4: Modal Popup de Ampliación de Vídeo en Hall of Fame
- [<] [T7] [US6.4] Implement accessible video enlargement modal dialog in `HallOfFameView` (`src/views/hallOfFameView.js`) and `styles/hallOfFame.css`: opens upon clicking/tapping any reaction card (without triggering admin delete button), responsive full-width display on mobile (< 768px) and centered proportional dialog on desktop, with dismissal via close "X" button, `Escape` key, or backdrop click, with unit tests in `tests/hallOfFameModal.test.js`.
