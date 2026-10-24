# Program Planner - Task Backlog (EPIC2)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-24)
- **Scope**: EPIC2 - Jumpscare & Captura de Cámara (Jumpscare & Webcam Capture)

---

## Task Backlog

### US2.2: Captura Instantánea de Fotograma de Webcam en Canvas (WebP)
- [<] [T0] [US2.2] Implement webcam frame capture service in `src/screamer/capture.js` to grab active `<video>` stream frames onto an off-screen HTML5 Canvas, encode to `image/webp` (with `image/jpeg` fallback), and manage transient in-memory reaction snapshot state.
- [<] [T1] [US2.2] Wire frame capture execution synchronously upon `game:trigger-screamer`, publish `screamer:photo-captured` payload via EventBus, and implement unit tests in `tests/capture.test.js` validating dimensions, MIME types, and fallback handling.

### US2.1: Disparador y Efecto Audiovisual del Jumpscare (Susto)
- [<] [T2] [US2.1] Implement high-intensity procedural/synthesised jumpscare screech sound (`playScreamer()`) in `src/services/audio.js` using layered square/saw oscillators and noise bursts, with unit tests in `tests/audio.test.js`.
- [<] [T3] [US2.1] Build Jumpscare view component in `src/views/screamerView.js` and `styles/screamer.css` featuring fullscreen visual shock effects (strobe flash, gruesome jack-o'-lantern/demon silhouette, screen-shake) and an automatic timed transition (1.5–2.0s) to `#register`.
- [<] [T4] [US2.1] Register `#screamer` route in `src/app.js`, coordinate seamless transition from the game loop upon `game:trigger-screamer`, and add unit tests in `tests/screamerView.test.js`.

### US2.3: Pantalla de Reacción y Registro de Apodo (`#register`)
- [-] [T5] [US2.3] Build Reaction and Registration view in `src/views/registerView.js` and `styles/register.css` displaying the captured WebP photo inside a gothic Halloween Polaroid frame, with accessible layout and fallback spooky avatar when camera is unavailable.
- [ ] [T6] [US2.3] Implement nickname input validation (3–20 characters, sanitisation), submission button publishing `screamer:nickname-submitted` payload via EventBus (preparing data for EPIC3), "Jugar de nuevo" restart action, and unit tests in `tests/registerView.test.js`.
