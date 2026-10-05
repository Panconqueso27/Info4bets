# Cómo publicar Pixelopolis en Google Play

## Por qué el móvil dice «app dañina»

El APK de las betas se firma con una **clave de depuración** y se instala desde fuera de la tienda. Play Protect desconfía de cualquier app así, aunque no haga nada malo; Pixelopolis no pide permisos peligrosos ni se conecta a internet. El aviso desaparece cuando la instalas **desde Google Play**, porque allí Google la revisa y la firma.

Ya está preparado en el proyecto:
- Versión de publicación sin modo de depuración (`debuggable false`), con su número de versión.
- ID de paquete definitivo: `com.pixelopolis.townbuilder`.
- Configuración de firma, que lee la clave de `android/keystore.properties`. Ese archivo nunca se sube a git.
- Solo los permisos imprescindibles: notificaciones locales, reprogramarlas al reiniciar el móvil e internet (que Capacitor necesita para la vista web interna).
- Política de privacidad dentro del juego (Ajustes › Privacidad) y en `privacidad.html`.
- Textos de la ficha, icono, gráfico destacado y capturas en esta carpeta.

## 1. Cuenta de desarrollador (solo la primera vez)
1. Entra en https://play.google.com/console con tu cuenta de Google.
2. Elige **cuenta personal**, paga la cuota única (25 USD) y verifica tu identidad con tu documento.
3. **Importante:** las cuentas personales nuevas tienen que hacer una **prueba cerrada con al menos 12 testers durante 14 días seguidos** antes de poder publicar en producción. Busca 12 amigos con Android y apúntalos con su correo de Gmail.

## 2. Firmar el paquete
Google Play solo acepta el paquete `.aab` firmado con tu **clave de subida**. Esa clave es tuya: guárdala con su contraseña en un sitio seguro. Si la pierdes, Google te deja cambiarla a través del soporte de Play Console, porque la firma final la hace Google («Firma de apps de Google Play»).

Para generarla y compilar el `.aab` hay dos caminos:
- **A)** Que Claude la genere en la sesión y te la envíe junto al `.aab` firmado (tú la guardas).
- **B)** Generarla tú en un ordenador con Android Studio (*Build › Generate Signed App Bundle*), o con:
  ```
  keytool -genkeypair -v -keystore pixelopolis-upload.jks -alias pixelopolis -keyalg RSA -keysize 2048 -validity 10000
  ```
  Después crea `android/keystore.properties`:
  ```
  storeFile=/ruta/a/pixelopolis-upload.jks
  storePassword=…
  keyAlias=pixelopolis
  keyPassword=…
  ```
  Y compila con `npm run build && npx cap sync android && cd android && ./gradlew bundleRelease`. El paquete queda en `android/app/build/outputs/bundle/release/app-release.aab`.

## 3. Crear la app en Play Console
1. **Crear app** › nombre «Pixelopolis: Pixel Town Builder» › idioma español › **Juego** › **Gratis**.
2. **Ficha de Play Store**: copia los textos de `ficha.md` y sube `icono-512.png`, `grafico-destacado-1024x500.png` y las capturas de `capturas/`.
3. **Contenido de la app**:
   - **Política de privacidad**: hace falta una URL pública con el contenido de `privacidad.html`. Opciones gratuitas:
     - Google Sites: crea una página y pega el texto.
     - GitHub Pages: publica la carpeta `docs/` del repositorio.
   - **Anuncios**: No contiene anuncios.
   - **Acceso a la app**: toda la funcionalidad está disponible sin restricciones (no hay inicio de sesión).
   - **Clasificación de contenido** (cuestionario IARC), categoría *Juego*. Respuestas con la verdad sobre el contenido:
     - Violencia: no hay violencia gráfica. Hay detenciones y alusiones a robos en las historias.
     - **Juego simulado: Sí.** Hay lotería, apuestas en el hipódromo y bolsa con dinero ficticio.
     - Alcohol: sí, referencias (el bar, la cerveza). Drogas y sexo: no.
     - Interacción entre usuarios, compras y ubicación: no.
     - Lo normal es que salga **PEGI 12 / Adolescentes** por el juego simulado.
   - **Público objetivo**: 13 años o más. Así no aplican las normas especiales de apps para niños.
   - **Seguridad de los datos**: «No se recogen datos» y «No se comparten datos». Todo se queda en el dispositivo y no hay cifrado en tránsito porque no se envía nada.
   - Gobierno, finanzas, salud, apps de noticias: **No**.
4. **Pruebas › Prueba cerrada**: crea una lista de testers con los 12 correos, sube el `.aab` y envía a revisión. Comparte con ellos el enlace de participación. Tienen que instalarla y mantenerse 14 días.
5. Pasados los 14 días: **Solicitar acceso a producción**, responde el breve cuestionario y crea la versión de **Producción** con el mismo `.aab` (o uno nuevo con un `versionCode` mayor).

## 4. Actualizaciones
Cada versión nueva necesita un `versionCode` mayor en `android/app/build.gradle`. Las betas lo suben solas.

## Si ya tienes la beta instalada
La versión de Google Play tiene otro ID de paquete y otra firma, así que es una app distinta. Antes de desinstalar la beta, saca el **código de copia de seguridad** (Menú › Copia de seguridad) y pégalo en la nueva.
