using System.Net;
using Vitra.Api;

namespace Vitra.Api.Tests;

public class OrigenesTests
{
    [Theory]
    [InlineData("http://localhost:5173")]
    [InlineData("https://localhost:4173")]
    [InlineData("http://127.0.0.1:5173")]
    [InlineData("http://192.168.0.10:5173")]
    [InlineData("http://10.0.0.5:5173")]
    [InlineData("http://172.16.0.1:5173")]
    [InlineData("http://172.31.255.254:5173")]
    [InlineData("http://mibook.local:5173")]
    [InlineData("http://[::1]:5173")]
    [InlineData("http://[fd00::1]:5173")]
    [InlineData("http://[fe80::1234]:5173")]
    public void AceptaLosOrigenesDeLaRedLocal(string origen)
    {
        Assert.True(Origenes.EsDeRedLocal(origen));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("cualquier cosa")]
    [InlineData("http://vitra.example.com")]
    [InlineData("https://google.com")]
    [InlineData("http://8.8.8.8")]
    [InlineData("http://172.15.0.1")] // justo antes del rango privado
    [InlineData("http://172.32.0.1")] // justo después
    [InlineData("http://11.0.0.1")]
    [InlineData("ftp://192.168.0.10")] // no es http(s)
    public void RechazaElResto(string? origen)
    {
        Assert.False(Origenes.EsDeRedLocal(origen));
    }

    [Fact]
    public void LasDireccionesLocalesSonPrivadasYNoLlevanLoopback()
    {
        foreach (var texto in Origenes.DireccionesLocales())
        {
            Assert.True(IPAddress.TryParse(texto, out var ip));
            Assert.False(IPAddress.IsLoopback(ip!));
            Assert.True(Origenes.EsDeRedLocal($"http://{texto}"));
        }
    }
}
