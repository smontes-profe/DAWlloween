# Program Planner - Implementation Plan (EPIC2)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-24)
- **Scope**: EPIC2 - Jumpscare & Captura de Cámara (Jumpscare & Webcam Capture)

---

## User Story Execution Order & Priorities

| Execution Order | User Story | Priority | Dependencies | Summary |
|:---:|---|:---:|:---:|---|
| **1** | **US2.2: Captura Instantánea de Fotograma de Webcam en Canvas (WebP)** | High | `cameraService` (US1.2), `eventBus` (US1.2) | Implement webcam frame capture module (`src/screamer/capture.js`) that grabs the video stream frame onto an off-screen Canvas, encodes it to `image/webp` (with JPEG fallback), stores it in-memory, and emits `screamer:photo-captured`. |
| **2** | **US2.1: Disparador y Efecto Audiovisual del Jumpscare (Susto)** | High | `game:trigger-screamer` (US1.6), `audioService` (US1.5), Router (US1.2), US2.2 | Build Jumpscare view (`src/views/screamerView.js`) and audio sting in `audioService`: triggers instantly on `game:trigger-screamer`, plays startling screech/sting sound, displays fullscreen visual shock (flashing ghastly silhouette and screen-shake for ~1.5s), triggers US2.2 snapshot, and transitions router to `#register`. |
| **3** | **US2.3: Pantalla de Reacción y Registro de Apodo (`#register`)** | High | US2.1, US2.2, Design tokens (US1.1) | Build Reaction and Registration view (`src/views/registerView.js` & `styles/register.css`): presents captured reaction in a Halloween Polaroid frame, provides accessible nickname input (3–20 chars, sanitised), and primary CTA button emitting `screamer:nickname-submitted` to prepare data for EPIC3 (Supabase). |
| **4** | **US2.4: Grabación de Clip de Vídeo de Reacción (WebM) con MediaRecorder y Previsualización Dinámica** | High | `cameraService` (US1.2), US2.1, US2.3 | Implement 2-second webcam video clip recording service (`src/screamer/recorder.js`) via native `MediaRecorder` upon `game:trigger-screamer`, emit `screamer:video-recorded`, render looping `<video>` in Polaroid frame, and provide graceful WebP frame fallback. |

---

## Technical Dependencies & Architecture Alignment

- **Design Patterns**:
  - *State Pattern* for SPA router view lifecycle transitions (`#play` $\to$ `#screamer` $\to$ `#register`).
  - *Observer / Event Bus* for decoupling jumpscare trigger, snapshot capture, and nickname submission (`game:trigger-screamer`, `screamer:photo-captured`, `screamer:nickname-submitted`).
  - *Singleton / Service Module* for webcam frame capture and audio service.
- **Zero Local Persistence**:
  - Reaction images and user nicknames are kept strictly in-memory or transient event payloads; never persisted to `localStorage`, `sessionStorage`, or local disk.
- **Language Standards**: Strict adherence to UK English (`en-GB`) across all identifiers, functions, classes, comments, and unit tests.
- **Responsiveness**: Responsive desktop view for reaction screen and clean mobile-friendly scaling.

---

## Open Questions & Risks
- *Camera unavailable or denied*: Handled with a graceful fallback displaying a spooky default avatar silhouette and informative toast alert.
- *WebP encoding support*: Modern browsers support `canvas.toDataURL('image/webp')` or `toBlob()`; a fallback to `image/jpeg` is implemented defensively if WebP returns an empty or unsupported string.
