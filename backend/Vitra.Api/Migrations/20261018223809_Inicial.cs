using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vitra.Api.Migrations
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Listas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Nombre = table.Column<string>(type: "TEXT", nullable: false),
                    Pistas = table.Column<string>(type: "TEXT", nullable: false),
                    Actualizado = table.Column<string>(type: "TEXT", nullable: false),
                    Borrado = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Listas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pistas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Clave = table.Column<string>(type: "TEXT", nullable: false),
                    Titulo = table.Column<string>(type: "TEXT", nullable: false),
                    Artista = table.Column<string>(type: "TEXT", nullable: false),
                    Album = table.Column<string>(type: "TEXT", nullable: false),
                    Duracion = table.Column<double>(type: "REAL", nullable: false),
                    Favorito = table.Column<bool>(type: "INTEGER", nullable: false),
                    Letra = table.Column<string>(type: "TEXT", nullable: true),
                    Actualizado = table.Column<string>(type: "TEXT", nullable: false),
                    Borrado = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pistas", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Listas_Nombre",
                table: "Listas",
                column: "Nombre",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pistas_Clave",
                table: "Pistas",
                column: "Clave",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Listas");

            migrationBuilder.DropTable(
                name: "Pistas");
        }
    }
}
