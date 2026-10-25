# Specifications: EPIC6 - Ronda de Feedback 2: Mecánicas & Admin

## Status
`spec` (Agreed with PM)

## Scope & Objectives
Implement the second wave of feedback collected during gameplay testing and classroom exhibition:
1. **Admin Moderation Mode (`US6.1`)**: Dedicated accessible view (`#admin`) protected by credentials (configured in `config.js` or environment) allowing administrators/instructors to review the Hall of Fame with deletion capabilities, removing both media files from Supabase Storage and records from the `hall_of_fame` table.
2. **Discrete 5-Point Health System & Contact Damage (`US6.2`)**: Replace the continuous percentage health with 5 discrete Health Points (HP). Enemy contact directly subtracts 1 HP, destroys the colliding enemy on impact with visual/audio feedback, and triggers defeat jumpscare upon reaching 0 HP.
3. **Manual Reload with Spacebar & Flashing Alert (`US6.3`)**: Suppress automatic weapon reloading upon cylinder exhaustion. Require the player to press `Space` to reload, displaying a prominent flashing visual indicator on screen (*"¡Recarga! (pulsar espacio)"*) while ammunition is 0.
4. **Enlarged Video Modal in Hall of Fame (`US6.4`)**: Allow visitors to tap/click any reaction card to expand the video into an accessible modal popup, occupying full width on mobile devices and optimal responsive dimensions on desktop, with intuitive close controls.

Code entities, functions, comments, docstrings, and tests strictly remain in **UK English (`en-GB`)**. All user-facing UI copy and labels remain strictly in **European Spanish (`es-ES`)**.

---

## User Stories

### US6.1: Modo Administrador con Autenticación Simple para Moderación y Borrado en Supabase
- **Story**: **As a** teacher or administrator, **I want** to access a protected moderation view via `#admin` with simple credentials, **so I can** delete inappropriate, test, or duplicate reaction records and their associated cloud storage media from Supabase.
- **Acceptance Criteria**:
  - Secure the route `#admin` behind an accessible login form requesting username and password (validated against `ADMIN_CREDENTIALS` configured in `src/config.js`).
  - Upon successful authentication, render the Hall of Fame interface equipped with individual "Eliminar" (Delete) action buttons for each reaction entry.
  - Clicking "Eliminar" triggers an accessible confirmation dialog in European Spanish.
  - Upon confirmation, invoke `supabaseService.deleteReactionRecord(id, { mediaUrl, photoUrl })` which:
    - Deletes the video/photo asset(s) from Supabase Storage bucket (`reactions`).
    - Deletes the corresponding row from the `hall_of_fame` table.
  - Refresh the view dynamically without full page reload, displaying a feedback toast via `AlertService`.
  - Provide a "Cerrar Sesión" (Log out) action that revokes admin state in memory.

### US6.2: Sistema de 5 Puntos de Vida (PV) y Daño por Contacto
- **Story**: **As a** player, **I want** to have 5 discrete health points that deplete by 1 point whenever an enemy collides with me, with the colliding enemy destroyed upon impact, **so I can** clearly anticipate damage and experience a fair, tense survival challenge.
- **Acceptance Criteria**:
  - The player starts each game run with exactly 5 discrete Health Points (HP / PV).
  - The top-left HUD reflects the 5 HP with thematic discrete visual tokens (e.g. 5 hearts or skulls) rather than an arbitrary smooth bar percentage.
  - When an enemy reaches and touches the player's collision bounds:
    - The player loses exactly 1 HP.
    - The colliding enemy is immediately destroyed and removed from the active enemy pool.
    - Trigger visual damage feedback (screen flash or player damage animation) and impact sound cue.
  - When HP reaches 0 (`!player.isAlive`), the engine triggers immediate climax via `game:trigger-screamer`.

### US6.3: Recarga Manual con Espacio y Alerta Parpadeante
- **Story**: **As a** player, **I want** to manually reload my revolver by pressing the Spacebar when my ammunition runs out instead of the weapon reloading automatically, and see a flashing warning on screen, **so I can** make tactical survival decisions and feel the panic of an empty chamber.
- **Acceptance Criteria**:
  - When ammunition reaches 0 rounds, automatic reloading is disabled.
  - While ammunition is 0, firing attempts are blocked, and a high-contrast flashing text warning is displayed prominently on the game screen: *"¡Recarga! (pulsar espacio)"*.
  - Pressing the Spacebar (`Space` key) engages the reload sequence, replenishing the 6-round cylinder after the configured cooldown duration and immediately dismissing the warning.
  - Manual reload remains allowed when the cylinder is partially depleted (1-5 rounds) by pressing `Space` or clicking the reload action.

### US6.4: Modal Popup de Ampliación de Vídeo en Hall of Fame
- **Story**: **As a** visitor or student browsing the Hall of Fame, **I want** to click or tap any reaction card to expand the reaction video into a larger popup modal, **so I can** appreciate the facial expressions and scare shock in detail.
- **Acceptance Criteria**:
  - Clicking or tapping on a reaction card in `HallOfFameView` opens a modal dialog presenting the reaction video in enlarged format.
  - On mobile devices (< 768px), the modal and video span full screen width.
  - On desktop/tablet displays, the modal centres on screen maintaining natural video aspect ratio with gothic backdrop glow.
  - The modal provides accessible dismissal via:
    - Dedicated "Cerrar" (X) close button.
    - Pressing the `Escape` key.
    - Clicking the modal backdrop overlay.
  - When the modal opens, the video plays with looping enabled; upon modal dismissal, playback halts and DOM overlay is cleanly unmounted.

---

## Technical Constraints & Pedagogical Design Patterns
- **Strict Tech Stack**: Vanilla JavaScript (ES Modules), HTML5 Canvas 2D, Vanilla CSS (CSS Grid, Flexbox, Custom Properties).
- **Zero Local Persistence**: Admin authentication session and tokens remain strictly in-memory (no `localStorage` or `sessionStorage`).
- **Supabase BaaS Deletion**: Extend `SupabaseService` with transactional or dual-step delete routines (Storage bucket removal + Table row deletion) with automatic retry on transient failure.
- **Observer Pattern**: Maintain decoupled communications via `eventBus` (`game:health-updated`, `game:ammo-exhausted`, `game:weapon-reloaded`).
- **Language Standards**: Strict UK English (`en-GB`) for internal identifiers, methods, comments, and tests. Natural European Spanish (`es-ES`) for all user-facing texts, alerts, and dialogues.
