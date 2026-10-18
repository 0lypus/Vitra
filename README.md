<p align="center">
  <img src="docs/logo.png" alt="Logo de Vitra" width="120" />
</p>

<h1 align="center">Vitra</h1>

<p align="center">
  Reproductor de música liviano con estética de vidrio. PWA para PC y móvil.
</p>

Vitra es una Progressive Web App que reproduce la música que ya tenés en tu dispositivo: importás los archivos, quedan guardados en el navegador (IndexedDB) y listo. Sin cuentas, sin servidores, sin rastreo: toda tu biblioteca vive en tu equipo.

## Características

- **Biblioteca local**: importá MP3, M4A, AAC, OGG, OPUS, WAV, FLAC, WEBM y MP4. Los archivos se guardan en IndexedDB junto con sus metadatos y carátulas (comprimidas a 256 px).
- **Fondo dinámico**: el color dominante de la carátula tiñe el fondo con una transición suave.
- **Letras sincronizadas (.lrc)**: parser propio; resalta la línea actual, se auto-centra y podés saltar haciendo clic en cualquier línea.
- **Favoritos y listas de reproducción**: corazón en cada canción, chips de filtro y listas propias (crear, eliminar, agregar o quitar canciones).
- **Aleatorio y repetir** (todas / una), recordados entre sesiones.
- **Buscador** por título o artista, sin importar mayúsculas ni tildes.
- **Visualizador de audio** con Web Audio API (espectro de 128 barras a 30 fps), encendible/apagable.
- **Biblioteca virtualizada**: la lista solo pinta las filas visibles, así que cientos de canciones no la traban.
- **Atajos de teclado**: `Espacio` play/pausa · `←`/`→` ±5 s · `Shift+←`/`Shift+→` pista anterior/siguiente · `↑`/`↓` volumen · `S` aleatorio · `R` repetir.
- **Arrastrar y soltar**: soltá archivos de audio o `.lrc` sobre la ventana para importarlos.
- **Media Session**: controles en la pantalla de bloqueo, notificaciones y teclas multimedia con carátula.
- **PWA instalable**: funciona offline (service worker con Workbox) e incluye canciones de ejemplo.
- **Respeta tu batería y tu espacio**: pide almacenamiento persistente y muestra cuánto ocupás.

## Uso

1. **Agregar música**: botón “+ Agregar música”, o arrastrá los archivos sobre la ventana. También podés tocar “Cargar canciones de ejemplo” para probar con una canción CC0.
2. **Letras**: guardá un archivo `.lrc` con el mismo nombre que el audio (por ejemplo `cancion.mp3` + `cancion.lrc`) y agregalos juntos, o soltá el `.lrc` sobre la ventana para aplicarlo a una canción ya importada.
3. **Listas**: el botón `+` de cada fila abre el diálogo para agregar o quitar la canción de una lista (y crear listas desde ahí). Los chips arriba de la biblioteca filtran por “Todas”, “Favoritas” o cada lista.
4. **Reproducción**: clic en cualquier canción; la navegación (anterior/siguiente) recorre lo que esté filtrado en ese momento.

## Desarrollo

```powershell
cd frontend
npm install
npm run dev      # desarrollo con hot reload
npm run build    # build de producción con service worker
npm run preview  # sirve el build para probarlo
```

Stack: React + TypeScript + Vite, `idb` (IndexedDB), `music-metadata` y `vite-plugin-pwa`. Sin frameworks de UI: CSS a mano con variables y `backdrop-filter`.

Estructura:

```
frontend/src/
  App.tsx        # interfaz y lógica del reproductor
  biblioteca.ts  # IndexedDB: pistas, archivos, listas, favoritos
  letras.ts      # parser de letras .lrc
  index.css      # estilos (vidrio, tema oscuro)
frontend/public/demo/  # canción de ejemplo CC0 y su letra
docs/logo.png
```

## Restricciones conocidas

- **iPhone/iPad (Safari)**: la app no puede controlar el volumen del sistema, puede limpiar el almacenamiento si el dispositivo está con poco espacio (por eso pide persistencia) y el primer `play()` requiere un toque del usuario.
- **Firefox** no implementa `backdrop-filter` igual que Chrome; la interfaz funciona, se ve un poco distinta.
- Los archivos importados no se pueden recuperar si el navegador borra los datos del sitio; Vitra pide almacenamiento persistente para reducir ese riesgo.

## Canciones de ejemplo

`frontend/public/demo/demo1.mp3` es “Ancient Power Of Serpents” de **Kevin MacLeod** ([incompetech.com](https://incompetech.com)), licencia **CC0 1.0** (dominio público). Su `.lrc` incluido es solo una guía de tiempos para probar la sincronización. Ver `frontend/public/demo/README.md`.

## Roadmap

- [ ] Repetir ordenado (colas) y favoritos con carátula destacada
- [ ] Edición de metadatos y renombrado de listas
- [ ] Tests unitarios (parser `.lrc`, utilidades)
- [ ] Backend opcional con ASP.NET Core para sincronizar bibliotecas (v2)

## Licencia

El código de Vitra no tiene licencia todavía; la música de ejemplo es CC0 (ver arriba).
