/* Tests de las marcas de sincronización.

   La marca es el texto ISO UTC con el que el cliente decide qué versión gana,
   así que tiene que salir siempre en el mismo formato y con el orden
   alfabético equivalente al temporal. */

using System.Globalization;
using Vitra.Api;

namespace Vitra.Api.Tests;

public class MarcasTests
{
    private const string FormatoIso = @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$";

    [Theory]
    [InlineData("2024-03-01T10:20:30.123Z", "2024-03-01T10:20:30.123Z")]
    [InlineData("2024-03-01T10:20:30Z", "2024-03-01T10:20:30.000Z")]
    [InlineData("2024-03-01T10:20:30", "2024-03-01T10:20:30.000Z")]
    [InlineData("2024-03-01T10:20:30.123+00:00", "2024-03-01T10:20:30.123Z")]
    [InlineData("2024-03-01T07:20:30.123-03:00", "2024-03-01T10:20:30.123Z")]
    public void Normaliza_al_formato_canonico(string entrada, string esperada) =>
        Assert.Equal(esperada, Marcas.Normalizar(entrada));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("cualquier cosa")]
    public void Sin_marca_valida_usa_la_hora_actual(string? entrada)
    {
        var antes = DateTime.UtcNow.AddSeconds(-5);
        var marca = Marcas.Normalizar(entrada);

        Assert.Matches(FormatoIso, marca);
        var fecha = DateTimeOffset.Parse(
            marca,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);
        Assert.InRange(fecha.UtcDateTime, antes, DateTime.UtcNow.AddSeconds(5));
    }

    [Fact]
    public void El_orden_alfabetico_es_el_orden_temporal()
    {
        var vieja = Marcas.Normalizar("2024-03-01T10:20:30.001Z");
        var nueva = Marcas.Normalizar("2024-03-01T10:20:30.002Z");

        Assert.True(string.CompareOrdinal(vieja, nueva) < 0);
    }

    [Fact]
    public void Todos_los_meses_tienen_el_mismo_largo()
    {
        // Si no, "2024-9-..." quedaría antes que "2024-10-..." al comparar texto
        var septiembre = Marcas.Normalizar("2024-09-01T00:00:00Z");
        var octubre = Marcas.Normalizar("2024-10-01T00:00:00Z");

        Assert.Equal(septiembre.Length, octubre.Length);
        Assert.True(string.CompareOrdinal(septiembre, octubre) < 0);
    }
}
