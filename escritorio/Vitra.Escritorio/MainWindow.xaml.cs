/* Ventana principal: muestra la app web (frontend/dist-app) con WebView2.

   Los archivos se sirven desde una carpeta local mapeada al host "vitra.local",
   así el origen es estable y los datos guardados (IndexedDB: la biblioteca)
   persisten entre sesiones. El perfil del WebView2 vive en
   %LOCALAPPDATA%\Vitra\WebView2, aparte del instalado en el navegador. */

using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace Vitra.Escritorio;

public partial class MainWindow : Window
{
    private const string Host = "vitra.local";
    private readonly string? _archivoPrueba;

    public MainWindow(string[] args)
    {
        InitializeComponent();

        // Con "--probar <archivo>" carga la app, escribe el resultado en ese
        // archivo y se cierra: sirve para verificar sin mirar la pantalla.
        var i = Array.IndexOf(args, "--probar");
        if (i >= 0 && i + 1 < args.Length) _archivoPrueba = args[i + 1];

        Loaded += async (_, _) => await IniciarAsync();
    }

    private async Task IniciarAsync()
    {
        var web = Path.Combine(AppContext.BaseDirectory, "web");
        if (!File.Exists(Path.Combine(web, "index.html")))
        {
            MessageBox.Show(
                "No encuentro la app web. Compilala con \"npm run build:app\" en la carpeta frontend y volvé a abrir Vitra.",
                "Vitra", MessageBoxButton.OK, MessageBoxImage.Error);
            Application.Current.Shutdown();
            return;
        }

        var perfil = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Vitra", "WebView2");
        Directory.CreateDirectory(perfil);

        var entorno = await CoreWebView2Environment.CreateAsync(null, perfil);
        await navegador.EnsureCoreWebView2Async(entorno);
        navegador.CoreWebView2.SetVirtualHostNameToFolderMapping(
            Host, web, CoreWebView2HostResourceAccessKind.Allow);

        if (_archivoPrueba is not null)
        {
            navegador.NavigationCompleted += async (_, _) => await ProbarAsync();
        }

        navegador.Source = new Uri($"https://{Host}/index.html");
    }

    private async Task ProbarAsync()
    {
        var estado = "vacio";
        for (var intento = 0; intento < 40; intento++)
        {
            var respuesta = await navegador.CoreWebView2.ExecuteScriptAsync(
                "(document.getElementById('root') && document.getElementById('root').children.length > 0) ? 'listo' : 'vacio'");
            estado = respuesta.Trim('"');
            if (estado == "listo") break;
            await Task.Delay(250);
        }

        File.WriteAllText(_archivoPrueba!, $"titulo={navegador.CoreWebView2.DocumentTitle} raiz={estado}");
        Application.Current.Shutdown();
    }
}
