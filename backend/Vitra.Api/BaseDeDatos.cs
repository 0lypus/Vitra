/* Ubicación del archivo SQLite de la API.

   Por defecto usa "vitra.db" al lado del proyecto. Con "Vitra:Base" (en
   appsettings.json, con --Vitra:Base=... al arrancar o con la variable de
   entorno VITRA_BASE) se puede apuntar a otra ruta: sirve, por ejemplo, para
   probar con una base descartable sin tocar la de siempre. Una ruta relativa se
   resuelve contra el directorio del proyecto. */

namespace Vitra.Api;

public static class BaseDeDatos
{
    /* Nombre del archivo cuando no se configura nada */
    public const string ArchivoPorDefecto = "vitra.db";

    /* Ruta del archivo de la base: manda lo configurado, después la variable de
       entorno y, si no hay nada, el archivo por defecto en el directorio del
       proyecto. */
    public static string Ruta(string? configurada, string? variableEntorno, string directorioProyecto)
    {
        var ruta = (configurada ?? "").Trim();
        if (ruta.Length == 0) ruta = (variableEntorno ?? "").Trim();
        if (ruta.Length == 0) ruta = ArchivoPorDefecto;
        return Path.IsPathRooted(ruta) ? ruta : Path.Combine(directorioProyecto, ruta);
    }
}
