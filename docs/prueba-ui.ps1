# Prueba de humo de la interfaz: maneja Vitra con Chrome headless y el DevTools
# Protocol, y comprueba los flujos principales (importar, buscar, reproducir,
# aleatorio/repetir, cola, favoritas, diálogos, borrar y recargar).
#
# Sirve para agarrar bugs como el de las "canciones fantasma": nada reemplaza
# mirar la app de verdad.
#
# Antes hay que servir el build:  cd frontend; npm run build; npm run preview
# Después:                        powershell -ExecutionPolicy Bypass -File docs/prueba-ui.ps1
#
# Ojo: el JavaScript de acá adentro no lleva comillas dobles, porque PowerShell
# se las come (por eso se busca por texto en los botones).

param(
  [string]$Url = "http://localhost:4173/",
  [int]$PuertoDebug = 9228,
  [string]$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$ErrorActionPreference = "Stop"
$perfil = Join-Path $env:TEMP "vitra-qa"

if (-not (Test-Path $Chrome)) { Write-Output "No encontré Chrome en $Chrome"; exit 1 }

# ¿Está sirviendo el build?
$hay = $false
foreach ($i in 1..60) {
  try { Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 5 | Out-Null; $hay = $true; break }
  catch { Start-Sleep -Milliseconds 1000 }
}
if (-not $hay) { Write-Output "No responde $Url. Levantá el build con: cd frontend; npm run preview"; exit 1 }

# Perfil limpio: la biblioteca vive en IndexedDB
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like "*$(Split-Path -Leaf $perfil)*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 800
if (Test-Path $perfil) { Remove-Item $perfil -Recurse -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $Chrome -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required",
  "--remote-debugging-port=$PuertoDebug", "--user-data-dir=$perfil", $Url
) | Out-Null

$target = $null
foreach ($i in 1..40) {
  try {
    $lista = (Invoke-WebRequest "http://127.0.0.1:$PuertoDebug/json/list" -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
    for ($k = 0; $k -lt $lista.Count; $k++) { if ($lista[$k].type -eq "page") { $target = $lista[$k]; break } }
    if ($target) { break }
  } catch {}
  Start-Sleep -Milliseconds 500
}
if (-not $target) { Write-Output "No apareció la pestaña de Chrome"; exit 1 }

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ct = [System.Threading.CancellationToken]::None
$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, $ct).Wait()

function Enviar([string]$json) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
}
function Recibir() {
  $buffer = New-Object byte[] 262144
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $buffer)
  $ms = New-Object System.IO.MemoryStream
  do { $res = $ws.ReceiveAsync($seg, $ct).Result; $ms.Write($buffer, 0, $res.Count) } while (-not $res.EndOfMessage)
  return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
}
$guionId = 0
function E([string]$expr) {
  $guionId++
  Enviar (@{ id = $guionId; method = "Runtime.evaluate"; params = @{ expression = $expr; returnByValue = $true; awaitPromise = $true } } | ConvertTo-Json -Depth 10 -Compress)
  while ($true) {
    $msg = (Recibir) | ConvertFrom-Json
    if ($msg.id -eq $guionId) {
      if ($msg.result.exceptionDetails) { return "EXCEPCION: " + $msg.result.exceptionDetails.exception.description }
      return $msg.result.result.value
    }
  }
}
$fallas = 0
function OK($cond, $msg) { if ($cond) { Write-Output "OK    - $msg" } else { Write-Output "FALLA - $msg"; $script:fallas++ } }

# Utilidades dentro de la página, para no repetir selectores
$utilidades = @(
  "window.__t = {}",
  "window.__t.boton = (re) => [...document.querySelectorAll('button')].find(x => new RegExp(re).test((x.getAttribute('aria-label') || '') + ' ' + (x.getAttribute('title') || '') + ' ' + x.textContent))",
  "window.__t.clickTexto = (re) => { const b = window.__t.boton(re); if (!b) return false; b.click(); return true }",
  "window.__t.filas = () => document.querySelectorAll('.fila').length",
  "window.__t.titulos = () => [...document.querySelectorAll('.fila .titulo')].map(t => t.textContent.trim()).join(' | ')",
  "window.__t.buscar = (t) => { const i = document.querySelector('.buscador input'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, t); i.dispatchEvent(new Event('input', { bubbles: true })); return true }",
  "window.__t.hay3 = (re) => [...document.querySelectorAll('h3')].some(h => new RegExp(re).test(h.textContent))",
  "1"
)
E ($utilidades -join "; ") | Out-Null

Start-Sleep -Seconds 4

# 1) Importar los ejemplos
E "window.__t.clickTexto('ejemplo')" | Out-Null
Start-Sleep -Seconds 10
OK ((E "window.__t.filas()") -eq 3) "1. el botón de ejemplos importa 3 canciones"

# 2) Buscador sin tilde
E "window.__t.buscar('pflugen')" | Out-Null
Start-Sleep -Milliseconds 800
$n = E "window.__t.filas()"
$t = E "window.__t.titulos()"
OK (($n -eq 1) -and ($t -match "Wir pfl")) "2. el buscador ignora los tildes (busqué 'pflugen' y trajo '$t')"

# 3) Limpiar la búsqueda
E "window.__t.buscar('')" | Out-Null
Start-Sleep -Milliseconds 800
OK ((E "window.__t.filas()") -eq 3) "3. al borrar la búsqueda vuelven las 3"

# 4) Reproducir la primera
E "document.querySelector('.fila button.track').click()" | Out-Null
Start-Sleep -Seconds 4
$pausado = E "document.querySelector('audio').paused"
$dur = E "Math.round(document.querySelector('audio').duration)"
OK (($pausado -eq $false) -and ($dur -gt 0)) "4. al tocar una fila suena (pausado=$pausado, duración=${dur}s)"

# 5) Pausar con el botón central
E "window.__t.clickTexto('Reproducir o pausar')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "document.querySelector('audio').paused") -eq $true) "5. el botón central pausa"

# 6) Siguiente cambia de canción
$antes = E "document.querySelector('.now h2').textContent"
E "window.__t.clickTexto('Siguiente')" | Out-Null
Start-Sleep -Seconds 3
$despues = E "document.querySelector('.now h2').textContent"
OK ($antes -ne $despues) "6. Siguiente pasa a otra canción ('$antes' -> '$despues')"

# 7) Aleatorio
$antesAle = E "window.__t.boton('Aleatorio').className"
E "window.__t.boton('Aleatorio').click()" | Out-Null
Start-Sleep -Milliseconds 500
$despuesAle = E "window.__t.boton('Aleatorio').className"
OK (($antesAle -ne $despuesAle) -and ($antesAle -notmatch "activo")) "7. el aleatorio se prende ('$antesAle' -> '$despuesAle')"
E "window.__t.boton('Aleatorio').click()" | Out-Null
Start-Sleep -Milliseconds 400

# 8) Repetir cicla por los tres estados y vuelve
$rep0 = E "window.__t.boton('Repetir').getAttribute('aria-label')"
$reps = @($rep0)
foreach ($k in 1..3) {
  E "window.__t.boton('Repetir').click()" | Out-Null
  Start-Sleep -Milliseconds 400
  $reps += E "window.__t.boton('Repetir').getAttribute('aria-label')"
}
$unicos = @($reps | Select-Object -Unique)
OK ((@($unicos).Count -eq 3) -and ($reps[0] -eq $reps[3])) "8. Repetir cicla por 3 estados y vuelve ($($reps -join ' -> '))"

# 9) Cola: el botón de la fila abre un submenú de dos opciones
E "window.__t.clickTexto('Encolar')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "document.querySelectorAll('.modal').length") -eq 1) "9a. encolar abre el submenú de la cola"
E "window.__t.clickTexto('al final de la cola')" | Out-Null
Start-Sleep -Milliseconds 800
$cola = E "document.querySelector('.chip.cola')?.textContent ?? 'no hay chip'"
OK ($cola -match "Cola \(1\)") "9b. agregar al final muestra el chip '$cola'"

# 10) Favorita
E "window.__t.clickTexto('como favorita')" | Out-Null
Start-Sleep -Milliseconds 900
$fav = E "[...document.querySelectorAll('.chip')].find(c => /Favoritas/.test(c.textContent))?.textContent ?? ''"
OK ($fav -match "Favoritas \(1\)") "10. marcar favorita actualiza el chip '$fav'"

# 11) Diálogo de edición
E "window.__t.clickTexto('Editar los datos de')" | Out-Null
Start-Sleep -Milliseconds 700
$hayEdit = E "window.__t.hay3('Editar datos')"
$valorTitulo = E "document.querySelector('.campo-editar input')?.value ?? 'sin input'"
OK (($hayEdit -eq $true) -and ($valorTitulo -ne 'sin input')) "11. se abre Editar datos con el título cargado ('$valorTitulo')"
E "window.__t.clickTexto('Cerrar')" | Out-Null
Start-Sleep -Milliseconds 500

# 12) Diálogo de respaldo
E "window.__t.clickTexto('Guardar o restaurar')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "window.__t.hay3('Respaldo')") -eq $true) "12. se abre el diálogo Respaldo"
E "window.__t.clickTexto('Cerrar')" | Out-Null
Start-Sleep -Milliseconds 500

# 13) Quitar una canción (el botón de borrar dice "de Vitra"; el de favoritas, otra cosa)
E "window.__t.clickTexto('de Vitra')" | Out-Null
Start-Sleep -Seconds 1
OK ((E "window.__t.filas()") -eq 2) "13. quitar deja 2 canciones"

# 14) Recargar: la biblioteca persiste en IndexedDB
E "location.reload(); 1" | Out-Null
Start-Sleep -Seconds 6
$tras = E "document.querySelectorAll('.fila').length"
OK ($tras -eq 2) "14. después de recargar siguen las 2 (dijo $tras)"

Write-Output "---"
if ($fallas -eq 0) { Write-Output "TODO OK (15/15)" } else { Write-Output "$fallas FALLAS" }

$ws.Dispose()
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like "*$(Split-Path -Leaf $perfil)*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
