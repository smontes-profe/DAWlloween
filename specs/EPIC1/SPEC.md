# EPIC1 Specification: Mini-juego señuelo 2D (Decoy 2D Survival Game)

## Overview & Objective

Construir los cimientos de la Single Page Application (SPA) de **DAWlloween** y el minijuego señuelo en Canvas 2D. El objetivo del juego es captar la máxima atención y concentración del jugador durante un periodo corto (30 a 60 segundos), dotándolo de controles fluidos de movimiento, apuntado y disparo con ratón, mecánicas de munición/recarga, ambientación sonora inmersiva, y una arquitectura modular preparada para futuras expansiones.

---

## User Stories

### US1.1: Estructura SPA y Pantalla de Inicio / Permiso de Cámara
> **Como** jugador,  
> **quiero** acceder a una pantalla de bienvenida inmersiva con temática de Halloween y conceder permiso de cámara,  
> **para** estar listo para jugar e iniciar la experiencia.
- **Criterios de Aceptación**:
  - Estructura SPA base en HTML5 semántico y Vanilla CSS (paleta Halloween oscura, acentos naranja calabaza, púrpura y verde fantasma).
  - Estado `#home` con título, explicación lúdica de la actividad y botón de inicio / calibración.
  - Solicitud de permisos para la webcam (`navigator.mediaDevices.getUserMedia`).
  - Transición fluida a la vista de juego (`#play`) al concederse el acceso; alerta visual amigable en caso de rechazo.

### US1.2: Motor Canvas 2D, Movimiento y Arquitectura Extensible
> **Como** jugador,  
> **quiero** mover a mi personaje en una arena 2D con teclado (WASD / cursores),  
> **para** esquivar el peligro en un entorno preparado para incorporar futuras mecánicas fácilmente.
- **Criterios de Aceptación**:
  - Bucle de juego a 60 FPS en HTML5 Canvas con límites de pantalla claros.
  - Movimiento suave en 8 direcciones del personaje.
  - Arquitectura modular y extensible (patrón *Factory* para entidades, separación estricta de lógica de renderizado e input) que permita incorporar futuras características sin refactorizaciones complejas.
  - Todo el código, métodos y comentarios estrictamente en inglés británico (`en-GB`).

### US1.3: Apuntado con Ratón, Disparo y Sistema de Recarga
> **Como** jugador,  
> **quiero** apuntar hacia el cursor del ratón y disparar proyectiles con el botón izquierdo teniendo cadencia y un tiempo de recarga tras 6 tiros,  
> **para** defenderme activamente y enfocar toda mi atención en el combate.
- **Criterios de Aceptación**:
  - El personaje orienta su punto de mira hacia la posición actual del cursor del ratón en la arena.
  - Disparo con botón izquierdo (`mousedown` / `click`) con cadencia controlada (retardo mínimo entre proyectiles).
  - Cargador de 6 disparos: tras el sexto proyectil, se activa un estado de recarga (*reloading/cooldown* visible en pantalla, ej. 1.5–2 segundos) antes de poder volver a disparar.
  - Proyectiles balísticos con trayectoria recta y colisión contra criaturas enemigas.

### US1.4: Música Ambiental y Efectos de Sonido (SFX)
> **Como** jugador,  
> **quiero** escuchar música de fondo espeluznante y efectos de sonido al disparar, recargar y abatir enemigos,  
> **para** sumergirme en una atmósfera tensa y absorbente.
- **Criterios de Aceptación**:
  - Reproductor de audio con pista de música de fondo temática en bucle, activada tras interacción del usuario.
  - Efectos de sonido (SFX) para disparo, recarga completada e impacto en enemigos.
  - Botón accesible para silenciar/activar sonido (mute toggle).

### US1.5: Generación de Enemigos, Temporizador y Disparador de Susto
> **Como** jugador,  
> **quiero** que oleadas de criaturas me persigan mientras corre un temporizador de 30–60 segundos,  
> **para** mantener la presión alta hasta el momento cumbre del susto.
- **Criterios de Aceptación**:
  - Generación progresiva de enemigos que se desplazan hacia el jugador.
  - Temporizador de supervivencia visible en el HUD.
  - Al expirar el tiempo de juego o al sufrir impacto crítico, el juego se detiene y despacha el evento desacoplado `game:trigger-screamer` (mediante Event Bus / Pub-Sub) para dar paso a la integración con **EPIC2**.
