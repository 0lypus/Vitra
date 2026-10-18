/* API de sincronización de Vitra (v2).

   No guarda archivos de audio: solo metadatos, favoritos, letras y listas,
   para poder restaurar la biblioteca en otro dispositivo. Las canciones se
   emparejan por "nombreArchivo|tamano".

   Uso pensado para una red local o un servidor propio. La clave de acceso es
   opcional: si no configurás ninguna, la API queda abierta (no la expongas a
   internet así). Para exigirla, definí "Vitra:Clave" en appsettings.json o la
   variable de entorno VITRA_CLAVE. */

using Microsoft.EntityFrameworkCore;
using Vitra.Api;

var builder = WebApplication.CreateBuilder(args);

/* Clave de acceso opcional: vacía = API abierta (para red local).
   Sale de appsettings.json ("Vitra:Clave"), de --Vitra:Clave=... o, si ahí no
   hay nada, de la variable de entorno VITRA_CLAVE. */
var claveApi = (builder.Configuration["Vitra:Clave"] ?? "").Trim();
if (claveApi.Length == 0) claveApi = (Environment.GetEnvironmentVariable("VITRA_CLAVE") ?? "").Trim();

builder.Services.AddDbContext<VitraContext>(opciones =>
    opciones.UseSqlite($"Data Source={builder.Environment.ContentRootPath}/vitra.db"));

var builderCors = builder.Services.AddCors(opciones =>
    opciones.AddPolicy("frontend", p => p
        .WithOrigins("http://localhost:5173", "https://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

/* Aplica las migraciones al arrancar: la base es descartable (se regenera con
   un sync), así que no hace falta que la toques a mano. Si venís de una versión
   que creaba la base de otra forma, borrá vitra.db una vez y listo. */
using (var alcance = app.Services.CreateScope())
{
    var baseDatos = alcance.ServiceProvider.GetRequiredService<VitraContext>().Database;
    try
    {
        baseDatos.Migrate();
    }
    catch (Exception error)
    {
        alcance.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Vitra").LogError(
            error,
            "No se pudo preparar vitra.db. Si venís de una versión anterior de Vitra.Api, borrá el archivo (se regenera con el próximo sync) y volvé a arrancar.");
        throw;
    }
}

app.UseCors("frontend");

/* Con clave configurada, los endpoints /api/* piden el encabezado X-Clave */
if (claveApi.Length > 0)
{
    app.Use(async (contexto, siguiente) =>
    {
        if (contexto.Request.Path.StartsWithSegments("/api") && !Clave.EsValida(claveApi, contexto.Request.Headers[Clave.Encabezado]))
        {
            contexto.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await contexto.Response.WriteAsJsonAsync(new { error = $"Falta la clave o es incorrecta (encabezado {Clave.Encabezado})." });
            return;
        }
        await siguiente();
    });
    app.Logger.LogInformation("Vitra API: clave de acceso activada (encabezado {Encabezado}).", Clave.Encabezado);
}
else
{
    app.Logger.LogWarning(
        "Vitra API: no hay clave configurada, así que la API queda abierta. Definí \"Vitra:Clave\" en appsettings.json o la variable de entorno VITRA_CLAVE para protegerla.");
}

/* Comprobación de vida */
app.MapGet("/salud", () => Results.Ok(new { mensaje = "Vitra API arriba", hora = DateTime.UtcNow }));

/* Devuelve todo lo que tiene el servidor (el cliente sube solo lo que falte o esté viejo) */
app.MapGet("/api/sinc", async (VitraContext db) =>
    Results.Ok(new
    {
        pistas = await db.Pistas.AsNoTracking().OrderBy(p => p.Clave).ToListAsync(),
        listas = await db.Listas.AsNoTracking().OrderBy(l => l.Nombre).ToListAsync(),
    }));

/* Upsert de una pista: si la clave existe y el servidor está más viejo, reemplaza */
app.MapPut("/api/pistas", async (PistaDto dto, VitraContext db) =>
{
    if (string.IsNullOrWhiteSpace(dto.Clave)) return Results.BadRequest("Falta la clave.");
    var marca = Marcas.Normalizar(dto.Actualizado);

    var existente = await db.Pistas.FirstOrDefaultAsync(p => p.Clave == dto.Clave);
    if (existente is null)
    {
        db.Pistas.Add(new PistaSinc
        {
            Clave = dto.Clave,
            Titulo = dto.Titulo,
            Artista = dto.Artista,
            Album = dto.Album,
            Duracion = dto.Duracion,
            Favorito = dto.Favorito,
            Letra = dto.Letra,
            Actualizado = marca,
            Borrado = dto.Borrado,
        });
    }
    else if (string.CompareOrdinal(marca, existente.Actualizado) >= 0)
    {
        // Un borrado no arrastra los metadatos: solo deja marcada la tumba
        if (!dto.Borrado)
        {
            existente.Titulo = dto.Titulo;
            existente.Artista = dto.Artista;
            existente.Album = dto.Album;
            existente.Duracion = dto.Duracion;
            existente.Favorito = dto.Favorito;
            existente.Letra = dto.Letra;
        }
        existente.Borrado = dto.Borrado;
        existente.Actualizado = marca;
    }
    await db.SaveChangesAsync();
    return Results.Ok();
});

/* Baja una pista por clave. No elimina la fila: deja una tumba (Borrado) con
   la marca de ahora, así los otros dispositivos se enteran al sincronizar */
app.MapDelete("/api/pistas/{clave}", async (string clave, VitraContext db) =>
{
    var marca = Marcas.Normalizar(null);
    var filas = await db.Pistas
        .Where(p => p.Clave == clave)
        .ExecuteUpdateAsync(s => s
            .SetProperty(p => p.Borrado, true)
            .SetProperty(p => p.Actualizado, marca));
    return filas > 0 ? Results.Ok() : Results.NotFound();
});

/* Upsert de una lista por nombre */
app.MapPut("/api/listas", async (ListaDto dto, VitraContext db) =>
{
    if (string.IsNullOrWhiteSpace(dto.Nombre)) return Results.BadRequest("Falta el nombre.");
    var marca = Marcas.Normalizar(dto.Actualizado);

    var existente = await db.Listas.FirstOrDefaultAsync(l => l.Nombre == dto.Nombre);
    if (existente is null)
    {
        db.Listas.Add(new ListaSinc
        {
            Nombre = dto.Nombre.Trim(),
            Pistas = dto.Pistas,
            Actualizado = marca,
            Borrado = dto.Borrado,
        });
    }
    else if (string.CompareOrdinal(marca, existente.Actualizado) >= 0)
    {
        if (!dto.Borrado) existente.Pistas = dto.Pistas;
        existente.Borrado = dto.Borrado;
        existente.Actualizado = marca;
    }
    await db.SaveChangesAsync();
    return Results.Ok();
});

/* Baja una lista por nombre (también deja tumba) */
app.MapDelete("/api/listas/{nombre}", async (string nombre, VitraContext db) =>
{
    var marca = Marcas.Normalizar(null);
    var filas = await db.Listas
        .Where(l => l.Nombre == nombre)
        .ExecuteUpdateAsync(s => s
            .SetProperty(l => l.Borrado, true)
            .SetProperty(l => l.Actualizado, marca));
    return filas > 0 ? Results.Ok() : Results.NotFound();
});

app.Run();
