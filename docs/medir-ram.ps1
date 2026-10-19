# Mide la RAM de Vitra con Chrome headless y el DevTools Protocol.
#
# Da dos números:
#   - heap de JavaScript de la app (lo que ocupa realmente Vitra)
#   - memoria del navegador entero, para comparar contra una pestaña vacía
#
# Antes hay que servir el build:  cd frontend; npm run build; npm run preview
# Después:                        powershell -ExecutionPolicy Bypass -File docs/medir-ram.ps1

param(
  [string]$Url = "http://localhost:4173/",
  [int]$PuertoDebug = 9223,
  [string]$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$ErrorActionPreference = "Stop"
$perfil = Join-Path $env:TEMP "vitra-medicion"

if (-not (Test-Path $Chrome)) { Write-Output "No encontré Chrome en $Chrome"; exit 1 }

# ¿Está sirviendo el build?
try { Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 5 | Out-Null }
catch { Write-Output "No responde $Url. Levantá el build con: cd frontend; npm run preview"; exit 1 }

# Arrancar de perfil limpio: la biblioteca vive en IndexedDB
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like "*$(Split-Path -Leaf $perfil)*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 800
if (Test-Path $perfil) { Remove-Item $perfil -Recurse -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $Chrome -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--enable-precise-memory-info", "--remote-debugging-port=$PuertoDebug",
  "--user-data-dir=$perfil", "about:blank"
) | Out-Null

# Pestaña para hablar por WebSocket
$target = $null
foreach ($i in 1..40) {
  try {
    $lista = (Invoke-WebRequest "http://127.0.0.1:$PuertoDebug/json/list" -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
    for ($k = 0; $k -lt $lista.Count; $k++) {
      if ($lista[$k].type -eq "page") { $target = $lista[$k]; break }
    }
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
function Llamar([string]$metodo, $params) {
  $guionId++
  Enviar (@{ id = $guionId; method = $metodo; params = $params } | ConvertTo-Json -Depth 10 -Compress)
  while ($true) {
    $msg = (Recibir) | ConvertFrom-Json
    if ($msg.id -eq $guionId) { return $msg.result }
  }
}
function Evaluar([string]$expr) { (Llamar "Runtime.evaluate" @{ expression = $expr; returnByValue = $true; awaitPromise = $true }).result.value }
function MemoriaNavegador() {
  $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*$(Split-Path -Leaf $perfil)*" }
  $suma = 0
  foreach ($p in $procs) {
    $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
    if ($proc) { $suma += $proc.WorkingSet64 }
  }
  return [math]::Round($suma / 1MB, 1)
}
function Heap() { [math]::Round((Evaluar "performance.memory.usedJSHeapSize") / 1MB, 1) }

# 1) Pestaña vacía (referencia)
Start-Sleep -Seconds 2
$navegadorVacio = MemoriaNavegador
$heapVacio = Heap

# 2) Vitra cargada, sin canciones
Llamar "Page.navigate" @{ url = $Url } | Out-Null
Start-Sleep -Seconds 5
$navegadorApp = MemoriaNavegador
$heapApp = Heap

# 3) Con la canción de ejemplo importada
Evaluar "(() => { const b = [...document.querySelectorAll('button')].find(x => /ejemplo/i.test(x.textContent)); if (b) { b.click(); return 1; } return 0; })()" | Out-Null
Start-Sleep -Seconds 6
$navegadorDemo = MemoriaNavegador
$heapDemo = Heap
$estado = Evaluar "document.querySelector('.pie')?.textContent ?? ''"

Write-Output "=== RAM de Vitra (Chrome headless, perfil limpio) ==="
Write-Output ("Pestaña vacía:      navegador {0} MB | heap de JS {1} MB" -f $navegadorVacio, $heapVacio)
Write-Output ("Vitra cargada:      navegador {0} MB | heap de JS {1} MB" -f $navegadorApp, $heapApp)
Write-Output ("Con una canción:    navegador {0} MB | heap de JS {1} MB  ({2})" -f $navegadorDemo, $heapDemo, $estado)
Write-Output "---"
Write-Output ("Vitra suma {0} MB de heap. El resto de la memoria es del navegador (cada pestaña arranca su renderer)." -f [math]::Round($heapApp - $heapVacio, 1))

$ws.Dispose()
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like "*$(Split-Path -Leaf $perfil)*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
