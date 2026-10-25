# Program Planner - Task Backlog (EPIC4)

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-25)
- **Scope**: EPIC4 - Hall of Fame & Despliegue (Hall of Fame & Deployment)

---

## Task Backlog

### US4.1: Vista Pública y Mural del Hall of Fame (Mobile-First & Responsive)
- [x] [T0] [US4.1] Create Halloween-themed Mobile-First stylesheet `styles/hallOfFame.css` with fluid CSS Grid layout (`minmax(280px, 1fr)`), 1-column mobile base (320px+), progressive media queries for tablet (768px), desktop (1024px) and projector (1440px+), dark gothic cards with spectral glow borders, skeleton loading placeholders, and link it in `index.html`.
- [x] [T1] [US4.1] Implement `HallOfFameView` component in `src/views/hallOfFameView.js` fetching records from Supabase via `supabaseService.fetchHallOfFame()`, rendering looping video cards (`<video autoplay loop muted playsinline>`) with fallback to WebP photos (`<img>`), sanitised nicknames, relative timestamps, skeleton loaders, and empty gallery state.
- [x] [T2] [US4.1] Register `#hall-of-fame` route in `src/router.js`, wire `#nav-link-hall` header link, and implement unit tests in `tests/hallOfFameView.test.js` validating mounting, card rendering, mobile/responsive layout, and empty/error states.

### US4.2: Sincronización y Refresco Dinámico del Mural
- [x] [T3] [US4.2] Implement an accessible floating action button (FAB) in `HallOfFameView` with Halloween ghost icon and spin animation, enabling manual non-blocking background refresh of reactions without page reload.
- [x] [T4] [US4.2] Implement configurable background polling mechanism (every 30–60s) in `HallOfFameView` with lifecycle and visibility detection (`visibilitychange` / `document.hidden`) to pause when tab is inactive, emitting toast notifications on newly arrived reactions, with unit tests in `tests/hallOfFameSync.test.js`.

### US4.3: Despliegue Automatizado en GitHub Pages con GitHub Actions
- [x] [T5] [US4.3] Create CI/CD workflow in `.github/workflows/deploy.yml` triggered on push to `main`, validating entire test suite (`node --test tests/*.test.js`), injecting Supabase Repository Secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), and deploying automatically to GitHub Pages (`gh-pages`).
- [x] [T6] [US4.3] Update `README.md` with pedagogical deployment guide, GitHub secrets configuration, and local MAMP instructions for DAW students.
