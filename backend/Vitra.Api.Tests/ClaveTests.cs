/* Tests de la clave de acceso del backend. */

using Vitra.Api;

namespace Vitra.Api.Tests;

public class ClaveTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Sin_clave_configurada_deja_pasar_todo(string? configurada)
    {
        Assert.True(Clave.EsValida(configurada, null));
        Assert.True(Clave.EsValida(configurada, ""));
        Assert.True(Clave.EsValida(configurada, "cualquier cosa"));
    }

    [Fact]
    public void Con_clave_configurada_solo_pasa_la_correcta()
    {
        Assert.True(Clave.EsValida("secreta", "secreta"));
        Assert.False(Clave.EsValida("secreta", "otra cosa"));
        Assert.False(Clave.EsValida("secreta", "secret")); // más corta
        Assert.False(Clave.EsValida("secreta", "secretas")); // más larga
        Assert.False(Clave.EsValida("secreta", "SECRETA")); // distingue mayúsculas
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Con_clave_configurada_no_pasa_el_vacio(string? recibida) =>
        Assert.False(Clave.EsValida("secreta", recibida));

    [Fact]
    public void Los_espacios_de_los_bordes_no_cuentan()
    {
        Assert.True(Clave.EsValida(" secreta ", "secreta"));
        Assert.True(Clave.EsValida("secreta", "  secreta  "));
    }

    [Fact]
    public void Acepta_claves_con_acentos_y_emojis() =>
        Assert.True(Clave.EsValida("contraseña-🎵", "contraseña-🎵"));

    [Fact]
    public void El_encabezado_que_espera_el_cliente_es_X_Clave() =>
        Assert.Equal("X-Clave", Clave.Encabezado);
}
