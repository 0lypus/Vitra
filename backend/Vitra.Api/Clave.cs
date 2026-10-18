/* Clave de acceso opcional de la API.

   Si no configurás ninguna, la API queda abierta: sirve para probarla en
   localhost o en una red de confianza. En cuanto definís una (en
   appsettings.json "Vitra:Clave", con la variable de entorno VITRA_CLAVE, o
   con --Vitra:Clave=... al arrancar), todos los endpoints /api/* piden el
   encabezado "X-Clave" con ese valor. /salud queda siempre abierto, para poder
   chequear que el servidor responde. */

using System.Security.Cryptography;
using System.Text;

namespace Vitra.Api;

public static class Clave
{
    /* Encabezado que manda el cliente con la clave */
    public const string Encabezado = "X-Clave";

    /* ¿Deja pasar la petición?
       - Sin clave configurada: pasa todo (API abierta).
       - Con clave configurada: hace falta que coincida. La comparación es de
         tiempo constante, así no se puede adivinar la clave midiendo lo que
         tarda en responder. */
    public static bool EsValida(string? configurada, string? recibida)
    {
        if (string.IsNullOrWhiteSpace(configurada)) return true;

        var esperada = Encoding.UTF8.GetBytes(configurada.Trim());
        byte[] recibidos = string.IsNullOrWhiteSpace(recibida) ? [] : Encoding.UTF8.GetBytes(recibida.Trim());

        // FixedTimeEquals exige el mismo largo; el largo no es ningún secreto.
        return esperada.Length == recibidos.Length && CryptographicOperations.FixedTimeEquals(esperada, recibidos);
    }
}
