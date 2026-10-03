# La Ciudad *(título provisional)*

Juego narrativo de supervivencia tipo *life sim* en pixel art. Una ciudad estilo Nueva York de los 80, vivida desde dos papeles opuestos: **el inmigrante** o **el alcalde**.

**Versión actual: beta 0.4.0**

## Probar la beta

- **Android:** instala el APK (`app-debug.apk`). Hay que permitir "instalar apps de origen desconocido". Cada push a GitHub vuelve a compilarlo en Actions, en el artefacto `la-ciudad-beta-apk`.
- **iPhone / cualquier navegador:** `npm run build:web` genera `dist-web/la-ciudad.html`, un único archivo con todo el juego.
- **Modo pruebas:** en el menú ☰, "Activar modo pruebas", o `?dev` en la URL. Sirve para acelerar el reloj, adelantar horas o días y forzar sucesos.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de la lógica (Vitest)
npm run build      # build web en dist/
npm run android    # build + APK (requiere Android SDK y JDK 21)
```

Para iOS hace falta un Mac con Xcode: `npx cap add ios`, luego `npx cap open ios`.

## Novedades 0.4.0

- **Personajes recurrentes con memoria:** Sal, Doña Carmen, Lupe, Don Ramiro y el agente Kowalski para el inmigrante; la concejala Ruiz, el jefe O'Malley, Diane Brooks y Frank Russo para el alcalde. Recuerdan tus decisiones y vuelven con historias según cómo los trataste. Panel **Personas** en el menú.
- **Encuentros entre protagonistas:** el inmigrante y el alcalde se cruzan en sucesos y en el mapa. Si terminaste una partida con el otro rol, ese personaje vive en tu ciudad.
- **Recompensas por racha** (3, 7, 14, 30, 60 y 100 días) y **armario desbloqueable**: chaqueta de cuero, esmoquin, traje de domingo, chándal, permanente, gorra y cresta.
- **Tutorial** del primer día y **estadísticas** de la partida, con los momentos que la marcaron.
- **Fechas señaladas:** Halloween, Acción de Gracias, Navidad, 4 de Julio y San Patricio.
- **Tráfico realista:** carriles por la derecha, semáforos y edificios que tapan lo que pasa por detrás. Las zonas táctiles siguen el contorno de cada edificio.
- **Música acústica más suave**, con guitarra punteada, contrabajo y escobillas, y vibración al decidir.

## Novedades 0.3.0

- **Ciudad en vista cenital inclinada (3/4):** azoteas y fachadas con volumen, tráfico, peatones, mapa que se arrastra y se amplía, y lugares tocables (la Bolsa abre la terminal).
- **Decisiones con tarjetas deslizables:** derecha, izquierda y arriba, con animación y sonido según salga bien o mal.
- **Suceso de apertura** ligero en los primeros 2 minutos de cada jornada.
- **Minijuegos:** lavaplatos (inmigrante) y papeleo (alcalde). Cada acierto descuenta 10 minutos de la jornada.
- **Reparto de paquetes:** trabajo extra de 4 horas, una vez al día. El auto lo reduce a 2 horas.
- **Clima según la estación:** lluvia, tormenta y nieve. Cambia los sucesos y el reparto, y las noches de nieve sin casa propia hacen daño.
- **Sonido:** efectos chiptune y música synthwave de día y de noche.
- **Interfaz neón** con tipografía nueva y animada.

## Qué incluye la beta

- **Personajes:** inmigrante o alcalde, con nombre, edad y personalización faceless en pixel art (ropa, peinado y colores).
- **La ciudad:** una sola, compartida por los dos personajes, con ciclo día/noche según la hora del dispositivo.
- **Barras:** 5 por personaje (3 compartidas y 2 exclusivas), contador de días y racha estilo Duolingo.
- **Rutina diaria:** 8 horas reales en el trabajo o la alcaldía. Si un día no vas, pierdes la racha y el sueldo.
- **Bolsa:** cada mañana sale el periódico *The Daily Ledger* con noticias simuladas (aciertan el 75% de las veces). Durante la jornada se apuesta desde una terminal de trading roja y verde, y el resultado afecta al dinero y al ánimo.
- **Sucesos del inmigrante:** redada (1 de 5 resultados; la asesoría legal protege), manifestación (unirse u organizarla), vecino en problemas, emergencia médica, asesoría legal, grupo de apoyo, envío de dinero semanal, reunificación familiar y clases de inglés.
- **Sucesos del alcalde:** huelga, corrupción, desastre natural y manifestación. En la agenda: seguridad, prensa, obra pública, descanso y concejales. Elecciones cada 30 días.
- **Mejoras permanentes:** casa (inmigrante) y ayudante (alcalde), en 3 niveles cada una.
- **Objetivos:** 25 logros por personaje. El último dispara el final positivo, y después se puede seguir jugando.
- **Notificaciones nativas:** sucesos, fin de la jornada y recordatorio diario de la racha.
- **Guardado automático:** en la app se guarda además en el almacenamiento nativo.

Cada suceso está separado de sus consecuencias. Cada resultado es bueno o malo y trae su mensaje narrativo, así que no hay cambios silenciosos en las barras.

## Arquitectura

```
src/core/         Reglas en TypeScript puro: estado, días, jornada, bolsa, mejoras, logros
src/core/events/  Sucesos como datos (inmigrante.ts, alcalde.ts)
src/art/          Pixel art generado por código: personajes, ciudad, día/noche
src/scene/        Escena de Phaser
src/ui/           Interfaz (Preact): HUD, terminal de bolsa, paneles
src/platform/     Reloj, guardado y notificaciones (web y nativas)
android/          Proyecto Android (Capacitor)
resources/        Icono fuente
```

## Pendiente (siguientes fases)

Barrios y lugares, personajes secundarios, diseño visual final y balanceo numérico fino. Los números actuales son provisionales y están ajustados con simulaciones de partidas.
