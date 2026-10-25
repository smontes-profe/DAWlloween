# Specifications: EPIC4 - Hall of Fame & Despliegue

## Status
`spec` (Agreed with PM)

## Scope & Objectives
Implement the public Hall of Fame exhibition view (`HallOfFameView`) to showcase players' Halloween reaction clips (looping WebM video clips or WebP Polaroid photos) and nicknames retrieved from Supabase Database (`hall_of_fame` table). The gallery is built from the ground up using a strict **Mobile-First** responsive architecture (CSS Grid/Flexbox) that renders seamlessly from 320px mobile displays up to 1080p/4K classroom projectors. Support direct URL navigation (`#hall-of-fame`) via the SPA hash router and dynamic periodic or on-demand content synchronisation without requiring full browser reloads. Finally, establish an automated GitHub Actions CI/CD workflow (`deploy.yml`) that safely builds and deploys the static application to GitHub Pages, injecting Supabase credentials from GitHub Repository Secrets/Variables.

---

## User Stories

### US4.1: Vista Pública y Mural del Hall of Fame (Mobile-First & Responsive)
- **Story**: **As a** student on my mobile phone or spectator viewing the classroom projector, **I want** to access `#hall-of-fame` directly and view an atmospheric, fluid gallery of terror designed Mobile-First with CSS Grid, **so I can** enjoy and share the looping reaction videos and photos of all participants across any device size.
- **Acceptance Criteria**:
  - Registers `#hall-of-fame` in `src/router.js` and mounts `HallOfFameView` in `src/views/hallOfFameView.js`.
  - Implements a Mobile-First layout starting with a 1-column mobile feed (320px+) scaling smoothly to 2-3 columns on tablets/laptops and 4+ columns on large desktop/projector screens using CSS Grid (`repeat(auto-fill, minmax(280px, 1fr))`) and fluid typography (`clamp()`).
  - Fetches records from Supabase (`hall_of_fame` table) via `supabaseService.fetchHallOfFame()` ordered by `created_at DESC`.
  - For each reaction card, renders:
    - Autoplaying, muted, looping video preview (`<video src="..." autoplay loop muted playsinline>`) if `video_url` is present.
    - Spooky Polaroid image thumbnail fallback (`<img src="..." loading="lazy">`) if only `photo_url` is available.
    - Player nickname with sanitised text rendering.
    - Relative or formatted Halloween timestamp (e.g. "Hace 5 minutos" / ISO date formatting).
  - Provides Halloween thematic styling in `styles/hallOfFame.css` with dark gothic frames, glowing pumpkin borders, and smooth hover micro-animations.
  - Handles loading skeleton/spinner state while data is being fetched and renders an atmospheric empty state banner ("Aún no hay almas capturadas...") if no records exist.

### US4.2: Sincronización y Refresco Dinámico del Mural
- **Story**: **As a** spectator watching the classroom projector mural, **I want** the reaction feed to refresh periodically or on-demand via an accessible floating action button, **so I can** witness newly submitted scare reactions without reloading the page.
- **Acceptance Criteria**:
  - Implements an accessible floating or header refresh button in `HallOfFameView` with Halloween iconography (e.g. 🔄 / 👻) and loading spin animation.
  - Triggers a non-blocking background fetch when clicked, updating the card grid smoothly.
  - Optionally configures a configurable polling interval (e.g. every 30–60 seconds) when the `#hall-of-fame` view is active, pausing automatically when the user navigates away or when the tab is hidden (`document.hidden`).
  - Displays transient non-intrusive toast notification via `alertsService` when new reactions are fetched.

### US4.3: Despliegue Automatizado en GitHub Pages con GitHub Actions
- **Story**: **As a** DAW teacher and repository maintainer, **I want** an automated GitHub Actions CI/CD workflow that safely compiles environment configurations from Repository Secrets and publishes the site to GitHub Pages, **so I can** host the live experience for the school community without exposing secrets in the git commit history.
- **Acceptance Criteria**:
  - Creates a GitHub Actions workflow in `.github/workflows/deploy.yml` triggered on push to `main` branch.
  - Injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` from repository secrets into `src/env.local.js` or directly prepares the production distribution bundle.
  - Verifies that unit tests (`npm test` / Node test runner) run and pass before deployment.
  - Deploys the static site cleanly to GitHub Pages (`gh-pages` branch or GitHub Pages action).
  - Documents configuration instructions in `README.md` or deployment guide.

---

## Technical Constraints & Design Patterns
- **Strict Tech Stack**: Vanilla JavaScript (ES Modules), HTML5 Video/Audio, Vanilla CSS (CSS Grid, Flexbox, CSS Variables, `clamp()`, media queries). No external UI frameworks.
- **Mobile-First Philosophy**: Base styles written for mobile viewports (320px–480px), progressively enhanced with `min-width` media queries for tablets (768px), laptops (1024px), and projection displays (1440px+).
- **Zero Local Persistence**: Feed records fetched strictly in-memory; no caching of video Blobs or database rows in `localStorage` or `sessionStorage`.
- **Design Patterns**:
  - *Component / View Pattern*: `HallOfFameView` encapsulating template lifecycle (`mount()`, `destroy()`, `render()`).
  - *Observer / EventBus*: Decoupled notification handling for updates.
  - *Singleton Service*: Interfacing with `supabaseService.fetchHallOfFame()`.
- **Language Standards**: Strict UK English (`en-GB`) for all code entities, identifiers, comments, and tests (`initialise`, `colour`, `synchronise`, `optimise`).
