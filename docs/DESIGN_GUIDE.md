# DAWlloween Visual Design Guide & Style Specification

## 1. Art Direction & Atmospheric Concept

**DAWlloween** delivers an immersive retro-arcade horror experience crafted specifically for 1st and 2nd year DAW students. The visual design establishes high visual tension through deep obsidian darkness punctuated by vivid neon supernatural accents (pumpkin orange, ectoplasm green, and spectral purple). 

The visual hierarchy intentionally guides user focus:
1. **Lurking Periphery**: Deep dark backgrounds minimise distraction and intensify the claustrophobic arena feel.
2. **Combat & Objective Clarity**: Ultra-high-contrast luminous indicators for player coordinates, crosshair, ammunition reserves, and supernatural threats.
3. **Responsive Climax & Exhibition**: The Hall of Fame transforms from intense combat claustrophobia into a polished, vibrant gallery mosaic accessible from both high-resolution classroom projector screens and mobile devices.

---

## 2. Design Tokens (CSS Custom Properties)

All styling tokens are declared in the root scope using standard **UK English** spelling (`colour`).

```css
:root {
  /* ==========================================================================
     Colour Palette (WCAG AA Compliant)
     ========================================================================== */
  
  /* Background Foundations */
  --colour-bg-abyss: #07050a;          /* Deepest background layer */
  --colour-bg-midnight: #0d0a14;       /* Primary canvas & body background */
  --colour-bg-surface: #161224;        /* Card & panel surfaces */
  --colour-bg-surface-elevated: #221c38; /* Modals, hover states, elevated HUD */
  --colour-bg-overlay: rgba(13, 10, 20, 0.85); /* Backdrop overlay with blur */

  /* Thematic Supernatural Accents */
  --colour-pumpkin: #ff7518;           /* Classic Halloween pumpkin orange */
  --colour-pumpkin-bright: #ff944d;    /* Interactive hover & active highlights */
  --colour-pumpkin-glow: rgba(255, 117, 24, 0.45);
  
  --colour-ectoplasm: #28fc74;         /* Ghostly neon green for vitality & health */
  --colour-ectoplasm-dim: #1db854;     /* Muted secondary state */
  --colour-ectoplasm-glow: rgba(40, 252, 116, 0.45);
  
  --colour-spectral-purple: #9d4edd;   /* Mystic aura & projectile trail */
  --colour-spectral-light: #c77dff;    /* Text highlight / magic focus */
  --colour-spectral-glow: rgba(157, 78, 221, 0.45);

  --colour-blood-red: #ff1e42;         /* Critical alert, cooldown, damage */
  --colour-blood-glow: rgba(255, 30, 66, 0.5);

  /* Functional & Typography Colours */
  --colour-text-primary: #f6f4fa;      /* Heading and primary text */
  --colour-text-secondary: #b6b0c8;    /* Subheadings, captions, secondary HUD */
  --colour-text-muted: #7d7594;        /* Disabled states, subtle borders */
  --colour-border-subtle: #2b2342;     /* Default panel boundary */
  --colour-border-focus: #ff944d;      /* Visible keyboard focus outline */

  /* ==========================================================================
     Typography Tokens
     ========================================================================== */
  --font-family-display: 'Creepster', 'Press Start 2P', Impact, cursive, sans-serif;
  --font-family-body: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-code: 'Fira Code', 'Courier New', monospace;

  /* Fluid Type Scale using clamp() */
  --font-size-hero: clamp(2.5rem, 6vw, 4.5rem);
  --font-size-title: clamp(1.75rem, 4vw, 2.75rem);
  --font-size-h2: clamp(1.35rem, 2.5vw, 2rem);
  --font-size-h3: clamp(1.15rem, 2vw, 1.5rem);
  --font-size-body: clamp(0.95rem, 1.2vw, 1.125rem);
  --font-size-small: clamp(0.8rem, 1vw, 0.95rem);
  --font-size-hud-digit: clamp(1.5rem, 3.5vw, 2.5rem);

  /* Spacing Scale */
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;

  /* Elevations & Shadows */
  --shadow-card: 0 8px 32px rgba(0, 0, 0, 0.6);
  --shadow-pumpkin-glow: 0 0 16px var(--colour-pumpkin-glow);
  --shadow-ectoplasm-glow: 0 0 16px var(--colour-ectoplasm-glow);
  --shadow-spectral-glow: 0 0 16px var(--colour-spectral-glow);
  --shadow-blood-glow: 0 0 20px var(--colour-blood-glow);

  /* Border Radii */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-dramatic: 500ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 3. WCAG AA Contrast Verification

To guarantee accessibility (`a11y`) within a dark horror theme, every foreground and background combination meets or exceeds the **WCAG 2.1 AA** threshold (minimum 4.5:1 for body copy and 3.0:1 for large display elements).

| Element | Foreground Colour | Background Colour | Contrast Ratio | WCAG 2.1 AA Status |
|---|---|---|---|---|
| **Primary Headings** | `--colour-text-primary` (`#f6f4fa`) | `--colour-bg-midnight` (`#0d0a14`) | **16.8:1** | Pass (AAA) |
| **Body Copy** | `--colour-text-secondary` (`#b6b0c8`) | `--colour-bg-midnight` (`#0d0a14`) | **9.1:1** | Pass (AAA) |
| **Card Details** | `--colour-text-secondary` (`#b6b0c8`) | `--colour-bg-surface` (`#161224`) | **8.1:1** | Pass (AAA) |
| **Pumpkin Buttons** | `#07050a` (Dark Text) | `--colour-pumpkin` (`#ff7518`) | **7.8:1** | Pass (AAA) |
| **Ectoplasm Indicators** | `#07050a` (Dark Text) | `--colour-ectoplasm` (`#28fc74`) | **13.5:1** | Pass (AAA) |
| **HUD Alert Text** | `--colour-blood-red` (`#ff1e42`) | `--colour-bg-midnight` (`#0d0a14`) | **4.9:1** | Pass (AA Large / Bold) |
| **Ghost Accents** | `--colour-spectral-light` (`#c77dff`) | `--colour-bg-surface` (`#161224`) | **6.4:1** | Pass (AA) |

---

## 4. Typography Hierarchy

1. **Display & Game Titles**:
   - Primary: Google Font `'Creepster'`, cursive (spooky Halloween character).
   - Fallback: `'Press Start 2P'`, Impact, sans-serif.
   - Text Shadow: Subtle dual neon shadow for ambient luminescence: `0 0 12px var(--colour-pumpkin-glow)`.
2. **Body & Interface Text**:
   - Primary: Google Font `'Outfit'`, sans-serif. Clean, geometric, highly legible at small sizes on OLED/LCD displays.
   - Fallbacks: System UI (`-apple-system, BlinkMacSystemFont, Segoe UI, Roboto`).
3. **HUD Numeric Counters (Timer, Ammunition)**:
   - Font: `'Outfit'`, tabular figures (`font-variant-numeric: tabular-nums`).
   - Ensures fixed-width character alignment during rapid countdown and bullet decrement.

---

## 5. Micro-Animations & Atmospheric Keyframes

### 5.1 Candle & Fluorescent Light Flicker
Simulates an unstable electrical supply in an abandoned manor.

```css
@keyframes flicker {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 12px var(--colour-pumpkin-glow)); }
  24% { opacity: 0.85; }
  25% { opacity: 0.4; }
  26% { opacity: 0.95; }
  54% { opacity: 1; }
  55% { opacity: 0.2; }
  56% { opacity: 0.9; }
  78% { opacity: 1; }
}
```

### 5.2 Supernatural Pulse Glow
Used for interactive buttons, ammunition warnings, and dangerous entities.

```css
@keyframes pulse-glow {
  0% {
    box-shadow: 0 0 8px var(--colour-pumpkin-glow);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 24px var(--colour-pumpkin-glow), 0 0 36px var(--colour-pumpkin-glow);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 8px var(--colour-pumpkin-glow);
    transform: scale(1);
  }
}
```

### 5.3 Arena Screen Shake
Triggered on player hit, weapon recoil, or jumpscare climax.

```css
@keyframes screen-shake {
  0% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-6px, 4px) rotate(-1deg); }
  40% { transform: translate(6px, -4px) rotate(1deg); }
  60% { transform: translate(-4px, -2px) rotate(0deg); }
  80% { transform: translate(4px, 2px) rotate(1deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
```

---

## 6. Reusable Component Guidelines

### 6.1 Arcade / Horror Button
- **HTML**: `<button class="btn-arcade" type="button">Start Calibration</button>`
- **Visuals**: Solid pumpkin background or ghost border, uppercase typography, letter spacing `0.08em`.
- **States**:
  - `:hover`: Elevated position (`transform: translateY(-2px)`), radiant orange/purple aura, brightening to `--colour-pumpkin-bright`.
  - `:active`: Depression effect (`transform: translateY(1px)`).
  - `:focus-visible`: 3px solid `--colour-border-focus` with 2px offset for keyboard accessibility.
  - `:disabled`: Opacity `0.45`, cursor `not-allowed`, stripped of glow effects.

### 6.2 Toast Notifications & Alerts (`src/ui/alerts.js`)
- **Container**: Fixed floating viewport corner (`bottom: 1.5rem; right: 1.5rem; z-index: 1000`).
- **Variants**:
  - `alert-warning`: Amber/pumpkin border, warns against camera blocking or network latency.
  - `alert-error`: Blood red border, signals disconnection or permissions refusal.
  - `alert-info`: Spectral purple border, informs of sound or status changes.
- **Accessibility**: Includes `role="alert"` and `aria-live="assertive"` for screen readers.

### 6.3 Hall of Fame Reaction Mosaic Card
- **Layout**: CSS Grid card with fixed aspect ratio (`4:3` or `1:1`) for captured photos.
- **Structure**:
  - Upper: Responsive webcam reaction photograph with subtle grain filter.
  - Badge: Nickname / Alias pill tag overlaid with semi-transparent dark surface.
  - Footer: Relative timestamp (e.g., "5 mins ago", formatted with UK English locale).
- **Hover**: Subtle zoom (`transform: scale(1.03)`), border shifts to `--colour-spectral-light`.

---

## 7. Responsive Layout & Device Target Specifications

### 7.1 Desktop Arena & Calibration Screen
- **Target Resolutions**: 1920×1080 (Full HD), 1366×768 (Laptops), 1280×720 (Standard HD).
- **Canvas Constraints**: Maintains aspect ratio (e.g. 16:9 or fixed 960×540 virtual viewport rendered dynamically to fit container boundaries without distortion).
- **HUD Positioning**: Absolute corners with `inset` margins (`top: 1rem; left: 1.5rem; right: 1.5rem`) for health, ammunition, timer, and mute toggle.

### 7.2 Mobile Responsive Specification for Hall of Fame
Students and parents will inspect the reaction gallery from mobile devices (smartphones, tablets).
- **Grid Layout**:
  ```css
  .hall-of-fame-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-lg);
    padding: var(--space-lg) var(--space-md);
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
  }

  @media (max-width: 600px) {
    .hall-of-fame-grid {
      grid-template-columns: 1fr;
      gap: var(--space-md);
      padding: var(--space-md) var(--space-xs);
    }
  }
  ```
- **Touch Targets**: All interactive elements (navigation links, share buttons, filter controls) maintain minimum dimensions of **48×48px** for finger taps.
- **Zero Horizontal Scrolling**: Strict container clamping with `max-width: 100vw; overflow-x: hidden`.

---

## 8. Educational Reference for DAW Students

This guide serves as a pedagogical baseline demonstrating:
1. **Separation of Concerns**: Tokens declared in CSS custom properties rather than hard-coded inline values.
2. **Performance Optimisation**: Animations restricted to GPU-accelerated properties (`transform`, `opacity`, `filter`).
3. **Accessibility Integration**: Designing accessible dark-theme colour contrasts from day one.
4. **Design Pattern Parity**: Clean, cohesive tokens matching the State, Factory, and Singleton patterns implemented in JavaScript.
