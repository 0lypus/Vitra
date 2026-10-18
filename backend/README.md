# Vitra API (v2)

Backend opcional de sincronización para Vitra. **No guarda archivos de audio**: solo metadatos (título, artista, álbum, duración), favoritos, letras `.lrc` como texto y listas de reproducción, para poder restaurar la biblioteca en otro dispositivo.

Las canciones se emparejan por `nombreArchivo|tamano`, porque los ids de IndexedDB cambian en cada navegador.

## Correr

```powershell
cd backend/Vitra.Api
dotnet run
```

Levanta en `http://localhost:5041` (el puerto está en `Properties/launchSettings.json`; se puede cambiar con `dotnet run --urls http://localhost:5199`). Crea `vitra.db` (SQLite) automáticamente la primera vez.

Para exigir clave de acceso, poné `"Vitra:Clave"` en `appsettings.json`, o pasala al arrancar sin tocar el archivo:

```powershell
# PowerShell
$env:VITRA_CLAVE = "mi-clave-secreta"
dotnet run
# o directo en la línea de comandos:
dotnet run -- --Vitra:Clave=mi-clave-secreta
```

El cliente la escribe una vez en el diálogo **Sincronizar** y la manda en cada pedido.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/salud` | Comprobación de vida |
| GET | `/api/sinc` | Devuelve todas las pistas y listas del servidor |
| PUT | `/api/pistas` | Upsert de una pista (gana la versión más nueva por `actualizado`). Si viene con `borrado: true` deja la tumba |
| DELETE | `/api/pistas/{clave}` | Deja la pista como tumba (`borrado: true` con la marca de ahora); no elimina la fila |
| PUT | `/api/listas` | Upsert de una lista por nombre (acepta `borrado: true` igual que las pistas) |
| DELETE | `/api/listas/{nombre}` | Deja la lista como tumba, igual que las pistas |

Las marcas `actualizado` se guardan como texto ISO UTC (`yyyy-MM-ddTHH:mm:ss.fffZ`, el mismo formato que `Date.toISOString()`). Al normalizarlas así, comparar dos marcas como texto da el mismo resultado que comparar los tiempos, y el ida y vuelta no pierde milisegundos ni la `Z`.

### Borrados

Los borrados no se eliminan: quedan como **tumbas** (`borrado: true`) con su propia marca `actualizado`, y `/api/sinc` las devuelve junto con lo vivo. Así el otro dispositivo se entera y borra en casa, pero si alguien editó esa canción después, la edición más nueva gana y la canción vuelve a existir. Las tumbas no arrastran metadatos: un borrado subido desde el cliente no pisa el título/autor que ya estaba guardado, y el servidor tampoco descarta los datos que tenía.

Para arrancar de una versión anterior (sin la columna `Borrado`), borrá `backend/Vitra.Api/vitra.db`: se regenera solo al arrancar. Todavía no hay migraciones de EF Core.

## Seguridad

- **Clave opcional**: con `Vitra:Clave` vacío la API queda **abierta** (sirve para red local). En cuanto le pongas una clave, todos los endpoints `/api/*` responden `401` salvo que manden el encabezado `X-Clave` con ese valor. El comparador es de tiempo constante y el encabezado está permitido en el CORS. `/salud` queda siempre abierto, para poder chequear que el servidor responde.
- CORS permite solo `http://localhost:5173` (el dev server del frontend).
- Aun con clave, sigue pensado para red local o servidor propio detrás de tu propio proxy: no lo expongas a internet tal cual.

## Tests

```powershell
cd backend/Vitra.Api.Tests
dotnet test
```

Cubren las marcas `actualizado` (formato, zona horaria y orden alfabético) y la clave de acceso.

## Pendientes

- [x] Botón de sincronizar en el frontend (subir cambios / bajar lo del servidor)
- [x] Clave de acceso opcional para `/api/*` (encabezado `X-Clave`)
- [x] Propagar los borrados (tumbas con `borrado: true` que compiten por `actualizado`)
- [ ] Migraciones de EF Core en vez de `EnsureCreated`
