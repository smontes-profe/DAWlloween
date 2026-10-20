# 🎃 DAWlloween

[![Vanilla JS](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas%202D-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Vanilla CSS](https://img.shields.io/badge/CSS3-Modern%20Responsive-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![Supabase](https://img.shields.io/badge/Backend-Supabase%20Free%20Tier-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Methodology](https://img.shields.io/badge/Methodology-Spec--Driven%20Agile-purple)](#methodology--sdd)
[![Language](https://img.shields.io/badge/Code%20Language-UK%20English-012169)](#code-standards)

An interactive, spine-chilling Halloween Single Page Application (SPA) designed as an attraction for vocational training students (*DAW - Desarrollo de Aplicaciones Web*) at **Ilerna Sevilla**.

---

## 👻 Project Overview

DAWlloween serves as an interactive showcase of modern web application development capabilities for students from other educational programmes during Halloween festivities. 

The experience follows a 4-phase user journey:
1. **The Decoy Game**: A minimalist browser survival game inspired by *Vampire Survivors*, built with HTML5 Canvas 2D. The gameplay aims to keep players focused for 30–60 seconds.
2. **The Jumpscare & Reaction Capture**: An unexpected audiovisual scare synchronised with an instantaneous webcam snapshot capturing the player's terrified reaction.
3. **Cloud Persistence with Retry Resilience**: The compressed reaction photo (WebP) and player nickname are sent directly to **Supabase** (Storage + PostgreSQL Database). No local storage is used; connection microcuts trigger automated retries and visual alerts.
4. **The Hall of Fame**: A dark-themed, responsive photo mosaic gallery where visitors can review all captured reactions in real-time in the classroom or remotely from their mobile devices.

---

## 🛠️ Technology Stack

- **Frontend Core**: Vanilla JavaScript (ES Modules), HTML5 Canvas 2D, Vanilla CSS (CSS Grid, Flexbox, CSS Variables). No heavy frontend frameworks to maintain simplicity and educational clarity.
- **Backend as a Service (BaaS)**: **Supabase** (PostgreSQL Database & Object Storage with Row Level Security).
- **Deployment & Hosting**: Static cloud hosting (**Vercel** / **GitHub Pages**) with mandatory HTTPS for secure camera stream permissions (`navigator.mediaDevices.getUserMedia`).
- **Resilience**: Zero local persistence policy. Autonomous periodic retries with user-friendly toast notifications upon network interruptions.

---

## 📐 Pedagogical Design Patterns & Coding Standards

This project is tailored as an exemplary educational reference for 1st and 2nd year DAW students, strictly adhering to clean code principles:

- **State Pattern**: Orchestrates SPA transitions (`#home`, `#play`, `#screamer`, `#register`, `#hall-of-fame`) and game state.
- **Observer / Event Bus (Pub-Sub)**: Decouples communication between game events, jumpscare triggers, webcam capture, and UI notification toasts.
- **Module / Singleton Pattern**: Encapsulates external services (`supabase.js`, `camera.js`, `alerts.js`).
- **Factory Pattern**: Dynamically spawns game entities (player, supernatural foes).
- **UK English (`en-GB`)**: All variables, functions, constants, comments, and identifiers are strictly written in UK English.

---

## 📱 Accessibility & Responsive Design

- **Desktop-Optimised Gaming**: The gameplay and jumpscare experience are tuned for desktop displays (1080p, 720p, laptop monitors) equipped with webcams.
- **Mobile-Ready Hall of Fame**: The *Hall of Fame* is fully responsive for smartphones and tablets, allowing students to browse their souvenirs comfortably from home.
- **Accessibility (a11y)**: High-contrast Halloween colour scheme, accessible semantic markup, clear visual focus indicators, and keyboard navigation support.

---

## 📂 Repository Structure

```text
DAWlloween/
├── docs/                      # Architectural specifications & project roadmap
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── GLOSSARY.md
├── specs/                     # Spec-Driven Development epics and task backlogs
│   ├── SPECS.md
│   └── EPIC0/
├── public/                    # Static assets (jumpscare media, audio, sprites)
│   └── assets/
│       ├── screams/
│       └── sprites/
├── src/                       # Application source code (ES Modules)
│   ├── app.js                 # SPA router and main orchestrator
│   ├── config.js              # Environment settings and Supabase configuration
│   ├── game/                  # Canvas 2D game loop and entities
│   ├── screamer/              # Webcam stream capture & jumpscare coordination
│   ├── services/              # Supabase client and network retry services
│   ├── ui/                    # Shared visual notifications (alerts/toasts)
│   └── views/                 # SPA view renderers
├── styles/                    # Vanilla CSS stylesheets
└── index.html                 # Main entry point
```

---

## 🚀 Getting Started

### Prerequisites
A modern web browser supporting ES Modules and the WebRTC MediaDevices API (Google Chrome, Firefox, Microsoft Edge, Safari).

### Local Execution
Because webcam access requires a secure context (HTTPS or `localhost`), run a local web server:

Using any local HTTP server (such as Live Server in VS Code, Vite, Python, or MAMP):
```bash
# Example using npx serve or python
npx serve .
# or
python -m http.server 8000
```
Then navigate to `http://localhost:8000`.

---

## 📜 Methodology & SDD

This repository is governed by **Spec-Driven Development (SDD)** in conjunction with Agile sprints:
1. `Spec` ➔ Detailed requirements agreed with the PM.
2. `Plan` ➔ Prioritised user story sequencing.
3. `Tasks` ➔ Actionable, granular task backlogs.
4. `Implement` ➔ Step-by-step TDD / incremental build with verification.
5. `Review` ➔ Validation against documented acceptance criteria.

---

## 🎃 Authors & Acknowledgements

Created with passion for **DAW 1** and **DAW 2** students at **Ilerna Sevilla** for an unforgettable Halloween showcase.
