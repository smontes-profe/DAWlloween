# ROADMAP

Status legend:

- `new`
- `spec`
- `plan`
- `tasks`
- `implement`               
- `review`
- `done`

| ID    | Name                                        | Objective                                                                                                                                                                                                                                                                             | Status | Finished   |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| EPIC0 | First product epic                          | Create the basic foundation of the project: agents constitution, initial specs, architecture and initial roadmap so the project can start normal SDD Sprint execution.                                                                                                                | done   | 2026-10-21 |
| EPIC1 | Mini-juego señuelo 2D                       | Estructura base SPA (HTML5/CSS temática Halloween), pantalla de inicio, solicitud de permisos de cámara y minijuego en Canvas 2D (movimiento, enemigos básicos y temporizador de 30–60s).                                                                                             | done   | 2026-10-24 |
| EPIC2 | Jumpscare & Captura de Cámara               | Conexión del stream de webcam en segundo plano, sincronización del susto audiovisual sorpresivo, grabación de clip de vídeo de reacción (WebM) de 2 segundos mediante MediaRecorder (con fallback a fotograma WebP) y pantalla de vista previa con formulario para ingresar el apodo. | done   | 2026-10-24 |
| EPIC3 | Persistencia Cloud (Supabase) & Resiliencia | Integración con Supabase Storage (subida de clips de vídeo y fotos) y Database (tabla `hall_of_fame`), con sistema de reintentos automáticos y alertas visuales en caso de corte de conexión.                                                                                         | done   | 2026-10-25 |
| EPIC4 | Hall of Fame & Despliegue                   | Vista pública y mural proyectable para el aula del Hall of Fame (mosaico de vídeos de reacción en bucle y nombres), acceso directo vía URL para visitantes y configuración para despliegue en Vercel / GitHub Pages.                                                                  | done   | 2026-10-25 |

## Notes

- `EPIC0` is the default epic for each SDD project needed to start normal SDD.
- Each epic should live in `specs/EPICX/` with its own focused docs.
- `EPIC0` ships scaffolded and starts in `implement`.
- Keep roadmap entries short and actionable.

