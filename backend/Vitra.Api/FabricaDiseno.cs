using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Vitra.Api;

/* La usa "dotnet ef" cuando corre en tiempo de diseño (por ejemplo al generar
   una migración): así crea el contexto directo, sin levantar la app ni abrir la
   base. En tiempo de ejecución no se usa para nada. */
public class FabricaDiseno : IDesignTimeDbContextFactory<VitraContext>
{
    public VitraContext CreateDbContext(string[] args)
    {
        var opciones = new DbContextOptionsBuilder<VitraContext>()
            .UseSqlite("Data Source=vitra.db")
            .Options;

        return new VitraContext(opciones);
    }
}
