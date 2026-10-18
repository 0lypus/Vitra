using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace Vitra.Api;

/* Decide desde qué páginas puede llamarse a la API.

   En la compu la app corre en http://localhost:5173, pero desde el celular se
   sirve por la IP de la red (http://192.168.x.x:5173), así que también dejamos
   pasar los orígenes de la red local (localhost, IPv4 privadas y direcciones
   IPv6 locales). Igual, la protección de verdad es la clave: esto solo evita
   que una página cualquiera de internet pueda leer tu biblioteca. */
public static class Origenes
{
    /* ¿Es un origen local (localhost, 127.x, ::1) o de la red privada
       (10.x, 172.16-31.x, 192.168.x, fc00::/7, fe80::/10)? */
    public static bool EsDeRedLocal(string? origen)
    {
        if (!Uri.TryCreate(origen, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;

        // Uri.Host viene con corchetes en IPv6 ("[fd00::1]")
        var host = uri.Host.Trim('[', ']');
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) return true;
        if (host.EndsWith(".local", StringComparison.OrdinalIgnoreCase)) return true;
        if (!IPAddress.TryParse(host, out var ip)) return false;

        if (IPAddress.IsLoopback(ip)) return true;
        var bytes = ip.GetAddressBytes();
        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            return bytes[0] == 10
                || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
                || (bytes[0] == 192 && bytes[1] == 168);
        }
        return ip.IsIPv6LinkLocal || (bytes[0] & 0xFE) == 0xFC;
    }

    /* Direcciones IPv4 de la red local, para decirle al usuario con cuál entrar
       desde el celular */
    public static IReadOnlyList<string> DireccionesLocales()
    {
        var listado = new List<string>();
        foreach (var placa in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (placa.OperationalStatus != OperationalStatus.Up) continue;
            if (placa.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            foreach (var direccion in placa.GetIPProperties().UnicastAddresses)
            {
                var ip = direccion.Address;
                if (ip.AddressFamily != AddressFamily.InterNetwork) continue;
                if (EsDeRedLocal($"http://{ip}") && !IPAddress.IsLoopback(ip)) listado.Add(ip.ToString());
            }
        }
        return listado;
    }
}
