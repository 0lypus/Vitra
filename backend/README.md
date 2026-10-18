# Vitra API (v2)

Backend opcional de sincronización para Vitra. **No guarda archivos de audio**: solo metadatos (título, artista, álbum, duración), favoritos, letras `.lrc` como texto y listas de reproducción, para poder restaurar la biblioteca en otro dispositivo.

Las canciones se emparejan por `nombreArchivo|tamano`, porque los ids de IndexedDB cambian en cada navegador.

## Correr

```powershell
cd backend/Vitra.Api
dotnet run
```

Levanta en `http://localhost:5041` (el puerto está en `Properties/launchSettings.json`; se puede cambiar con `dotnet run --urls http://localhost:5199`). Crea `vitra.db` (SQLite) automáticamente la primera vez.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/salud` | Comprobación de vida |
| GET | `/api/sinc` | Devuelve todas las pistas y listas del servidor |
| PUT | `/api/pistas` | Upsert de una pista (gana la versión más nueva por `actualizado`) |
| DELETE | `/api/pistas/{clave}` | Baja una pista por clave |
| PUT | `/api/listas` | Upsert de una lista por nombre |
| DELETE | `/api/listas/{nombre}` | Baja una lista por nombre |

## Seguridad (por ahora)

- **Sin autenticación**: pensado para red local o servidor propio detrás de tu propio proxy. No la expongas a internet tal cual.
- CORS permite solo `http://localhost:5173` (el dev server del frontend).

## Pendiente para la v2

- [ ] Botón de sincronizar en el frontend (subir cambios / bajar lo del servidor)
- [ ] Autenticación simple (clave por usuario)
- [ ] Migraciones de EF Core en vez de `EnsureCreated`
