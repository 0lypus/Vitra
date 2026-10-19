# Genera el ícono de la app y la pantalla de inicio de Android a partir del PNG
# de Vitra. Reemplaza los mipmap-*/ic_launcher*.png, los drawable-*/splash.png y
# el color de fondo del ícono adaptativo del proyecto Android.
#
# Usa System.Drawing, así que no suma dependencias (nada de npm ni ImageMagick).
# Es idempotente: correrlo dos veces deja los mismos archivos.
#
#   powershell -ExecutionPolicy Bypass -File docs/iconos-android.ps1

param(
    [string]$Origen = (Join-Path $PSScriptRoot "..\frontend\public\pwa-512x512.png"),
    [string]$Res = (Join-Path $PSScriptRoot "..\frontend\android\app\src\main\res"),
    [string]$Fondo = "#1C0D46",
    [double]$LogoEnSplash = 0.30
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Origen)) { throw "No encuentro el PNG de origen: $Origen" }
if (-not (Test-Path $Res)) { throw "No encuentro la carpeta res del proyecto Android: $Res" }

$color = [System.Drawing.ColorTranslator]::FromHtml($Fondo)
$imagen = [System.Drawing.Image]::FromFile((Resolve-Path $Origen).Path)

# Bitmap con el dibujo ya configurado en buena calidad: devuelve (imagen, graphics)
function Nuevo-Bitmap([int]$ancho, [int]$alto) {
    $bmp = New-Object System.Drawing.Bitmap($ancho, $alto)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    return @($bmp, $g)
}

function Guardar([object[]]$par, [string]$ruta) {
    $par[1].Dispose()
    $par[0].Save($ruta, [System.Drawing.Imaging.ImageFormat]::Png)
    $par[0].Dispose()
}

# Densidades de Android: lado del ícono heredado y del foreground adaptativo
$densidades = [ordered]@{
    "mdpi"    = @(48, 108)
    "hdpi"    = @(72, 162)
    "xhdpi"   = @(96, 216)
    "xxhdpi"  = @(144, 324)
    "xxxhdpi" = @(192, 432)
}

try {
    foreach ($densidad in $densidades.Keys) {
        $lado = $densidades[$densidad][0]
        $frente = $densidades[$densidad][1]
        $carpeta = Join-Path $Res "mipmap-$densidad"

        # Ícono cuadrado (el que usan Android 7 y anteriores)
        $par = Nuevo-Bitmap $lado $lado
        $par[1].DrawImage($imagen, 0, 0, $lado, $lado)
        Guardar $par (Join-Path $carpeta "ic_launcher.png")

        # Ícono redondo
        $par = Nuevo-Bitmap $lado $lado
        $recorte = New-Object System.Drawing.Drawing2D.GraphicsPath
        $recorte.AddEllipse(0, 0, $lado, $lado)
        $par[1].SetClip($recorte)
        $par[1].DrawImage($imagen, 0, 0, $lado, $lado)
        Guardar $par (Join-Path $carpeta "ic_launcher_round.png")

        # Foreground del ícono adaptativo: el contenido entra en la zona segura
        # (el 66% central), el resto queda transparente y lo pone el fondo
        $par = Nuevo-Bitmap $frente $frente
        $par[1].Clear([System.Drawing.Color]::Transparent)
        $contenido = [int]($frente * 0.66)
        $margen = [int](($frente - $contenido) / 2)
        $par[1].DrawImage($imagen, $margen, $margen, $contenido, $contenido)
        Guardar $par (Join-Path $carpeta "ic_launcher_foreground.png")
    }

    # Pantalla de inicio: el logo centrado sobre el color de la app
    foreach ($archivo in Get-ChildItem $Res -Recurse -Filter "splash.png") {
        $medida = [System.Drawing.Image]::FromFile($archivo.FullName)
        $ancho = $medida.Width
        $alto = $medida.Height
        $medida.Dispose()

        $par = Nuevo-Bitmap $ancho $alto
        $par[1].Clear($color)
        $logo = [int]([Math]::Min($ancho, $alto) * $LogoEnSplash)
        $par[1].DrawImage($imagen, [int](($ancho - $logo) / 2), [int](($alto - $logo) / 2), $logo, $logo)
        Guardar $par $archivo.FullName
    }
}
finally {
    $imagen.Dispose()
}

# Color de fondo del ícono adaptativo
$valores = Join-Path $Res "values\ic_launcher_background.xml"
@(
    '<?xml version="1.0" encoding="utf-8"?>'
    '<resources>'
    "    <color name=`"ic_launcher_background`">$Fondo</color>"
    '</resources>'
) | Set-Content -Path $valores -Encoding ASCII

Write-Output "Ícono y pantalla de inicio actualizados en $Res"
