# Project Specs

## What We Are Building

Una aplicación web interactiva y temática para celebrar Halloween en las aulas de DAW con el centro educativo, estructurada en 4 fases principales:

1. **Mini-juego señuelo (Web)**: Un juego ultra-sencillo ejecutable en navegador (estilo *survival/Vampire Survivors* minimalista con movimiento básico y oleadas simples), cuya finalidad principal es mantener al jugador concentrado durante 30–60 segundos.
2. **Momento Jumpscare y captura**: Disparo sorpresivo de un susto audiovisual (vídeo/animación rápida y sonido estridente) sincronizado con la captura automática e instantánea de un fotograma de la webcam del jugador.
3. **Pantalla de reacción y registro**: Muestra inmediatamente la fotografía de la reacción del jugador, permitiéndole introducir su nombre o apodo para inmortalizarlo.
4. **Persistencia Cloud (Free Tier) & Resiliencia**: Subida y almacenamiento de la imagen y metadatos (nombre, fecha/hora) a Supabase (Storage + Database). En caso de fallo o microcorte de red, la app reintenta la subida automáticamente y muestra alertas en pantalla sin guardar nada en local.
5. **Hall of Fame (Galería del Terror)**: Pantalla/mural público proyectable en el aula que expone el mosaico con las fotos y nombres de todas las personas que han participado.

## Why

- **Atracción interactiva escolar**: Servir de actividad lúdica y festiva para atraer a estudiantes del resto de ciclos formativos a las aulas de 1º y 2º de DAW durante la jornada de Halloween.
- **Showcase de DAW**: Demostrar de forma práctica las capacidades del desarrollo de aplicaciones web modernas (interacción en tiempo real, integración multimedia con hardware del cliente como la webcam, y persistencia en servicios cloud).

## How

- **Flujo de Usuario**:
  1. El usuario accede a la web en el puesto de juego y concede acceso a la webcam (presentado de forma inmersiva/lúdica).
  2. Inicia la partida rápida del mini-juego.
  3. Tras un breve lapso de tensión (30–60 s), se activa el jumpscare multimedia y el disparador de captura de vídeo en canvas/webcam.
  4. La aplicación congela el frame capturado, lo muestra en pantalla y solicita el apodo del participante.
  5. Se envía la foto y el apodo al backend/almacenamiento en la nube.
  6. El proyector del aula o los visitantes pueden visualizar el *Hall of Fame* actualizado con las caras de susto.

- **Arquitectura Conceptual**:
  - Frontend SPA ligero (HTML5 Canvas/JS para el juego y acceso a `navigator.mediaDevices.getUserMedia`).
  - Backend/BaaS gratuito para Database y Object Storage (ej. Supabase o Firebase).
  - Sistema de reintentos automáticos con alertas visuales ante microcortes o fallos temporales de conexión en el aula (cero persistencia local).

## Non-Goals

- **No es un videojuego comercial o profundo**: No tendrá progresión compleja, sistema de niveles múltiples, árboles de habilidades ni mecánicas avanzadas. El juego es un cebo.
- **Sin autenticación formal de usuarios**: No habrá cuentas, contraseñas ni validación de correos. Solo apodo/nombre libre para dinamismo.
- **Sin panel de administración complejo**: Salvo una función básica de moderación para eliminar fotos inapropiadas si fuera necesario.
- **Sin optimización móvil prioritaria**: El foco principal de la experiencia es el ordenador del aula con pantalla y webcam conectada.

## Operating Principles

1. **Privacidad y Permisos**: Notificación previa lúdica y clara para el consentimiento del uso de la cámara en el contexto de la actividad escolar.
2. **Cero coste (Free Tier)**: Toda la infraestructura utilizada debe operar al 100% dentro de planes gratuitos.
3. **Resiliencia ante fallos de red**: Reintentos automáticos y alertas visuales claras si se corta la conexión; sin almacenamiento local.
4. **Alta rotación y fluidez**: Ciclo completo de experiencia por jugador de máximo 1 a 2 minutos para permitir que participen muchos alumnos.
