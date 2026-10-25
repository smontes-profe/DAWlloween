# Program Planner - Implementation Plan (EPIC4)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-25)
- **Scope**: EPIC4 - Hall of Fame & Despliegue (Hall of Fame & Deployment)

---

## User Story Execution Order & Priorities

| Execution Order | User Story | Priority | Dependencies | Summary |
|:---:|---|:---:|:---:|---|
| **1** | **US4.1: Vista Pública y Mural del Hall of Fame (Mobile-First & Responsive)** | High | `src/router.js`, `src/services/supabase.js`, `styles/main.css` | Implement `HallOfFameView` in `src/views/hallOfFameView.js` and register `#hall-of-fame` route in `src/router.js`. Architect with strict Mobile-First principles (1-column layout on 320px+ mobile devices scaling up via CSS Grid `minmax()` to 4+ columns on desktops and classroom projectors). Fetch and render looping WebM video clips (or WebP Polaroid fallbacks), player nicknames, formatted timestamps, skeleton loading states, and empty gallery messages. |
| **2** | **US4.2: Sincronización y Refresco Dinámico del Mural** | Medium-High | US4.1, `src/services/alerts.js` | Implement an accessible floating action refresh button (FAB) with Halloween ghost/spin animations. Add dynamic non-blocking background fetching and configurable polling (every 30–60s) with visibility detection (`document.hidden`) to keep classroom projectors live with new victims without reloading the browser. |
| **3** | **US4.3: Despliegue Automatizado en GitHub Pages con GitHub Actions** | High | US4.1, US4.2, test suites (`node --test tests/*.test.js`) | Implement `.github/workflows/deploy.yml` CI/CD workflow for GitHub Pages. Execute automated unit test validation, securely inject Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) from Repository Secrets/Variables, and publish the static app without committing secrets to source control. Document setup in `README.md`. |

---

## Technical Dependencies & Architecture Alignment

- **Strict Mobile-First & Vanilla CSS**:
  - Base styles designed for mobile viewports (320px–480px) and progressively enhanced using `min-width` media queries for tablet (768px), desktop (1024px), and large projector displays (1440px+).
  - Modern CSS Grid (`repeat(auto-fill, minmax(280px, 1fr))`) and fluid typography (`clamp()`).
- **Multimedia Performance**:
  - Video tags configured with `autoplay loop muted playsinline` for reliable mobile/projector playback.
  - Image thumbnails configured with `loading="lazy"`.
- **Zero Local Persistence**:
  - Reaction records exist solely in-memory; no persistence in `localStorage` or `sessionStorage`.
- **Language Standards**: Strict adherence to UK English (`en-GB`) across all code entities, methods, comments, and tests (`initialise`, `colour`, `synchronise`, `optimise`).

---

## Open Questions & Risks
- *Autoplay Policies in Browsers*: Muted video playback (`muted playsinline`) bypasses mobile and browser autoplay restrictions safely, ensuring looping video reactions play without user gesture requirements.
- *GitHub Pages Base URL*: Hash-based routing (`#hall-of-fame`, `#home`) guarantees that direct navigation works out of the box on GitHub Pages without requiring complex 404.html redirect tricks.
