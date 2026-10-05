# Pixelopolis · Pixel Town Builder

Juego narrativo de supervivencia tipo *life sim* en pixel art. Una ciudad estilo Nueva York de los 80, vivida desde dos papeles opuestos: **el inmigrante** o **el alcalde**.

**Versión actual: 0.11.0**

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

## Novedades 0.11.0

- **Partidas guardadas:** hasta 5 ranuras, con nombre, papel, día, dinero y cuándo jugaste cada una. Desde la portada puedes continuar la última, jugar otra, empezar una nueva o borrarla. La partida de versiones anteriores pasa sola a la ranura 1.
- **Lo imprescindible de un juego publicado:**
  - El **botón Atrás de Android** cierra lo que haya abierto (primero el móvil, luego los paneles) y vuelve a la portada. Desde la portada sale del juego.
  - **Ajustes:** música, efectos, sonido de la calle, vibración, notificaciones, calidad gráfica y letra grande.
  - **Privacidad** y **Créditos** dentro del juego, y número de versión en la portada.
  - La partida se guarda al salir de la app o bloquear el móvil, y cada pocos minutos se hace una copia de respaldo por si la principal se estropea.
  - Si algo falla, aparece una pantalla para reintentar o sacar el código de la partida, en vez de quedarse en blanco.
- **Preparado para Google Play:**
  - versión de publicación sin depuración y firma configurable;
  - ID de paquete definitivo `com.pixelopolis.townbuilder`;
  - ficha, política de privacidad, icono, gráfico y capturas en `play-store/`, con la guía en `play-store/GUIA.md`.

## Novedades 0.10.0

- **Nuevo nombre y logo: Pixelopolis · Pixel Town Builder.** Hay un logo dorado en la portada y un icono nuevo para la app y la pantalla de carga.
- **Arte isométrico revisado:**
  - Los carteles, letreros de neón, la noria, la montaña rusa y las grúas están en perspectiva, pegados a la ciudad, en vez de girados hacia la cámara.
  - Las cabinas, buzones, quioscos y bocas de incendio son pequeños volúmenes.
  - Nada se cruza:
    - las chimeneas van en los patios o sobre las azoteas;
    - los contenedores tienen cada uno su hueco;
    - los coches pasan entre los pilares de las torres del puente;
    - los remolcadores pasan por debajo del puente y no atraviesan el crucero.
  - **Más calidad con zoom:** los edificios se dibujan al triple de resolución (al doble en el modo ahorro).
- **El móvil de tapa:**
  - El panel de abajo es un móvil plegado del que solo se ve la tapa metálica, con una pantallita que muestra la hora y el estado del día.
  - Al tocarlo se despliega con una animación de bisagra. Dentro están la jornada y todas las opciones de siempre.
  - Trae aplicaciones nuevas:
    - **Contactos** que te llaman con trabajo;
    - **Notas**;
    - **Calculadora**;
    - **Reloj**;
    - **El tiempo** con la previsión de 3 días;
    - **Música**.
- **Papeleo del alcalde al estilo puesto de control:**
  - Cada expediente trae un documento y la ficha del registro municipal.
  - Herramientas: escáner de huellas, lámpara ultravioleta para la marca de agua y reglamento.
  - Cada pocos expedientes entra una norma nueva: licencias caducadas y dobles firmas.
  - Al rechazar se elige el motivo; si aciertas, ganas un punto extra.
  - Los errores dan citaciones.

## Novedades 0.9.0

- **Vista isométrica**, como en los juegos clásicos de construir ciudades: la ciudad se ve en diagonal y desde arriba, y cada edificio es un volumen con azotea, fachada iluminada y fachada en sombra.
  - Los edificios proyectan sombra.
  - Midtown tiene rascacielos de cristal con antenas.
  - El puente de Brooklyn tiene torres de piedra con arcos y cables.
  - El mar rodea las islas.
- **Lo demás no cambia:** las mismas manzanas, los lugares, los solares, las obras, los concursos, el tráfico con semáforos y la gente.
  - Los personajes caminan por las aceras que dan a la cámara, así que siempre se les ve.
  - Los edificios tapan a quien pasa por detrás.
- **Minimapa en rombo**, con el mismo ángulo que la vista.
- **Acercar y alejar:** pellizca para ver la ciudad entera o acercarte a una calle. Tocar un edificio funciona igual que antes.
- **Rendimiento:**
  - Cada manzana se dibuja recortada a su silueta.
  - Los neones van dentro de la capa de luces.
  - Si el móvil va lento, el juego baja la resolución él solo.

## Novedades 0.8.0

- **Rediseño visual:** el arte del mapa se dibuja al doble de detalle, con texturas (ladrillo, baldosa, asfalto), ventanas con marco y alféizar, toldos de rayas, cornisas, árboles frondosos y sombras suaves.
  - Hay un cielo de horizonte que cambia entre día, atardecer y noche, y por la noche las ventanas tienen un brillo cálido.
  - **Resolución adaptativa:** si el móvil va a menos de 40 FPS, el juego baja la resolución él solo y lo recuerda.
- **Calles lógicas:** las avenidas y calles son de sentido único, al estilo de Nueva York, con flechas pintadas, dos carriles, pasos de cebra y semáforos.
  - Los peatones esperan en la esquina y cruzan por el paso de cebra.
- **Cada trabajo tiene su lugar:** el personaje camina hasta el edificio y se le ve entrar y salir. Una marca ▼ señala el destino.
- **Panel inferior compacto:** las misiones, el progreso y los minijuegos ocupan mucho menos y dejan más ciudad a la vista.
- **4 concursos de dificultad media-alta**, con inscripción, rivales y premios para los tres primeros:
  - **Batalla de breakdance** en Times Square (viernes y sábados): pulsa las flechas al ritmo.
  - **Concurso de comer perritos** en Coney Island (domingos, y el 4 de julio con premios triples): muerde y traga sin atragantarte.
  - **Torneo de Simon** (martes, jueves y sábados): repite la secuencia de colores.
  - **Maratón de Nueva York** (domingos y miércoles): mantén el ritmo en la zona verde.
- **Fuente más legible**, sin dejar de ser pixel.

## Novedades 0.7.0

- **Ciudad el doble de grande:** Manhattan, el East River con el **puente de Brooklyn** (coches, peatones y remolcadores) y **Brooklyn**, con sus barrios: los Muelles, Williamsburg (fábricas y chimeneas), Brooklyn Heights (casas de ladrillo con árboles), Coney Island (noria y montaña rusa), el Rastro, el Hipódromo y la fábrica de azúcar. En Manhattan aparecen Chinatown y el Lower East Side.
  - El mapa se divide en trozos y solo se dibuja la parte que se ve.
- **16 solares**, con precio según el barrio.
  - **Inmigrante:** hasta 3 solares. En cada uno, una casa de alquiler (casa, dúplex y edificio de 4 pisos) o un negocio con 3 niveles: lavandería, puesto de comida o taller.
  - **Alcalde:** cada obra pública tiene 3 niveles (por ejemplo, del parque de barrio al jardín botánico). Además puede lanzar 4 **grandes proyectos**: reforma de Times Square, puerto de cruceros, estadio de béisbol y aeropuerto. También puede **subastar solares**. En la partida del inmigrante, la ciudad inaugura los grandes proyectos con los días.
  - **Nivel de barrio:** cuanto más se construye, más gente hay en la calle, los solares cuestan más y los negocios ganan más.
- **🎯 Extras:** **misiones del día** (3 retos con premio y un bonus si cumples las tres) y dinero fuera del trabajo.
  - **Inmigrante:** radio, reparto, taxi (paga más de noche y con lluvia), clases de español, puesto de perritos calientes (minijuego) y el rastro de los domingos.
  - **Alcalde:** cenas de recaudación (con riesgo de escándalo), mítines de barrio, bonos municipales y subasta de solares.
  - **Los dos:** hipódromo y béisbol los fines de semana, y lotería semanal.
- **🏢 Propiedad:** lo que te da dinero cada noche, nivel de los barrios, solares y obras, negocio o turismo, grandes proyectos y el **libro de cuentas** semanal por categorías.
- **Impuestos y alquiler:** cada mes sube el alquiler del cuarto del inmigrante y llegan los impuestos de sus propiedades. El alcalde paga el mantenimiento de las obras.
- **Minimapa con viaje rápido** (casa, trabajo, solares, Brooklyn) e **iconos sobre el mapa**: tus negocios, las obras y el rastro o el hipódromo cuando abren.
- **Copia de seguridad:** exporta la partida a un código y restáurala en otro móvil (menú ☰).
- **Pulido visual:**
  - Marco de máquina recreativa en el HUD, el panel inferior y las ventanas, e iconos pixel art en los botones.
  - Letreros de tiendas en inglés, pasos de cebra, alcantarillas con vapor, cabinas, buzones, quioscos y basura en los barrios pobres.
  - Charcos con reflejos de neón cuando llueve, ventanas que se encienden escalonadas, amaneceres y atardeceres más cálidos.
  - Palomas en el parque, más taxis y gente en Times Square de noche.
  - El personaje salta al ganar dinero y saca el paraguas cuando llueve.
- Rendimiento con el mapa doble (CPU 4 veces más lenta): de 57 a 58 fps con lluvia, nieve o la Bolsa abierta.

## Novedades 0.6.0

- **Música synthwave original**, más animada: canción con intro, estrofa, estribillo con la melodía una octava arriba, eco y batería con redobles. De noche, más lenta y suave.
- **Sonido ambiente** que sigue al juego (con su propio interruptor en ☰):
  - Lluvia, tormenta con truenos sincronizados con los relámpagos, viento con nieve.
  - Pájaros al amanecer, tráfico y bocinas de día, grillos y sirenas de noche.
  - Platos y caja registradora en el diner; máquinas de escribir y teléfonos en la alcaldía.
  - Martillos si hay obras, tu mascota, campanas en Navidad y fuegos artificiales el 4 de Julio.
- **Tipografía pixel art:** Pixelify Sans para los textos y Silkscreen para títulos y botones, con tildes y ñ.
- **8 minijuegos nuevos** (5 por personaje, con menú, récords y combos):
  - Inmigrante: plancha, pedidos, café y fregona.
  - Alcalde: semáforos, rueda de prensa, presupuestos y mitin.
- **Precios ajustados** con simulaciones de partidas: hay algo que comprar cada pocos días y metas grandes hacia los dos meses.
  - Inmigrante: sueldo $160, gastos $65. Más baratos: cuarto, apartamento y casa, el auto, el solar, las fases de la casa y las máquinas. Los trabajos extra cansan menos.
  - Alcalde: sueldo $80K, gastos $35K. Ayudantes, obras públicas y renovaciones más baratos.

## Novedades 0.5.0

- **Solares:** seis solares vacíos por partida. El **alcalde** construye obras públicas (parque, escuela, centro de salud, metro, museo y viviendas sociales) y renueva cualquier manzana tocándola en el mapa (fachadas restauradas; luego neones y arbolado). El **inmigrante** compra un solar y levanta su casa en 4 fases de un día cada una (cimientos, estructura, tejado y acabados). Al terminarla la alquila. Esta casa es aparte de la mejora de vivienda. Todo se ve en el mapa: carteles de FOR SALE, vallas, andamios y grúas.
- **Mascota:** un gato o un perro callejero puede seguirte al salir del diner. Si lo adoptas vive contigo, te baja el estrés cada noche, te sigue por el mapa y tiene sus propios sucesos. Cuesta $20 al mes.
- **Radio WNYC:** cada día anuncia 3 trabajos extra para el inmigrante (puerto, mudanzas, niñera, obra...). Se puede hacer uno al día, fuera de la jornada.
- **Ingresos pasivos:**
  - El inmigrante instala hasta 5 **máquinas expendedoras** ($15 al día cada una). Se pueden romper o te las pueden robar.
  - El alcalde cobra el **turismo**: los turistas dependen de la popularidad, los atractivos de la ciudad y el clima. También hay sucesos de cruceros y guías de viaje.
- **Más fluido:**
  - Lluvia, nieve y nubes ya no se redibujan en cada fotograma.
  - La bolsa calcula menos y la música se prepara en ratos libres.
  - Se quitaron los efectos CSS más pesados (desenfoques y sombras animadas).
  - Si el móvil va justo, el juego baja la calidad solo. También hay un botón ✨/🔋 en el menú.
  - Medido con la CPU 4 veces más lenta y lluvia: antes 51 fps, ahora 60 fps. Con la Bolsa abierta: antes 49 fps, ahora 60 fps.

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
