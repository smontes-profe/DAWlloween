# Specifications: EPIC2 - Jumpscare & Captura de Cámara

## Status
`spec` (Agreed with PM)

## Scope & Objectives
Implement the surprise audiovisual jumpscare sequence triggered upon climax, seamlessly synchronize it with the automatic 2-second video clip recording (and instant frame capture fallback) of the player's reaction from the webcam using native `MediaRecorder` (`video/webm`), display the animated looping reaction in a reaction/preview screen (`#screamer` / `#register`), and provide a themed input form for the player to enter their nickname.

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
- **Story**: **As an** event organizer and DAW showcase presenter, **I want** the application to grab a snapshot frame from the active webcam stream at the exact peak millisecond of the jumpscare, **so I can** capture the genuine, unposed scare reaction of the student as a fallback.
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

### US2.4: Grabación de Clip de Vídeo de Reacción (WebM) con MediaRecorder y Previsualización Dinámica
- **Story**: **As an** event organizer and DAW student, **I want** the application to record a 2-second video clip of my reaction starting at the exact moment the jumpscare erupts and loop it inside the Polaroid frame, **so I can** see the full dynamic scare reaction in motion and submit it to the Hall of Fame.
- **Acceptance Criteria**:
  - Automatically initiates video recording from the active webcam `MediaStream` via native `MediaRecorder` API upon receiving `game:trigger-screamer`.
  - Records for exactly 2.0 seconds in `video/webm` (or `video/mp4` according to browser codec capabilities).
  - Encapsulates chunks into an in-memory `Blob` and creates a local object URL (`blob:url`), maintaining zero local persistence.
  - Emits decoupled `screamer:video-recorded` event via `eventBus` with the video Blob, mimeType, and duration.
  - Falls back smoothly to static WebP photo snapshot if `MediaRecorder` is unsupported or fails.
  - Updates `RegisterView` (`#register`) to display the recorded video inside the gothic Polaroid frame via a looping `<video autoplay loop muted playsinline>` element.
  - Prepares the video Blob in the `screamer:nickname-submitted` payload ready for Supabase Storage upload in EPIC3.

---

## Technical Constraints & Design Patterns
- **Strict Tech Stack**: Vanilla JavaScript (ES Modules), HTML5 Canvas, Vanilla CSS, native `MediaRecorder`.
- **Zero Local Persistence**: Video Blob, image snapshot, and nickname kept in memory; never saved to localStorage or disk.
- **Design Patterns**:
  - *Observer / Event Bus*: `screamer:photo-captured`, `screamer:video-recorded`, `screamer:nickname-submitted`.
  - *State Pattern*: SPA routing states (`#screamer`, `#register`).
  - *Singleton*: `cameraService` providing stream frames to the capture canvas.
- **Language Standards**: Strict UK English (`en-GB`) for all code entities, identifiers, comments, and unit tests.
