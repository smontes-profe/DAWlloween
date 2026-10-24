# Program Planner - Task Backlog (EPIC3)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-24)
- **Scope**: EPIC3 - Persistencia Cloud (Supabase) & Resiliencia (Cloud Persistence & Resilience)

---

## Task Backlog

### US3.1: Configuración y Cliente Modular de Supabase
- [<] [T0] [US3.1] Create configuration module `src/config.js` defining `SUPABASE_CONFIG` (`url`, `anonKey`, `storageBucket: 'reactions'`, `tableName: 'hall_of_fame'`, `maxRetries: 3`, `retryDelayMs: 2000`) and mock/offline detection mode, with unit tests in `tests/config.test.js`.
- [<] [T1] [US3.1] Implement modular Supabase client service in `src/services/supabase.js` using `@supabase/supabase-js` (via ESM import), supporting initialisation, credential checks, mock transport for offline/test environments, and unit tests in `tests/supabase.test.js`.

### US3.4: Sistema de Alertas Visuales y Mecanismo de Reintentos (Resiliencia)
- [<] [T2] [US3.4] Complete and verify Halloween-themed visual styling for toast alerts in `styles/alerts.css` (`toast--info`, `toast--warning`, `toast--error`, `toast--success`, spectral glow animations, and ARIA live accessibility), ensuring seamless loading in `index.html`.
- [<] [T3] [US3.4] Implement an in-memory exponential backoff retry manager (`withRetry()`) in `src/utils/retry.js` adhering strictly to zero local persistence, emitting EventBus events (`storage:uploading`, `storage:retry`, `storage:error`, `storage:success`) to feed visual toasts in `alerts.js`, with unit tests in `tests/retry.test.js`.

### US3.2: Subida de Clips de Vídeo y Fotos a Supabase Storage (Bucket `reactions`)
- [<] [T4] [US3.2] Implement `uploadReactionMedia(blobOrDataUrl, options)` in `src/services/supabase.js` to upload in-memory WebM video Blobs (and/or WebP photo fallbacks) to the `reactions` bucket with collision-free filenames (`reaction_<timestamp>_<uuid>.<ext>`) and retrieve permanent public URLs.
- [<] [T5] [US3.2] Implement unit and integration tests in `tests/storageUpload.test.js` validating MIME types (`video/webm`, `image/webp`), unique file naming, public URL resolution, network error simulation, and mock cloud upload verification.

### US3.3: Inserción de Registros en Base de Datos (Tabla `hall_of_fame`) e Integración E2E
- [-] [T6] [US3.3] Implement `insertReactionRecord({ nickname, videoUrl, photoUrl })` in `src/services/supabase.js` to insert `{ id, nickname, video_url, photo_url, created_at }` rows into the `hall_of_fame` table with validation and response checking.
- [ ] [T7] [US3.3] Wire the submission workflow in `src/views/registerView.js`: disable submission button on click, show progress toast ("Enviando reacción al más allá..."), execute storage upload and database insertion with automatic retries, show celebratory toast on success, and transition SPA router to `#hall-of-fame`.
- [ ] [T8] [US3.3] Create end-to-end integration tests in `tests/persistenceIntegration.test.js` verifying the complete pipeline from `RegisterView` form submit through cloud persistence, retry resilience on simulated microcuts, and router navigation.
