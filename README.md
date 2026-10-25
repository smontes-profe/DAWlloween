# 🎃 DAWlloween

[![Vanilla JS](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas%202D-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Vanilla CSS](https://img.shields.io/badge/CSS3-Modern%20Responsive-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![Supabase](https://img.shields.io/badge/Backend-Supabase%20Free%20Tier-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![CI/CD](https://img.shields.io/badge/Deployment-GitHub%20Pages%20via%20Actions-blue?logo=githubactions&logoColor=white)](https://github.com/)
[![Methodology](https://img.shields.io/badge/Methodology-Spec--Driven%20Agile-purple)](#-methodology--sdd)

An interactive, spine-chilling Halloween Single Page Application (SPA) designed as an educational attraction and live showcase for vocational training students (*DAW - Desarrollo de Aplicaciones Web*) at **Ilerna Sevilla**.

---

## 👻 Project Overview

DAWlloween demonstrates modern client-side web development techniques without framework bloat, serving as a live attraction for visitors during Halloween festivities.

The user journey consists of 4 distinct phases:
1. **The Decoy Game (`#play`)**: An arcade survival mini-game inspired by *Vampire Survivors*, crafted in Vanilla HTML5 Canvas 2D. Players survive against supernatural foes (ghosts, zombies, pumpkin brutes) for 30–60 seconds.
2. **The Jumpscare & Reaction Capture (`#screamer`)**: A synchronised audiovisual scare triggered at the climax, capturing the player's terrified reaction via background webcam streaming (WebM video clip with WebP photo fallback).
3. **Cloud Persistence with Retry Resilience (`#register`)**: Player nicknames and media reactions are uploaded directly to **Supabase** (Object Storage + PostgreSQL Database) with exponential backoff retries and non-blocking toast alerts.
4. **The Hall of Fame (`#hall-of-fame`)**: A dark gothic, fluid reaction wall designed for classroom projectors (1080p/1440p) and mobile devices (320px+), featuring looping reaction cards, floating refresh actions, and background polling synchronisation.

---

## 🛠️ Technology Stack & Pedagogical Constraints

- **Core Frontend**: Vanilla JavaScript (**ES Modules**), HTML5 Canvas 2D, and Modern Vanilla CSS (CSS Grid, Flexbox, Custom Properties, `clamp()`).
- **No Heavy Frameworks**: No React, Vue, Bootstrap, or TailwindCSS. Clean, accessible code written as a teaching model.
- **Backend as a Service (BaaS)**: **Supabase** (PostgreSQL Database & Object Storage with Row Level Security).
- **Deployment & Hosting**: Static hosting via **GitHub Pages** using **GitHub Actions CI/CD**.
- **Zero Local Persistence**: No `localStorage` or `sessionStorage` for user reaction media.
- **UK English (`en-GB`)**: All codebase identifiers, functions, comments, docstrings, and commits follow British English standards (`initialise`, `colour`, `synchronise`, `optimise`).

---

## 📐 Software Design Patterns

The architecture serves as an exemplary educational reference for 1st and 2nd year DAW students:

| Pattern | Implementation | Purpose |
| :--- | :--- | :--- |
| **State Pattern** | `src/app.js` (`Router`) | Manages SPA view transitions and lifecycle hooks (`mount` / `unmount` / `destroy`). |
| **Observer / Pub-Sub** | `src/utils/eventBus.js` | Decouples game events, jumpscare triggers, webcam frames, and UI alerts. |
| **Singleton / Module** | `src/services/supabase.js`, `src/ui/alerts.js` | Provides centralised, isolated services throughout the application. |
| **Factory Pattern** | `src/game/entities.js` (`EntityFactory`) | Spawns polymorphic game entities (Player, Projectiles, Ghosts, Zombies, Brutes). |

---

## 📂 Repository Structure

```text
DAWlloween/
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD pipeline (Tests + Secrets Injection + GitHub Pages)
├── assets/                    # Static media (sound effects, ambient music, jumpscare clips)
│   ├── audio/
│   └── screamer/
├── docs/                      # Architectural contracts and SDD roadmap
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── GLOSSARY.md
├── specs/                     # Spec-Driven Development epics and task backlogs
│   ├── SPECS.md
│   ├── EPIC1/
│   ├── EPIC2/
│   ├── EPIC3/
│   └── EPIC4/
├── src/                       # Application source code (ES Modules)
│   ├── app.js                 # SPA router and orchestrator
│   ├── config.js              # Centralised configuration & diagnostics
│   ├── env.example.js         # Environment template for credentials
│   ├── game/                  # 2D Canvas engine, physics, weapons & entities
│   ├── screamer/              # MediaRecorder, webcam streams & audio triggers
│   ├── services/              # Supabase API client and resilience retry logic
│   ├── ui/                    # Accessible Halloween toast notifications
│   ├── utils/                 # EventBus and helper utilities
│   └── views/                 # View components (Welcome, Game, Screamer, Register, HallOfFame)
├── styles/                    # Modern Vanilla CSS design system
│   ├── main.css               # Design tokens, gothic typography & layout
│   ├── game.css               # HUD, canvas container & arcade styles
│   ├── screamer.css           # Jumpscare animations & flash effects
│   ├── register.css           # Preview card & nickname form
│   ├── alerts.css             # Floating toast alerts
│   └── hallOfFame.css         # Responsive fluid grid & reaction cards
├── tests/                     # Comprehensive native test suite (node:test)
├── index.html                 # Main application entry point
└── README.md                  # Project documentation & student deployment guide
```

---

## 💻 Local Development Setup (MAMP / Local Server)

Because the WebRTC Camera API (`navigator.mediaDevices.getUserMedia`) strictly requires a **Secure Context** (HTTPS or `localhost`), DAW students should run the application on a local server.

### Option 1: Running in MAMP (Recommended for DAW Students)

1. Clone or copy the `DAWlloween` folder into your MAMP `htdocs` directory:
   - **Windows**: `C:\MAMP\htdocs\DAWlloween`
   - **macOS**: `/Applications/MAMP/htdocs/DAWlloween`
2. Start the **MAMP** servers (Apache).
3. Configure your local environment variables:
   - Copy `src/env.example.js` to `src/env.local.js`:
     ```bash
     cp src/env.example.js src/env.local.js
     ```
   - Open `src/env.local.js` and enter your Supabase URL and Anon Key:
     ```javascript
     window.__ENV__ = {
       SUPABASE_URL: 'https://your-project-id.supabase.co',
       SUPABASE_ANON_KEY: 'your-anon-key'
     };
     ```
   *(Note: `src/env.local.js` is automatically ignored by `.gitignore` to prevent leaking credentials).*
4. Open your browser and navigate to:
   - Default MAMP Apache port: `http://localhost/DAWlloween/` (or `http://localhost:8888/DAWlloween/` depending on your MAMP port configuration).
5. If Supabase credentials are left with placeholders, the app automatically activates **Diagnostic Mock Mode**, allowing full offline testing of the game, jumpscare, and mocked storage!

### Option 2: Running with Node.js / Python

```bash
# Using Python 3 built-in server:
python -m http.server 8000

# Or using npx serve:
npx serve .
```
Navigate to `http://localhost:8000`.

---

## 🧪 Running Automated Unit Tests

DAWlloween utilises Node.js's native test runner (`node:test` and `node:assert/strict`). **No external test packages (such as Jest or Mocha) are required!**

Run the complete test suite (36 test suites, 230+ tests):
```bash
node --test tests/*.test.js
```

Run a specific test suite:
```bash
# Test the 2D Game Engine:
node --test tests/engine.test.js

# Test Supabase Cloud Resilience:
node --test tests/persistenceIntegration.test.js

# Test Hall of Fame Responsive View:
node --test tests/hallOfFameView.test.js

# Test CI/CD Deployment Workflow:
node --test tests/ciWorkflow.test.js
```

---

## ☁️ Supabase Cloud Configuration

To enable real cloud persistence for classroom presentations:

1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. In the **Storage** section, create a public bucket named `reactions`:
   - Bucket name: `reactions`
   - Public bucket: **Enabled**
3. In the **SQL Editor**, run the following schema migration to create the table and policies:

```sql
-- 1. Create table for reactions
CREATE TABLE IF NOT EXISTS public.hall_of_fame (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname VARCHAR(20) NOT NULL,
  photo_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.hall_of_fame ENABLE ROW LEVEL SECURITY;

-- 3. Allow anonymous reads for the Hall of Fame wall
CREATE POLICY "Public read access for Hall of Fame"
  ON public.hall_of_fame FOR SELECT
  TO anon
  USING (true);

-- 4. Allow anonymous inserts for game registrations
CREATE POLICY "Public insert access for Hall of Fame"
  ON public.hall_of_fame FOR INSERT
  TO anon
  WITH CHECK (true);
```

---

## 🚀 Automated Deployment with GitHub Pages & Actions

The repository includes a production-grade CI/CD pipeline in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that executes automated quality checks and deploys the application to **GitHub Pages**.

### Step 1: Configure GitHub Repository Secrets

To allow the static build on GitHub Pages to connect to your Supabase project securely without exposing keys in your public Git commits:

1. In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add the following two secrets:
   - Name: `SUPABASE_URL` | Value: `https://your-project-id.supabase.co`
   - Name: `SUPABASE_ANON_KEY` | Value: `your-anon-public-key`

### Step 2: Configure GitHub Pages Source

1. In your GitHub repository, navigate to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.

### Step 3: Triggering Deployment

Every push to the `main` branch automatically triggers the workflow:
1. **QA Step (`test`)**: Spins up Ubuntu with Node.js 20 and executes `node --test tests/*.test.js`. If any test fails, deployment is automatically halted.
2. **Deploy Step (`deploy`)**: Injects the repository secrets into `src/env.local.js`, bundles the static assets, and deploys directly to `https://<username>.github.io/<repo-name>/`.
3. You can also manually trigger a deployment at any time from the **Actions** tab by selecting **Deploy DAWlloween to GitHub Pages** > **Run workflow**.

---

## 📜 Methodology & SDD

This project strictly follows **Spec-Driven Development (SDD)** with Agile iterations:
1. `Spec`: Technical specifications agreed with the Product Manager.
2. `Plan`: Priority ordering and component dependency graph.
3. `Tasks`: Traceable, granular tasks.
4. `Implement`: Test-Driven Development (TDD) and clean code implementation.
5. `Review`: User Story validation and verification against acceptance criteria.

---

## 🎃 Authors & Acknowledgements

Created with pride for **DAW 1** and **DAW 2** students at **Ilerna Sevilla** for an unforgettable Halloween showcase. Happy coding and happy Halloween! 👻🎃
