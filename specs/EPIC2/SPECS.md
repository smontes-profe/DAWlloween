# Specifications: EPIC2 - Jumpscare & Captura de Cámara

## Status
`spec` (Agreed with PM)

## Scope & Objectives
Implement the surprise audiovisual jumpscare sequence triggered upon climax, seamlessly synchronize it with the automatic capture of a single reaction frame from the player's webcam (encoded to WebP format), freeze and display the reaction in a reaction/preview screen (`#screamer` / `#register`), and provide a themed input form for the player to enter their nickname.

---

## User Stories

### US2.1: Disparador y Efecto Audiovisual del Jumpscare (Susto)
- **Story**: **As a** player engaged in the survival minigame, **I want** a sudden, intense audiovisual jumpscare (screamer visual shock and piercing audio sting) to trigger instantly when the timer expires or I am defeated, **so I can** experience a thrilling and memorable Halloween scare.
- **Acceptance Criteria**:
  - Listens to `game:trigger-screamer` emitted by the Game Engine.
  - Transitions the SPA Router immediately to the jumpscare view (`#screamer`).
  - Plays a high-intensity audio sting/screamer effect synthesized via Web Audio API or decoded audio buffer.
  - Renders an intense visual shock effect (flashing gruesome silhouette, screen-shake, and chromatic glitch animation) lasting 1.0–2.0 seconds before auto-transitioning to `#register`.
  - Conforms to accessibility standards with appropriate fallback or skip considerations where needed.

### US2.2: Captura Instantánea de Fotograma de Webcam en Canvas (WebP)
- **Story**: **As an** event organizer and DAW showcase presenter, **I want** the application to grab a snapshot frame from the active webcam stream at the exact peak millisecond of the jumpscare, **so I can** capture the genuine, unposed scare reaction of the student.
- **Acceptance Criteria**:
  - Ingests the current frame from the active hidden `<video>` element managed by `cameraService` onto an off-screen HTML5 Canvas.
  - Encodes the captured frame into `image/webp` (with fallback to `image/jpeg` if unsupported).
  - Operates strictly in-memory without saving to `localStorage`, `sessionStorage`, or local files.
  - Synchronizes frame capture within $< 100\text{ms}$ of the jumpscare trigger for authentic reaction capture.
  - Dispatches decoupled `screamer:photo-captured` event via `eventBus` with the base64/blob image data payload.

### US2.3: Pantalla de Reacción y Registro de Apodo (`#register`)
- **Story**: **As a** player who just got scared, **I want** to see my reaction photograph displayed on screen alongside a themed input form to enter my nickname, **so I can** review my scare and prepare it for submission to the Hall of Fame.
- **Acceptance Criteria**:
  - Displays the captured reaction image framed in a thematic Halloween border / Polaroid style.
  - Provides an accessible text input field for the player's nickname/alias (3 to 20 characters, trimmed, sanitised).
  - Includes action buttons: "Inmortalizar en el Hall of Fame" (primary CTA preparing payload for EPIC3) and "Jugar de Nuevo / Repetir" (restart flow to `#home`).
  - Gracefully handles scenarios where camera was denied or capture failed (displays a placeholder thematic avatar with informative alert message).

---

## Technical Constraints & Design Patterns
- **Strict Tech Stack**: Vanilla JavaScript (ES Modules), HTML5 Canvas, Vanilla CSS.
- **Zero Local Persistence**: Image and nickname kept in memory; never saved to localStorage or disk.
- **Design Patterns**:
  - *Observer / Event Bus*: `screamer:photo-captured`, `screamer:nickname-submitted`.
  - *State Pattern*: SPA routing states (`#screamer`, `#register`).
  - *Singleton*: `cameraService` providing stream frames to the capture canvas.
- **Language Standards**: Strict UK English (`en-GB`) for all code entities, identifiers, comments, and unit tests.
