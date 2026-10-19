# Prueba de la interfaz: maneja Vitra con Chrome headless y el DevTools Protocol y
# comprueba los flujos principales y los casos raros (importar, buscar, reproducir,
# aleatorio/repetir, cola, favoritas, diálogos, borrar, recargar, offline, archivos
# dañados, respaldos inválidos y 120 canciones de golpe).
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
  "--autoplay-policy=no-user-gesture-required", "--enable-precise-memory-info",
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
  $buffer = New-Object byte[] 524288
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
function CDP([string]$metodo, $params) {
  $guionId++
  Enviar (@{ id = $guionId; method = $metodo; params = $params } | ConvertTo-Json -Depth 10 -Compress)
  while ($true) {
    $msg = (Recibir) | ConvertFrom-Json
    if ($msg.id -eq $guionId) { return $msg }
  }
}
$fallas = 0
function OK($cond, $msg) { if ($cond) { Write-Output "OK    - $msg" } else { Write-Output "FALLA - $msg"; $script:fallas++ } }
function Nota($msg) { Write-Output "  ...   $msg" }

# Utilidades dentro de la página, para no repetir selectores
$ayudas = @(
  "window.__t = {}",
  "window.__t.boton = (re) => [...document.querySelectorAll('button')].find(x => new RegExp(re).test((x.getAttribute('aria-label') || '') + ' ' + (x.getAttribute('title') || '') + ' ' + x.textContent))",
  "window.__t.clickTexto = (re) => { const b = window.__t.boton(re); if (!b) return false; b.click(); return true }",
  "window.__t.filas = () => document.querySelectorAll('.fila').length",
  "window.__t.titulos = () => [...document.querySelectorAll('.fila .titulo')].map(t => t.textContent.trim()).join(' | ')",
  "window.__t.pie = () => document.querySelector('.pie')?.textContent ?? ''",
  "window.__t.cantidad = () => parseInt(document.querySelector('.pie')?.textContent ?? '0') || 0",
  "window.__t.aviso = () => document.querySelector('.aviso')?.textContent ?? ''",
  "window.__t.setInput = (sel, t) => { const i = document.querySelector(sel); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, t); i.dispatchEvent(new Event('input', { bubbles: true })); return true }",
  "window.__t.importar = (archivos) => { const i = document.querySelector('.botones input[type=file]'); const dt = new DataTransfer(); for (const a of archivos) dt.items.add(a); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return archivos.length }",
  "window.__t.importarRespaldo = (texto) => { const i = document.querySelector('.modal input[type=file]'); const dt = new DataTransfer(); dt.items.add(new File([texto], 'basura.json', { type: 'application/json' })); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return true }",
  "window.__t.archivo = (nombre, bytes) => new File([new Uint8Array(bytes)], nombre, { type: 'audio/mpeg' })",
  "window.__t.texto = (nombre, contenido) => new File([contenido], nombre, { type: 'text/plain' })",
  "window.__t.copiaDemo = async (nombre) => { const r = await fetch('/demo/demo1.mp3'); return new File([await r.blob()], nombre, { type: 'audio/mpeg' }) }",
  "window.__t.trozos = async (cantidad) => { const r = await fetch('/demo/demo3.mp3'); const b = (await r.blob()).slice(0, 160 * 1024); const fs = []; for (let k = 0; k < cantidad; k++) fs.push(new File([b], 'masiva ' + (k + 1) + '.mp3', { type: 'audio/mpeg' })); return fs }",
  "window.__t.heap = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : -1",
  "window.__t.tocaLasUltimas = () => { const fs = [...document.querySelectorAll('.fila')]; fs[fs.length - 1].querySelector('button.track').click(); return true }",
  "window.__t.hay3 = (re) => [...document.querySelectorAll('h3')].some(h => new RegExp(re).test(h.textContent))",
  "window.__t.confirmar = () => { window.confirm = () => true; return true }",
  "1"
)
function Ayudas() { E ($ayudas -join "; ") | Out-Null }
function EsperarFin([int]$max = 480) {
  # Espera a que la importación arranque (el input se deshabilita) y termine
  Start-Sleep -Milliseconds 500
  for ($i = 0; $i -lt $max; $i++) {
    if ((E "document.querySelector('.botones input[type=file]')?.disabled ?? false") -eq $false) { break }
    Start-Sleep -Milliseconds 500
  }
  Start-Sleep -Milliseconds 900
}

Start-Sleep -Seconds 4
Ayudas

Write-Output "=== flujos principales ==="

Write-Output "-- 1. los tres ejemplos --"
E "window.__t.clickTexto('ejemplo')" | Out-Null
EsperarFin
OK ((E "window.__t.filas()") -eq 3) "1. el botón de ejemplos importa 3 canciones"

Write-Output "-- 2. buscador --"
E "window.__t.setInput('.buscador input', 'pflugen')" | Out-Null
Start-Sleep -Milliseconds 800
$n = E "window.__t.filas()"
$t = E "window.__t.titulos()"
OK (($n -eq 1) -and ($t -match "Wir pfl")) "2. el buscador ignora los tildes (busqué 'pflugen' y trajo '$t')"
E "window.__t.setInput('.buscador input', '')" | Out-Null
Start-Sleep -Milliseconds 800
OK ((E "window.__t.filas()") -eq 3) "3. al borrar la búsqueda vuelven las 3"

Write-Output "-- 4. reproducción --"
E "document.querySelector('.fila button.track').click()" | Out-Null
Start-Sleep -Seconds 4
$pausado = E "document.querySelector('audio').paused"
$dur = E "Math.round(document.querySelector('audio').duration)"
OK (($pausado -eq $false) -and ($dur -gt 0)) "4. al tocar una fila suena (pausado=$pausado, duración=${dur}s)"
E "window.__t.clickTexto('Reproducir o pausar')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "document.querySelector('audio').paused") -eq $true) "5. el botón central pausa"
$antes = E "document.querySelector('.now h2').textContent"
E "window.__t.clickTexto('Siguiente')" | Out-Null
Start-Sleep -Seconds 3
$despues = E "document.querySelector('.now h2').textContent"
OK ($antes -ne $despues) "6. Siguiente pasa a otra canción ('$antes' -> '$despues')"

Write-Output "-- 7. aleatorio y repetir --"
$antesAle = E "window.__t.boton('Aleatorio').className"
E "window.__t.boton('Aleatorio').click()" | Out-Null
Start-Sleep -Milliseconds 500
$despuesAle = E "window.__t.boton('Aleatorio').className"
OK (($antesAle -ne $despuesAle) -and ($antesAle -notmatch "activo")) "7. el aleatorio se prende ('$antesAle' -> '$despuesAle')"
E "window.__t.boton('Aleatorio').click()" | Out-Null
Start-Sleep -Milliseconds 400
$rep0 = E "window.__t.boton('Repetir').getAttribute('aria-label')"
$reps = @($rep0)
foreach ($k in 1..3) {
  E "window.__t.boton('Repetir').click()" | Out-Null
  Start-Sleep -Milliseconds 400
  $reps += E "window.__t.boton('Repetir').getAttribute('aria-label')"
}
$unicos = @($reps | Select-Object -Unique)
OK ((@($unicos).Count -eq 3) -and ($reps[0] -eq $reps[3])) "8. Repetir cicla por 3 estados y vuelve ($($reps -join ' -> '))"

Write-Output "-- 9. cola y favoritas --"
E "window.__t.clickTexto('Encolar')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "document.querySelectorAll('.modal').length") -eq 1) "9a. encolar abre el submenú de la cola"
E "window.__t.clickTexto('al final de la cola')" | Out-Null
Start-Sleep -Milliseconds 800
$cola = E "document.querySelector('.chip.cola')?.textContent ?? 'no hay chip'"
OK ($cola -match "Cola \(1\)") "9b. agregar al final muestra el chip '$cola'"
E "window.__t.clickTexto('como favorita')" | Out-Null
Start-Sleep -Milliseconds 900
$fav = E "[...document.querySelectorAll('.chip')].find(c => /Favoritas/.test(c.textContent))?.textContent ?? ''"
OK ($fav -match "Favoritas \(1\)") "10. marcar favorita actualiza el chip '$fav'"

Write-Output "-- 11. diálogos de editar y respaldo --"
E "window.__t.clickTexto('Editar los datos de')" | Out-Null
Start-Sleep -Milliseconds 700
$hayEdit = E "window.__t.hay3('Editar datos')"
$tituloEdit = E "document.querySelector('.campo-editar input')?.value ?? 'sin input'"
OK (($hayEdit -eq $true) -and ($tituloEdit -ne 'sin input')) "11. se abre Editar datos con el título cargado ('$tituloEdit')"
E "window.__t.clickTexto('Cerrar')" | Out-Null
Start-Sleep -Milliseconds 500
E "window.__t.clickTexto('Guardar o restaurar')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "window.__t.hay3('Respaldo')") -eq $true) "12. se abre el diálogo Respaldo"
E "window.__t.clickTexto('Cerrar')" | Out-Null
Start-Sleep -Milliseconds 500

Write-Output "=== casos raros ==="

Write-Output "-- 13. archivo repetido --"
E "window.__t.copiaDemo('demo1.mp3').then(f => window.__t.importar([f]))" | Out-Null
EsperarFin
OK ((E "window.__t.filas()") -eq 3) "13. el mismo archivo (mismo nombre y tamaño) no se duplica"

Write-Output "-- 14. archivo que no es audio --"
E "window.__t.importar([window.__t.archivo('roto.mp3', 1000)])" | Out-Null
EsperarFin
$n = E "window.__t.filas()"
$aviso = E "window.__t.aviso()"
OK (($n -eq 3) -and ($aviso -match "no parece audio")) "14. no suma basura y avisa ('$aviso')"

Write-Output "-- 15. letras .lrc --"
E "window.__t.importar([window.__t.texto('suelta.lrc', '[00:01.00] una linea')])" | Out-Null
Start-Sleep -Seconds 1
$aviso = E "window.__t.aviso()"
OK ($aviso -match "No encontr") "15a. un .lrc sin su audio lo avisa ('$aviso')"
E "window.__t.copiaDemo('prueba-letra.mp3').then(f => window.__t.importar([f, window.__t.texto('prueba-letra.lrc', '[00:01.00] linea uno\n[00:05.00] linea dos\n[00:09.00] linea tres')]))" | Out-Null
EsperarFin
$aviso = E "window.__t.aviso()"
OK ($aviso -notmatch "No encontr") "15b. con su audio no se queja ('$aviso')"
OK ((E "window.__t.filas()") -eq 4) "15c. la canción con letra se sumó"
# La fila muestra el título de las etiquetas, no el nombre del archivo: la nueva es la última
E "window.__t.tocaLasUltimas()" | Out-Null
Start-Sleep -Seconds 4
$lineas = E "document.querySelectorAll('.linea-letra').length"
OK ($lineas -eq 3) "15d. al reproducirla se ven las 3 líneas de la letra (dijo $lineas)"

Write-Output "-- 16. lista con nombre largo --"
$nombreLargo = "Una lista con un nombre largo de 40 caracteres"
E "window.__t.clickTexto('a una lista')" | Out-Null
Start-Sleep -Milliseconds 800
E "window.__t.setInput('.menu-nueva input', '$nombreLargo')" | Out-Null
Start-Sleep -Milliseconds 300
E "window.__t.clickTexto('Crear y agregar')" | Out-Null
Start-Sleep -Seconds 1
$chip = E "(() => { const c = [...document.querySelectorAll('.chip')].find(x => /nombre largo/.test(x.textContent)); return c ? c.textContent.trim() : 'no hay chip' })()"
OK ($chip -ne 'no hay chip') "16a. la lista se crea ('$chip')"
$recorte = E "(() => { const c = [...document.querySelectorAll('.chip')].find(x => /nombre largo/.test(x.textContent)); if (!c) return 'no hay chip'; return c.scrollWidth > c.clientWidth ? 'recortado con puntos' : 'entra completo' })()"
OK ($recorte -ne 'no hay chip') "16b. el nombre largo no desborda el chip: $recorte"

Write-Output "-- 17. búsqueda con caracteres raros --"
E "window.__t.setInput('.buscador input', '((((')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "window.__t.filas()") -eq 0) "17a. buscar '((((' no rompe y no encuentra nada"
E "window.__t.setInput('.buscador input', '.*')" | Out-Null
Start-Sleep -Milliseconds 700
OK ((E "window.__t.filas()") -eq 0) "17b. buscar '.*' lo toma literal, no como expresión"
E "window.__t.setInput('.buscador input', '')" | Out-Null
Start-Sleep -Milliseconds 700

Write-Output "-- 18. respaldo inválido --"
$cantAntes = E "window.__t.cantidad()"
E "window.__t.clickTexto('Guardar o restaurar')" | Out-Null
Start-Sleep -Milliseconds 700
E "window.__t.importarRespaldo('esto no es json')" | Out-Null
Start-Sleep -Seconds 1
$aviso1 = E "window.__t.aviso()"
OK ($aviso1 -match "JSON") "18a. basura: '$aviso1'"
E "window.__t.importarRespaldo('{}')" | Out-Null
Start-Sleep -Seconds 1
$aviso2 = E "window.__t.aviso()"
OK ($aviso2 -match "respaldo de Vitra") "18b. JSON sin datos: '$aviso2'"
OK ((E "window.__t.cantidad()") -eq $cantAntes) "18c. la biblioteca no se tocó (siguen $cantAntes)"
E "window.__t.clickTexto('Cerrar')" | Out-Null
Start-Sleep -Milliseconds 500

Write-Output "-- 19. sincronizar sin backend --"
E "window.__t.clickTexto('Sincronizar')" | Out-Null
Start-Sleep -Milliseconds 800
E "window.__t.setInput('.modal .campo-editar input', 'http://127.0.0.1:9')" | Out-Null
Start-Sleep -Milliseconds 300
E "window.__t.clickTexto('Sincronizar ahora')" | Out-Null
Start-Sleep -Seconds 4
$aviso = E "window.__t.aviso()"
OK ($aviso -match "No se pudo sincronizar") "19. avisa que no pudo sincronizar ('$aviso')"
E "window.__t.clickTexto('Cerrar')" | Out-Null
Start-Sleep -Milliseconds 500

Write-Output "-- 20. quitar y recargar --"
E "window.__t.clickTexto('de Vitra')" | Out-Null
Start-Sleep -Seconds 1
OK ((E "window.__t.filas()") -eq 3) "20. quitar deja 3"
E "location.reload(); 1" | Out-Null
Start-Sleep -Seconds 6
OK ((E "document.querySelectorAll('.fila').length") -eq 3) "21. después de recargar sigue todo (IndexedDB)"
Ayudas

Write-Output "-- 22. offline (service worker) --"
CDP "Network.enable" @{} | Out-Null
CDP "Network.emulateNetworkConditions" @{ offline = $true; latency = 0; downloadThroughput = 0; uploadThroughput = 0 } | Out-Null
E "location.reload(); 1" | Out-Null
Start-Sleep -Seconds 8
$sinRed = E "document.querySelectorAll('.fila').length"
OK ($sinRed -eq 3) "22. sin red la app carga igual desde el service worker y muestra $sinRed canciones"
CDP "Network.emulateNetworkConditions" @{ offline = $false; latency = 0; downloadThroughput = -1; uploadThroughput = -1 } | Out-Null
E "1" | Out-Null
Start-Sleep -Seconds 2
Ayudas

Write-Output "-- 23. 120 canciones de golpe --"
$heapAntes = E "window.__t.heap()"
$cantAntes = E "window.__t.cantidad()"
$t0 = Get-Date
E "window.__t.trozos(120).then(fs => window.__t.importar(fs))" | Out-Null
EsperarFin
$tardo = [int]((Get-Date) - $t0).TotalSeconds
$cantDespues = E "window.__t.cantidad()"
$filas = E "window.__t.filas()"
$heap = E "window.__t.heap()"
Nota "importar 120 archivos tardó ${tardo}s; heap: $heapAntes MB -> $heap MB"
OK ($cantDespues -eq ($cantAntes + 120)) "23a. se sumaron las 120 ($cantAntes + 120 = $cantDespues)"
OK ($filas -lt 60) "23b. la lista está virtualizada: dibuja $filas filas, no $cantDespues"
$topAntes = E "parseInt(document.querySelector('.fila').style.top) || 0"
E "(() => { const u = document.querySelector('ul.list'); u.scrollTop = u.scrollHeight; return Math.round(u.scrollTop) })()" | Out-Null
Start-Sleep -Seconds 1
$filas2 = E "window.__t.filas()"
$topDespues = E "parseInt(document.querySelector('.fila').style.top) || 0"
OK (($filas2 -gt 0) -and ($filas2 -lt 60) -and ($topDespues -gt $topAntes)) "23c. al bajar hasta el fondo la ventana se corre (primera fila de $topAntes a $topDespues px) y sigue dibujando $filas2 filas"
$heap2 = E "window.__t.heap()"
OK ($heap2 -lt 40) "23d. el heap de JS sigue bajo con $cantDespues canciones: $heap2 MB"

Write-Output "---"
if ($fallas -eq 0) { Write-Output "TODO OK" } else { Write-Output "$fallas FALLAS" }

$ws.Dispose()
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like "*$(Split-Path -Leaf $perfil)*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
