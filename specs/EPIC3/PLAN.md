# Program Planner - Implementation Plan (EPIC3)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-24)
- **Scope**: EPIC3 - Persistencia Cloud (Supabase) & Resiliencia (Cloud Persistence & Resilience)

---

## User Story Execution Order & Priorities

| Execution Order | User Story | Priority | Dependencies | Summary |
|:---:|---|:---:|:---:|---|
| **1** | **US3.1: Configuración y Cliente Modular de Supabase** | High | `src/config.js`, Supabase JS SDK (ESM) | Encapsulate the official Supabase client initialisation in `src/services/supabase.js`, configure credentials reading (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) from `src/config.js`, and provide mock transport / offline simulation capabilities for unit testing. |
| **2** | **US3.4: Sistema de Alertas Visuales y Mecanismo de Reintentos (Resiliencia)** | High | Themed CSS design tokens, `eventBus` | Implement atmospheric Halloween-themed UI alerts/toasts (`src/ui/alerts.js` & `styles/alerts.css`) and an in-memory exponential backoff retry loop mechanism. Having toast notifications ready enables visual feedback for ongoing uploads, warnings, and retry attempts from the outset. |
| **3** | **US3.2: Subida de Clips de Vídeo y Fotos a Supabase Storage (Bucket `reactions`)** | High | US3.1, US3.4, `screamer:nickname-submitted` payload (US2.4) | Implement storage upload methods in `src/services/supabase.js`: receives in-memory video `Blob` (or fallback image `Blob`/dataURL), generates collision-free object names (`reaction_<timestamp>_<uuid>.<ext>`), uploads to the `reactions` bucket, and retrieves permanent public URLs. |
| **4** | **US3.3: Inserción de Registros en Base de Datos (Tabla `hall_of_fame`) e Integración E2E** | High | US3.1, US3.2, US3.4, `RegisterView` | Connect the `#register` view submission handler: trigger storage upload, insert row `{ id, nickname, video_url, photo_url, created_at }` into Supabase `hall_of_fame` table, handle success/error toasts, and seamlessly transition the SPA router to `#hall-of-fame`. |

---

## Technical Dependencies & Architecture Alignment

- **Design Patterns**:
  - *Singleton / Service Module Pattern*: `supabaseService` for data persistence, `alertsService` for toast notifications.
  - *Observer / Event Bus*: Decoupled persistence events (`storage:uploading`, `storage:retry`, `storage:success`, `storage:error`).
  - *State Pattern*: Submission pipeline states (`IDLE`, `UPLOADING`, `RETRYING`, `SUCCESS`, `FAILED`).
- **Zero Local Persistence**:
  - In strict compliance with project constraints, no media blobs, URLs, or registration data are saved to `localStorage`, `sessionStorage`, or cookies. Retry queues and pending uploads exist exclusively in-memory.
- **Language Standards**: Strict adherence to UK English (`en-GB`) across all code entities, methods, comments, and tests (`initialiseClient`, `colour`, `optimise`, `serialise`).
- **Resilience Strategy**:
  - Exponential backoff with jitter on network timeouts or HTTP 5xx errors (up to 3–5 retries).
  - Clear, non-intrusive Halloween-themed UI toasts informing the player of network status.

---

## Open Questions & Risks
- *Supabase Credentials in Development*: In local/test environments without active Supabase credentials, the service will provide graceful mocking or mock responses so automated tests and offline development operate smoothly.
- *Large Video Upload Times*: 2-second WebM clips recorded by `recorder.js` are ~250–400 KB, ensuring rapid uploads even on constrained school networks.
