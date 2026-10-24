# Program Planner - Task Backlog (EPIC2)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-24)
- **Scope**: EPIC2 - Jumpscare & Captura de Cámara (Jumpscare & Webcam Capture)

---

## Task Backlog

### US2.2: Captura Instantánea de Fotograma de Webcam en Canvas (WebP)
- [x] [T0] [US2.2] Implement webcam frame capture service in `src/screamer/capture.js` to grab active `<video>` stream frames onto an off-screen HTML5 Canvas, encode to `image/webp` (with `image/jpeg` fallback), and manage transient in-memory reaction snapshot state.
- [x] [T1] [US2.2] Wire frame capture execution synchronously upon `game:trigger-screamer`, publish `screamer:photo-captured` payload via EventBus, and implement unit tests in `tests/capture.test.js` validating dimensions, MIME types, and fallback handling.

### US2.1: Disparador y Efecto Audiovisual del Jumpscare (Susto)
- [x] [T2] [US2.1] Implement high-intensity procedural/synthesised jumpscare screech sound (`playScreamer()`) in `src/services/audio.js` using layered square/saw oscillators and noise bursts, with unit tests in `tests/audio.test.js`.
- [x] [T3] [US2.1] Build Jumpscare view component in `src/views/screamerView.js` and `styles/screamer.css` featuring fullscreen visual shock effects (strobe flash, gruesome jack-o'-lantern/demon silhouette, screen-shake) and an automatic timed transition (1.5–2.0s) to `#register`.
- [x] [T4] [US2.1] Register `#screamer` route in `src/app.js`, coordinate seamless transition from the game loop upon `game:trigger-screamer`, and add unit tests in `tests/screamerView.test.js`.

### US2.3: Pantalla de Reacción y Registro de Apodo (`#register`)
- [x] [T5] [US2.3] Build Reaction and Registration view in `src/views/registerView.js` and `styles/register.css` displaying the captured WebP photo inside a gothic Halloween Polaroid frame, with accessible layout and fallback spooky avatar when camera is unavailable.
- [x] [T6] [US2.3] Implement nickname input validation (3–20 characters, sanitisation), submission button publishing `screamer:nickname-submitted` payload via EventBus (preparing data for EPIC3), "Jugar de nuevo" restart action, and unit tests in `tests/registerView.test.js`.

### US2.4: Grabación de Clip de Vídeo de Reacción (WebM) con MediaRecorder y Previsualización Dinámica
- [x] [T7] [US2.4] Implement 2-second webcam video clip recorder service in `src/screamer/recorder.js` leveraging native `MediaRecorder` API (`video/webm` with MP4 fallback), recording for exactly 2000ms upon `game:trigger-screamer`, producing in-memory Blob and local preview URL with zero local persistence, providing fallback to `captureService` photo snapshot if recording is unavailable, and writing unit tests in `tests/recorder.test.js`.
- [x] [T8] [US2.4] Update `RegisterView` (`src/views/registerView.js` & `styles/register.css`) to render the animated reaction clip using a looping `<video autoplay loop muted playsinline>` element inside the gothic Polaroid frame with seamless fallback to static photo/avatar when no video Blob is present, and add unit tests in `tests/registerView.test.js`.
- [x] [T9] [US2.4] Wire `screamer:video-recorded` and `screamer:nickname-submitted` payloads to include the reaction video Blob, MIME type, and duration metadata, ensuring complete data readiness for EPIC3 Supabase Storage upload, and update integration tests.
