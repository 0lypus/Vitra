/* Tests de la ruta del archivo de la base de datos. */

using Vitra.Api;

namespace Vitra.Api.Tests;

public class BaseDeDatosTests
{
    private static readonly string Proyecto = Path.Combine(Path.GetTempPath(), "proyecto");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Sin_configurar_usa_vitra_db_en_el_proyecto(string? ruta) =>
        Assert.Equal(Path.Combine(Proyecto, "vitra.db"), BaseDeDatos.Ruta(ruta, null, Proyecto));

    [Fact]
    public void Una_ruta_relativa_se_resuelve_contra_el_proyecto() =>
        Assert.Equal(Path.Combine(Proyecto, "prueba.db"), BaseDeDatos.Ruta("prueba.db", null, Proyecto));

    [Fact]
    public void Una_ruta_absoluta_se_usa_tal_cual()
    {
        var absoluta = Path.Combine(Path.GetTempPath(), "vitra-descartable.db");
        Assert.Equal(absoluta, BaseDeDatos.Ruta(absoluta, null, Proyecto));
    }

    [Fact]
    public void La_variable_de_entorno_sirve_cuando_no_hay_configuracion() =>
        Assert.Equal(Path.Combine(Proyecto, "otra.db"), BaseDeDatos.Ruta(null, "otra.db", Proyecto));

    [Fact]
    public void Lo_configurado_gana_sobre_la_variable_de_entorno() =>
        Assert.Equal(Path.Combine(Proyecto, "config.db"), BaseDeDatos.Ruta("config.db", "entorno.db", Proyecto));

    [Fact]
    public void Los_espacios_de_los_bordes_no_cuentan() =>
        Assert.Equal(Path.Combine(Proyecto, "prueba.db"), BaseDeDatos.Ruta("  prueba.db  ", null, Proyecto));
}
