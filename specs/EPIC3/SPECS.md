# Specifications: EPIC3 - Persistencia Cloud (Supabase) & Resiliencia

## Status
`spec` (Agreed with PM)

## Scope & Objectives
Integrate cloud persistence using Supabase BaaS (free tier) to securely store players' Halloween reaction video clips and photos in Supabase Storage (`reactions` bucket) and log their nicknames, timestamps, and media references into Supabase Database (`hall_of_fame` table). Provide robust resilience against network microcuts or connectivity drops in the classroom via automatic periodic retries and visual alerts/toasts, while strictly maintaining zero local persistence (no saving to `localStorage`, `sessionStorage`, or cookies).

---

## User Stories

### US3.1: Configuración y Cliente Modular de Supabase
- **Story**: **As a** developer and DAW student, **I want** a cleanly encapsulated Supabase client service reading environment credentials from configuration, **so I can** interact with cloud storage and database services in a modular, decoupled manner.
- **Acceptance Criteria**:
  - Encapsulates Supabase client initialisation in `src/services/supabase.js` using credentials (`SUPABASE_URL` and `SUPABASE_ANON_KEY`) from `src/config.js`.
  - Supports dependency injection or mock transport to allow unit testing and offline development without active cloud network calls.
  - Validates presence and format of required cloud credentials, emitting clear diagnostic logs if misconfigured.

### US3.2: Subida de Clips de Vídeo y Fotos a Supabase Storage (Bucket `reactions`)
- **Story**: **As a** player who completed the game, **I want** my 2-second reaction video clip (or snapshot photo fallback) uploaded securely to cloud storage, **so I can** share my scare and have it displayed in the Hall of Fame.
- **Acceptance Criteria**:
  - Ingests the in-memory video `Blob` (or fallback image `Blob`/dataURL) from the `screamer:nickname-submitted` payload.
  - Generates a unique, collisions-free object key (e.g. `reaction_<timestamp>_<uuid>.<ext>`) in the `reactions` bucket.
  - Sets appropriate `contentType` headers (`video/webm`, `video/mp4`, or `image/webp`).
  - Retrieves or constructs the permanent public URL for the uploaded media asset.

### US3.3: Inserción de Registros en la Base de Datos (Tabla `hall_of_fame`)
- **Story**: **As an** event visitor and participant, **I want** my nickname, media URL, and timestamp recorded in the database, **so I can** appear in the official rankings and gallery of terror.
- **Acceptance Criteria**:
  - Inserts a new row into the `hall_of_fame` table containing:
    - `id`: Unique identifier (UUID or auto-generated).
    - `nickname`: Validated, trimmed, and sanitised player alias (3–20 characters).
    - `video_url`: Public URL to the video clip in Supabase Storage (nullable if fallback).
    - `photo_url`: Public URL to the photo snapshot in Supabase Storage.
    - `created_at`: ISO timestamp of submission.
  - Validates database response and confirms successful insertion before concluding transaction.

### US3.4: Resiliencia ante Microcortes de Red, Reintentos Automáticos y Alertas Visuales
- **Story**: **As a** player and teacher in a classroom with unstable Wi-Fi, **I want** the system to automatically retry uploading if a network microcut occurs and show thematic visual alerts, **so I don't** lose my reaction or get stuck on a broken screen.
- **Acceptance Criteria**:
  - Implements an atmospheric, Halloween-themed UI alerts/toasts notification system in `src/ui/alerts.js` and `styles/alerts.css` (info, warning, error, success).
  - Catches network timeouts, HTTP 5xx errors, or offline states gracefully without throwing unhandled exceptions.
  - Automatically re-attempts failed uploads using periodic exponential backoff (up to a configured maximum attempts, e.g. 3–5 retries) while keeping media assets strictly in-memory (zero local persistence in `localStorage`, `sessionStorage`, or cookies).
  - Displays user-friendly animated feedback during upload and retries ("Enviando reacción al más allá...", "Reintentando conexión con el inframundo...").
  - On final success, displays a celebratory toast and transitions the router to `#hall-of-fame`.
  - On persistent failure after max retries, alerts the user with options to retry manually or continue.

---

## Technical Constraints & Design Patterns
- **Strict Tech Stack**: Vanilla JavaScript (ES Modules), Vanilla CSS, official `@supabase/supabase-js` client (loaded via CDN/ESM).
- **Zero Local Persistence**: Strictly in-memory lifecycle for Blobs, URLs, and retry queues; never persist sensitive camera/video data to local storage.
- **Design Patterns**:
  - *Singleton / Module Pattern*: `supabaseService` for data persistence, `alertsService` for toast notifications.
  - *Observer / Event Bus*: Decoupled events (`storage:uploading`, `storage:retry`, `storage:success`, `storage:error`).
  - *State Pattern*: Submission pipeline states (`IDLE`, `UPLOADING`, `RETRYING`, `SUCCESS`, `FAILED`).
- **Language Standards**: Strict UK English (`en-GB`) for all code entities, identifiers, comments, and unit tests (`initialise`, `colour`, `serialise`, `optimise`).
