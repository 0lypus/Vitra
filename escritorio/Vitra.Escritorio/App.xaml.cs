using System.Windows;

namespace Vitra.Escritorio;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        new MainWindow(e.Args).Show();
    }
}
