/* Modelos de sincronización del backend de Vitra.

   Los archivos de audio nunca se suben: el backend guarda solo metadatos,
   favoritos, letras y listas, para poder restaurarlos en otro dispositivo.
   La clave de cada canción es "nombreArchivo|tamano", porque los ids de
   IndexedDB cambian en cada navegador. */

namespace Vitra.Api;

public class PistaSinc
{
    public int Id { get; set; }

    /* "nombreArchivo|tamano": única por canción */
    public required string Clave { get; set; }

    public required string Titulo { get; set; }
    public required string Artista { get; set; }
    public required string Album { get; set; }
    public double Duracion { get; set; }
    public bool Favorito { get; set; }

    /* Letra .lrc como texto crudo; el frontend la vuelve a parsear */
    public string? Letra { get; set; }

    /* Marca de tiempo (UTC) de la última modificación, para decidir qué gana */
    public DateTime Actualizado { get; set; }
}

public class ListaSinc
{
    public int Id { get; set; }
    public required string Nombre { get; set; }

    /* Claves de las pistas en el orden elegido (una por línea) */
    public required string Pistas { get; set; }

    public DateTime Actualizado { get; set; }
}

/* Cuerpos que acepta la API (sin el id numérico, que asigna el servidor) */

public record PistaDto(
    string Clave,
    string Titulo,
    string Artista,
    string Album,
    double Duracion,
    bool Favorito,
    string? Letra,
    DateTime Actualizado);

public record ListaDto(
    string Nombre,
    string Pistas,
    DateTime Actualizado);
