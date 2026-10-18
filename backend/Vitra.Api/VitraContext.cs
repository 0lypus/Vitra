using Microsoft.EntityFrameworkCore;

namespace Vitra.Api;

public class VitraContext(DbContextOptions<VitraContext> opciones) : DbContext(opciones)
{
    public DbSet<PistaSinc> Pistas => Set<PistaSinc>();
    public DbSet<ListaSinc> Listas => Set<ListaSinc>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<PistaSinc>().HasIndex(p => p.Clave).IsUnique();
        mb.Entity<ListaSinc>().HasIndex(l => l.Nombre).IsUnique();
    }
}
