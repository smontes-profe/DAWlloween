# EPIC1 Specification: Mini-juego señuelo 2D (Decoy 2D Survival Game)

## Overview & Objective

Construir los cimientos de la Single Page Application (SPA) de **DAWlloween** y el minijuego señuelo en Canvas 2D. El objetivo del juego es captar la máxima atención y concentración del jugador durante un periodo corto (30 a 60 segundos), dotándolo de controles fluidos de movimiento, apuntado y disparo con ratón, mecánicas de munición/recarga, ambientación sonora inmersiva, y una arquitectura modular preparada para futuras expansiones.

---

## User Stories

### US1.1: Sistema de Diseño Visual y Guía de Estilo Frontend (Design System & Style Guide)
> **Como** desarrollador frontend y diseñador de la experiencia,  
> **quiero** definir un documento de guía de estilo y sistema de diseño visual (paleta de colores Halloween, tipografías, jerarquía, micro-animaciones y diseño de componentes base),  
> **para** contar con un marco estético y técnico unificado que guíe la maquetación tanto del minijuego como de la pantalla de reacción y del *Hall of Fame*.
- **Criterios de Aceptación**:
  - Documento de especificación de diseño visual en `docs/DESIGN_GUIDE.md` con la dirección de arte y requerimientos visuales del minijuego y del *Hall of Fame* (incluyendo visualización móvil para el mural).
  - Definición completa de tokens de diseño (variables CSS):
    - Paleta de colores temáticos de Halloween (fondos oscuros, naranja calabaza, púrpura espectral, verde ectoplasma, y contraste accesible WCAG AA).
    - Tipografía: fuentes Google Fonts temáticas (terror/retro arcade) para títulos y fuentes limpias/legibles para textos y HUD.
    - Elevaciones, bordes y sombras con resplandores neón (*glow effects*).
  - Especificación de efectos atmosféricos y micro-animaciones (parpadeo de luces, niebla/partículas, sacudida de pantalla / *screen shake*, transiciones *hover* interactivas).
  - Guía de componentes reutilizables: botones arcade/horror, tarjetas responsive para el mosaico del *Hall of Fame*, modales y alertas toast.

### US1.2: Estructura SPA y Pantalla de Inicio / Permiso de Cámara
> **Como** jugador,  
> **quiero** acceder a una pantalla de bienvenida inmersiva con temática de Halloween y conceder permiso de cámara,  
> **para** estar listo para jugar e iniciar la experiencia.
- **Criterios de Aceptación**:
  - Estructura SPA base en HTML5 semántico y Vanilla CSS aplicando los tokens definidos en la guía de diseño (US1.1).
  - Estado `#home` con título, explicación lúdica de la actividad y botón de inicio / calibración.
  - Solicitud de permisos para la webcam (`navigator.mediaDevices.getUserMedia`).
  - Transición fluida a la vista de juego (`#play`) al concederse el acceso; alerta visual amigable en caso de rechazo.

### US1.3: Motor Canvas 2D, Movimiento y Arquitectura Extensible
> **Como** jugador,  
> **quiero** mover a mi personaje en una arena 2D exclusivamente con teclas WASD y orientar su punto de mira continuamente hacia el puntero del ratón,  
> **para** esquivar el peligro con precisión y en un entorno preparado para incorporar futuras mecánicas fácilmente.
- **Criterios de Aceptación**:
  - Bucle de juego a 60 FPS en HTML5 Canvas con límites de pantalla claros.
  - Movimiento suave en 8 direcciones del personaje controlado estrictamente por teclas WASD (sin teclas de flechas).
  - Orientación dinámica y continua del personaje hacia la posición del cursor del ratón en la arena de juego.
  - Arquitectura modular y extensible (patrón *Factory* para entidades, separación estricta de lógica de renderizado e input) que permita incorporar futuras características sin refactorizaciones complejas.
  - Todo el código, métodos y comentarios estrictamente en inglés británico (`en-GB`).

### US1.4: Disparo con Ratón y Sistema de Recarga
> **Como** jugador,  
> **quiero** disparar proyectiles hacia el puntero del ratón con el botón izquierdo teniendo cadencia y un tiempo de recarga tras 6 tiros,  
> **para** defenderme activamente y enfocar toda mi atención en el combate.
- **Criterios de Aceptación**:
  - Disparo reactivo con el botón izquierdo del ratón (`mousedown` / `click`) en la dirección hacia donde apunta el puntero.
  - Cadencia de fuego controlada (retardo mínimo entre proyectiles consecutivos).
  - Cargador de 6 disparos: tras el sexto proyectil, se activa un estado de recarga (*reloading/cooldown* visible en pantalla, ej. 1.5–2 segundos) antes de poder volver a disparar.
  - Proyectiles balísticos con trayectoria recta y colisión contra criaturas enemigas.

### US1.5: Música Ambiental y Efectos de Sonido (SFX)
> **Como** jugador,  
> **quiero** escuchar música de fondo espeluznante y efectos de sonido al disparar, recargar y abatir enemigos,  
> **para** sumergirme en una atmósfera tensa y absorbente.
- **Criterios de Aceptación**:
  - Reproductor de audio con pista de música de fondo temática en bucle, activada tras interacción del usuario.
  - Efectos de sonido (SFX) para disparo, recarga completada e impacto en enemigos.
  - Botón accesible para silenciar/activar sonido (mute toggle).

### US1.6: Generación de Enemigos, Temporizador y Disparador de Susto
> **Como** jugador,  
> **quiero** que oleadas de criaturas me persigan mientras corre un temporizador de 30–60 segundos,  
> **para** mantener la presión alta hasta el momento cumbre del susto.
- **Criterios de Aceptación**:
  - Generación progresiva de enemigos que se desplazan hacia el jugador.
  - Temporizador de supervivencia visible en el HUD.
  - Al expirar el tiempo de juego o al sufrir impacto crítico, el juego se detiene y despacha el evento desacoplado `game:trigger-screamer` (mediante Event Bus / Pub-Sub) para dar paso a la integración con **EPIC2**.
