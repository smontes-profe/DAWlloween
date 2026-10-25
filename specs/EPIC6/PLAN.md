# Implementation Plan: EPIC6 - Ronda de Feedback 2: Mecánicas & Admin

## Status
`closed`

## PM Approval
- **Approved by PM**: Yes (Confirmed on 2026-10-25)
- **Scope**: EPIC6 - Feedback 2 (Admin Mode & Supabase Deletion, 5-HP Health System & Contact Damage, Manual Spacebar Reload with Warning, Hall of Fame Video Modal Popup)

---

## 1. User Story Implementation Order

### Story 1: US6.1 - Modo Administrador con Autenticación Simple para Moderación y Borrado en Supabase
- **Priority**: Highest (P1 - Priority requested by PM)
- **Rationale**: Provides administrative control over reaction entries in Supabase. Implements route `#admin` with simple in-memory credential verification, displays Hall of Fame with deletion action buttons, and equips `SupabaseService` with methods to cleanly remove both storage assets from bucket `reactions` and database records from table `hall_of_fame` with live DOM updates and toasts.
- **Dependencies**: None. Builds upon existing `Router`, `HallOfFameView`, and `SupabaseService`.

### Story 2: US6.2 - Sistema de 5 Puntos de Vida (PV) y Daño por Contacto
- **Priority**: High (P2 - Core Combat & Health Loop)
- **Rationale**: Transforms player durability into a discrete 5-point health model. Enemy collision directly depletes 1 HP, destroys the colliding enemy on impact with visual/sound feedback, and updates the top-left HUD with 5 discrete visual tokens (skulls/hearts). Reaching 0 HP triggers the synchronized climax jumpscare.
- **Dependencies**: None (orthogonal to admin moderation).

### Story 3: US6.3 - Recarga Manual con Espacio y Alerta Parpadeante
- **Priority**: Medium/High (P3 - Weapon Tactics & Tension)
- **Rationale**: Removes automatic weapon reload upon chamber exhaustion. When ammunition reaches 0 rounds, a high-contrast flashing warning (*"¡Recarga! (pulsar espacio)"*) appears, and pressing `Space` reloads the revolver while dismissing the warning.
- **Dependencies**: Follows `US6.2` to integrate seamlessly into the updated HUD and input handlers of `GameEngine` and `GameView`.

### Story 4: US6.4 - Modal Popup de Ampliación de Vídeo en Hall of Fame
- **Priority**: Medium (P4 - Exhibition View Enhancement)
- **Rationale**: Allows visitors to click or tap any reaction card in `HallOfFameView` to expand the video into an accessible, responsive modal dialog (full-width on mobile, centered proportional on desktop) with backdrop, Escape key, and close button dismissal.
- **Dependencies**: Follows `US6.1` to ensure click events on admin delete buttons and card tap interactions do not conflict.

---

## 2. Technical Dependencies & Constraints

1. **Constitutional Rules (AGENTS.md)**:
   - Rule 7: UK English (`en-GB`) for code symbols, functions, variables, comments, docstrings, and unit tests.
   - Rule 8: European Spanish (`es-ES`) for all user-facing interface copy, HUD labels, dialogues, and notifications.
   - Zero local persistence policy: Admin authentication state remains strictly in-memory (no `localStorage` or `sessionStorage`).
2. **Supabase Cloud Operations**:
   - Deletion of reaction entries must remove both storage media files (`storage.from('reactions').remove([filePath])`) and the table row in `hall_of_fame`, with automatic retry on transient microcuts.
3. **Discrete Health & Weapon State**:
   - `Player.hp` clamped between 0 and 5 (`maxHp = 5`).
   - Weapon reload cooldown decoupled from automatic triggers, requiring manual Spacebar gesture.
