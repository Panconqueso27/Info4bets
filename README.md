# La Ciudad *(título provisional)*

Juego narrativo de supervivencia tipo *life sim* en pixel art. Una ciudad estilo Nueva York de los 80, vivida desde dos papeles opuestos: **el inmigrante** o **el alcalde**.

## Cómo ejecutarlo

```bash
npm install
npm run dev        # http://localhost:5173 (también accesible desde el móvil en la misma red)
npm test           # tests de la lógica del juego
npm run build      # build de producción en dist/
```

### Modo desarrollo

Abre el juego con `?dev` al final de la URL (en `npm run dev` está siempre activo). Aparece el botón **DEV** para:

- acelerar el reloj (x60, x600, x3600) o adelantarlo (+1h, +8h, +1 día),
- forzar un suceso,
- borrar la partida.

Así se puede probar sin esperar 8 horas reales. Si después vuelves a la hora real, la partida queda "en el futuro" y no avanza hasta que el reloj real la alcance; lo más sencillo es borrar la partida.

## Estado: Fase 1 (prototipo jugable)

- Selección de personaje, nombre y edad, y personalización (ropa, peinado, colores de ropa, pelo y piel). Personajes *faceless* dibujados por capas.
- Ciudad única en pixel art, con alcaldía, diner, residencia, neones, taxis y transeúntes. **Ciclo día/noche con la hora real del dispositivo.**
- 5 barras por personaje (3 compartidas y 2 exclusivas), contador de días y racha.
- Rutina diaria: mandar al personaje al trabajo o a la alcaldía arranca **8 horas reales**. Solo al cumplirse se puede retirar y cobrar.
- Si un día no se va a trabajar, **se rompe la racha y no hay sueldo** (los gastos del día se cobran igual). El total de días nunca se reinicia.
- Sucesos aleatorios durante la jornada, con aviso en pantalla y notificación del navegador:
  - **Redada** (inmigrante): se sortea 1 de 5 resultados (2 buenos, 3 malos). La detención dura **1 día**, se pierde la paga y la racha queda congelada.
  - **Huelga municipal** (alcalde): ceder cuesta el 25% del dinero; no ceder suele salir mal.
- Fin de partida según las reglas de cada personaje.
- Guardado automático en el dispositivo.

## Arquitectura

```
src/
  core/       Reglas del juego en TypeScript puro (sin dibujo): estado, días, racha, jornada, sucesos, finales
    events/   Catálogo de sucesos como datos: suceso → opciones → resultados (bueno/malo + mensaje + efectos)
  art/        Pixel art generado por código: personajes, ciudad, ciclo día/noche, tipografía de píxeles
  scene/      Escena de Phaser (la ciudad) y el puente con la interfaz
  ui/         Interfaz con Preact: menús, HUD, barras, modales
  platform/   Reloj (con modo dev), guardado y notificaciones
tests/        Tests de la lógica (Vitest)
```

Para **añadir un suceso** basta con agregar una entrada en `src/core/events/catalog.ts`. Cada resultado lleva su mensaje narrativo, así que no hay cambios silenciosos en las barras. Los números son provisionales; el balanceo fino es de una fase posterior.

## Próximas fases

2. **Bolsa:** noticias diarias simuladas y una terminal de trading roja y verde.
3. **Catálogo completo de sucesos** y empaquetado móvil con **Capacitor** (Android/iOS), con notificaciones locales que funcionan con la app cerrada.
4. **Mejoras permanentes:** casa (inmigrante) y ayudante (alcalde) por niveles, más los finales.
5. **Logros:** los 25 de cada personaje.
6. **Contenido y pulido:** barrios, personajes secundarios, arte final y balanceo.
