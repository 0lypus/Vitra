<p align="center">
  <img src="docs/logo.png" alt="Logo de Vitra" width="120" />
</p>

<h1 align="center">Vitra</h1>

<p align="center">
  Reproductor de música liviano con estética de vidrio. PWA para PC y móvil.
</p>

Vitra es una Progressive Web App que reproduce la música que ya tenés en tu dispositivo: importás los archivos, quedan guardados en el navegador (IndexedDB) y listo. Sin cuentas, sin servidores, sin rastreo: toda tu biblioteca vive en tu equipo. No envuelve YouTube ni ningún servicio de streaming: si el archivo no está en tu equipo, Vitra no lo busca.

## Características

- **Biblioteca local**: importá MP3, M4A, AAC, OGG, OPUS, WAV, FLAC, WEBM y MP4. Los archivos se guardan en IndexedDB junto con sus metadatos y carátulas (comprimidas a 256 px). Si un archivo no se puede leer como audio (está dañado o no lo es), te avisa y no lo suma.
- **Fondo dinámico**: el color dominante de la carátula tiñe el fondo con una transición suave.
- **Letras sincronizadas (.lrc)**: parser propio; resalta la línea actual, se auto-centra y podés saltar haciendo clic en cualquier línea.
- **Favoritos y listas de reproducción**: corazón en cada canción, chips de filtro y listas propias (crear, renombrar, eliminar, agregar o quitar canciones y reordenarlas con ↑/↓).
- **Cola de reproducción**: con el botón de cola de cada canción podés ponerla “a continuación” o al final. El chip “Cola” muestra lo encolado, que se puede reordenar, quitar o vaciar, y suena antes que el resto de la biblioteca.
- **Editar metadatos**: título, artista y álbum a mano (solo dentro de Vitra; el archivo no se toca).
- **Respaldo en JSON**: descargá un archivo con tus metadatos, favoritos, letras y listas, e importalo cuando quieras. Sirve para no perder nada si el navegador limpia los datos y para pasar tus datos a otro dispositivo.
- **Sincronización opcional (v2)**: con el backend propio (`backend/Vitra.Api`) podés subir y bajar metadatos, favoritos, letras y listas para tener la misma biblioteca en varios dispositivos. El audio no se sube. Los borrados también se propagan. El servidor puede exigir clave de acceso (`X-Clave`); la escribes una vez en el diálogo y Vitra la recuerda.
- **Aleatorio y repetir** (todas / una), recordados entre sesiones.
- **Buscador** por título o artista, sin importar mayúsculas ni tildes.
- **Visualizador de audio** con Web Audio API (espectro de 64 barras con escala logarítmica, a 30 fps), encendible/apagable. El reparto logarítmico hace que se mueva todo el ancho y no solo la franja de los graves.
- **Biblioteca virtualizada**: la lista solo pinta las filas visibles, así que cientos de canciones no la traban.
- **Atajos de teclado**: `Espacio` play/pausa · `←`/`→` ±5 s · `Shift+←`/`Shift+→` pista anterior/siguiente · `↑`/`↓` volumen · `S` aleatorio · `R` repetir.
- **Arrastrar y soltar**: soltá archivos de audio o `.lrc` sobre la ventana para importarlos.
- **Media Session**: controles en la pantalla de bloqueo, notificaciones y teclas multimedia con carátula.
- **PWA instalable**: funciona offline (service worker con Workbox) e incluye canciones de ejemplo.
- **Respeta tu batería y tu espacio**: pide almacenamiento persistente y muestra cuánto ocupás.
- **Liviano**: el heap de JavaScript de la app ronda los **2–4 MB** (medido; ver [Rendimiento](#rendimiento)).

## Uso

1. **Agregar música**: botón “+ Agregar música”, o arrastrá los archivos sobre la ventana. También podés tocar “Cargar canciones de ejemplo” para probar con una canción CC0.
2. **Letras**: guardá un archivo `.lrc` con el mismo nombre que el audio (por ejemplo `cancion.mp3` + `cancion.lrc`) y agregalos juntos, o soltá el `.lrc` sobre la ventana para aplicarlo a una canción ya importada.
3. **Listas**: el botón `+` de cada fila abre el diálogo para agregar o quitar la canción de una lista (y crear listas desde ahí). Los chips arriba de la biblioteca filtran por “Todas”, “Favoritas” o cada lista.
4. **Reproducción**: clic en cualquier canción; la navegación (anterior/siguiente) recorre lo que esté filtrado en ese momento.
5. **Cola**: el botón de cola de cada fila (el ▶ con rayitas) abre el diálogo para poner esa canción “a continuación” o “al final”. El chip “Cola” abre el panel, donde se reordena con ↑/↓, se quitan canciones o se vacía. Lo encolado suena antes que el orden normal (biblioteca, favoritas o lista activa); la cola es de la sesión: al cerrar la app se pierde.
6. **Sincronizar** (opcional): levantá el backend (`cd backend/Vitra.Api; dotnet run`) y tocá “Sincronizar”. Podés poner una clave en el diálogo si el backend la exige. Sube lo que tengas más nuevo y baja lo del servidor: metadatos, favoritos, letras y listas. El audio no se sube, así que en el otro dispositivo importá los mismos archivos y después sincronizá para que se emparejen. Si borrás una canción o una lista, el borrado se propaga al otro lado (si alguien la editó después, gana la edición más nueva y vuelve a aparecer). Desde el celular: en la compu corré `npm run dev:red` y el backend con `dotnet run --launch-profile red`; en el teléfono abrí la dirección de red que te muestran los dos (por ejemplo `http://192.168.1.20:5173`) y el diálogo te va a sugerir sola la API de esa misma máquina.
7. **Respaldo**: “Respaldo” → “Descargar respaldo” baja un `.json` con esos mismos datos. Si algún día el navegador limpia el almacenamiento (o querés mudarte de equipo), agregá de nuevo los archivos de audio y tocá “Importar respaldo...”: se vuelven a aplicar favoritos, letras, títulos y listas sobre las canciones que coincidan por nombre y tamaño.

## Desarrollo

```powershell
cd frontend
npm install
npm run dev      # desarrollo con hot reload
npm run dev:red  # igual, pero escuchando en la red (para el celular)
npm run build    # build de producción con service worker
npm run build:app # build para empaquetar como app (sin service worker, a dist-app)
npm run preview  # sirve el build para probarlo
npm test         # tests (parser .lrc, utilidades, cola, visualizador, ejemplos, metadatos, sync y borrados, respaldo y clave)
```

Hay además dos pruebas que manejan el navegador de verdad (Chrome headless y el DevTools Protocol); las dos necesitan el build servido con `npm run preview` en otra terminal:

```powershell
powershell -ExecutionPolicy Bypass -File docs/prueba-ui.ps1   # prueba de la interfaz: 28 comprobaciones (flujos y casos raros)
powershell -ExecutionPolicy Bypass -File docs/medir-ram.ps1   # mide la RAM de la app
```

El backend tiene sus propios tests (xunit):

```powershell
cd backend/Vitra.Api.Tests
dotnet test     # 51 tests (marcas de sincronización, clave de acceso, orígenes permitidos y ruta de la base)
```

Stack: React + TypeScript + Vite, `idb` (IndexedDB), `music-metadata` y `vite-plugin-pwa`. Sin frameworks de UI: CSS a mano con variables y `backdrop-filter`. Los tests usan `vitest` y, para los que tocan IndexedDB, `fake-indexeddb` (solo dependencia de desarrollo).

Estructura:

```
frontend/src/
  App.tsx        # interfaz y lógica del reproductor
  biblioteca.ts  # IndexedDB: pistas, archivos, listas, favoritos y borrados pendientes
  cola.ts        # cola de reproducción (lógica pura)
  letras.ts      # parser y serializador de letras .lrc
  respaldo.ts    # respaldo de la biblioteca en JSON
  sinc.ts        # cliente del backend (subir y bajar cambios y borrados)
  utilidades.ts  # formato de tiempo, tamaños y normalización de texto
  visualizador.ts # reparto logarítmico del espectro en barras
  index.css      # estilos (vidrio, tema oscuro)
frontend/public/demo/  # canción de ejemplo CC0 y su letra
backend/Vitra.Api/     # API opcional de sincronización (ASP.NET Core + SQLite)
  Clave.cs             # clave de acceso opcional (encabezado X-Clave)
  BaseDeDatos.cs       # dónde vive el SQLite (por defecto vitra.db, configurable)
  Modelos.cs           # entidades y marcas de sincronización
  Migrations/          # esquema de la base (EF Core, se aplica al arrancar)
backend/Vitra.Api.Tests/  # tests de .NET (xunit)
escritorio/Vitra.Escritorio/  # app de escritorio (WPF + WebView2)
frontend/android/             # proyecto Android (Capacitor)
docs/logo.png
docs/medir-ram.ps1      # mide la RAM de la app (Chrome headless)
docs/prueba-ui.ps1      # prueba de la interfaz (28 comprobaciones, Chrome headless)
```

## Apps de escritorio y Android

Vitra también se puede empaquetar como aplicación sin reescribir nada: es la misma app web adentro de una ventana (escritorio) o de un WebView (Android). Primero va el build pensado para empaquetar, que no lleva service worker (los archivos viajan dentro del paquete, así que no hace falta):

```powershell
cd frontend
npm run build:app   # genera dist-app
```

### Escritorio (`.exe`)

El proyecto está en `escritorio/Vitra.Escritorio` (WPF + **WebView2**, el motor que ya trae Windows 11). No hace falta instalar nada más. El perfil, con tu biblioteca, queda en `%LOCALAPPDATA%\Vitra\WebView2` (aparte del que usa el navegador).

```powershell
cd escritorio/Vitra.Escritorio
dotnet publish -c Release
```

Queda `Vitra.exe` (≈ 1,4 MB) y, al lado, la carpeta `web/` con la app (por eso se entrega como carpeta o `.zip`, no el `.exe` solo). Necesita el **.NET Desktop Runtime 10** (ya lo tenés con el SDK); si querés un `.exe` que corra en cualquier Windows sin instalar nada, agregá `--self-contained true` (pesa bastante más).

### Android (`.apk`)

El proyecto está en `frontend/android` (**Capacitor**). Para compilarlo hace falta **JDK 21** y el **Android SDK** (lo más simple es instalar [Android Studio](https://developer.android.com/studio), que trae los dos). Una vez instalado, con el celular conectado por USB o sin él:

```powershell
cd frontend
npm run build:app
npx cap sync android
cd android
.\gradlew assembleDebug
```

El APK queda en `android\app\build\outputs\apk\debug\app-debug.apk` y se instala con `adb install -r app\build\outputs\apk\debug\app-debug.apk`. Ese es un APK **de prueba** (firma de depuración): sirve para tu teléfono, pero para repartirlo a otras personas hay que firmarlo con una clave propia (`assembleRelease` + keystore).

El ícono hoy es el genérico de Capacitor; se puede reemplazar por el de Vitra con `npx @capacitor/assets generate` a partir de un PNG.

**A probar en el teléfono:** el audio en segundo plano. El APK reproduce con la app abierta, pero todavía **no** tiene un servicio de primer plano, así que Android podría cortar el audio al mandarla al fondo o apagar la pantalla. Es lo primero que conviene verificar en el dispositivo real.

## Rendimiento

Medido con `docs/medir-ram.ps1` (Chrome headless, perfil limpio, sirviendo el build con `npm run preview`):

| Momento | Heap de JS de la app | Navegador entero |
| --- | --- | --- |
| Pestaña vacía (referencia) | 0,4 MB | ~470 MB |
| Vitra cargada, sin canciones | 2,2 MB | ~650 MB |
| Con las tres canciones de ejemplo (14 MB de audio) | 3,6 MB | ~680 MB |

La app en sí ocupa **2–4 MB**. El audio no está en memoria: vive en IndexedDB y el `<audio>` lo lee desde un blob. Lo que pese el resto es del navegador: cada pestaña arranca su propio proceso (*renderer*) y eso ya son cientos de MB antes de cargar nada. El heap se mantiene bajo porque:

- las carátulas se reducen a 256 px y sus `objectURL` se liberan al cambiar de vista (`URL.revokeObjectURL`);
- la lista está **virtualizada**: solo se pintan las filas visibles;
- el audio no se copia a `ArrayBuffer`: vive en IndexedDB y el `<audio>` lo lee desde un blob;
- el visualizador usa Web Audio API con `requestAnimationFrame` a 30 fps, sin re-render de React.

El bundle de producción son ~275 KB de JavaScript (85 KB comprimido) más 10 KB de CSS.

Para repetir la medición: `cd frontend; npm run build; npm run preview` y, en otra terminal, `powershell -ExecutionPolicy Bypass -File docs/medir-ram.ps1`.

El backend es opcional: Vitra funciona entero sin él. Para levantarlo:

```powershell
cd backend/Vitra.Api
dotnet run       # API en http://localhost:5041
dotnet run --launch-profile red   # además escucha en la red (para el celular)
```

Arranca abierta; si le ponés una clave, los endpoints `/api/*` piden el encabezado `X-Clave` (lo manda el diálogo de Sincronizar por vos). La forma recomendada es guardarla fuera del repo, desde `backend/Vitra.Api`:

```powershell
dotnet user-secrets set "Vitra:Clave" "mi-clave-secreta"
```

También sirve `"Vitra:Clave"` en `appsettings.json`, `--Vitra:Clave=...` al arrancar o la variable `VITRA_CLAVE`.

Detalles de los endpoints en `backend/README.md`.

## Restricciones conocidas

- **iPhone/iPad (Safari)**: la app no puede controlar el volumen del sistema, puede limpiar el almacenamiento si el dispositivo está con poco espacio (por eso pide persistencia) y el primer `play()` requiere un toque del usuario.
- **Firefox** no implementa `backdrop-filter` igual que Chrome; la interfaz funciona, se ve un poco distinta.
- Los archivos importados no se pueden recuperar si el navegador borra los datos del sitio; Vitra pide almacenamiento persistente para reducir ese riesgo. Si tenés un respaldo en JSON, volvés a agregar los audios e importás el archivo: recuperás metadatos, favoritos, letras y listas.
- **Sincronizar desde el celular**: anda por la red local, pero el service worker (offline e instalable) solo se habilita en HTTPS o en localhost, así que por HTTP en la red el teléfono usa la app como página web nomás. El backend tiene que estar escuchando en la red (`dotnet run --launch-profile red`) y, si no le ponés clave, cualquier aparato de la red puede leer tu biblioteca.

## Canciones de ejemplo

El botón “Cargar canciones de ejemplo” trae tres temas **CC0** (dominio público), todos con su atribución en `frontend/public/demo/README.md`:

- `demo1.mp3`: “Ancient Power Of Serpents” de **Kevin MacLeod** ([incompetech.com](https://incompetech.com)). Su `.lrc` incluido es solo una guía de tiempos para probar la sincronización.
- `demo2.mp3`: “Nocturne Op. 9 no. 1 in B flat” de **Frédéric Chopin**, grabación de Wikimedia Commons.
- `demo3.mp3`: “EG 508 Wir pflügen und wir streuen” de **Wolfgang Kindl**, de Wikimedia Commons.

## Estado del proyecto

Vitra está **completa y en uso**: no le falta nada del plan original.

- **Funciona entera sin backend.** El servidor de sincronización (`backend/Vitra.Api`) es opcional: solo hace falta si querés la misma biblioteca en varios dispositivos.
- **Tests:** 101 del frontend (Vitest) y 51 del backend (xunit), todos en verde. El build y el lint no tiran errores.
- **Sin cuentas, sin servidores de terceros, sin rastreo:** la biblioteca vive en tu equipo (IndexedDB).
- **Licencia:** el código es **MIT** (ver [Licencia](#licencia)); las canciones de ejemplo son CC0.
- **Se corre desde el repo** (todavía sin releases publicadas).

Lo hecho, en detalle, está en el [Roadmap](#roadmap). Lo que falta es **distribuirla como aplicación**: de escritorio (`.exe`) y de Android (`.apk`), en vez de abrirla en el navegador.

## Roadmap

- [x] Cola de reproducción manual (a continuación / al final, con panel para reordenar)
- [x] Carátula destacada en las favoritas
- [x] Edición de metadatos y renombrado de listas
- [x] Tests unitarios (parser `.lrc`, utilidades, cola, ejemplos, metadatos, sincronización y respaldo)
- [x] Prueba de la interfaz en Chrome headless (28 comprobaciones: flujos y casos raros, `docs/prueba-ui.ps1`)
- [x] Backend opcional con ASP.NET Core para sincronizar bibliotecas (v2)
- [x] Propagar borrados al sincronizar (tumbas con su propia marca, que compiten igual que las ediciones)
- [x] Autenticación con clave para el backend (opcional, cabezal `X-Clave`); con `Vitra:Clave` vacío queda abierto para red local.
- [x] Migraciones de EF Core en vez de `EnsureCreated` (la base se pone al día sola al arrancar)
- [x] Exportar e importar la biblioteca en JSON
- [x] Medir y documentar el consumo de RAM (`docs/medir-ram.ps1`)
- [x] Tres canciones de ejemplo CC0 (Kevin MacLeod, Chopin y un himno de Wikimedia)
- [ ] Empaquetar como aplicación de escritorio (`.exe`)
- [ ] Empaquetar como aplicación de Android (`.apk`)

## Licencia

El código de Vitra es **MIT** (Copyright © 2026 Palacios Damian): podés usarlo, modificarlo, publicarlo y venderlo, dejando el aviso de copyright. El texto completo está en [`LICENSE`](LICENSE).

La licencia cubre el código, no la música. Las tres canciones de ejemplo son **CC0 1.0** (dominio público) y su atribución está en [`frontend/public/demo/README.md`](frontend/public/demo/README.md).
