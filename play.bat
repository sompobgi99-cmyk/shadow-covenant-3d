@echo off
title Shadow Covenant 3D
cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════╗
echo ║   SHADOW COVENANT 3D            ║
echo ╚══════════════════════════════════╝
echo.

set PORT=9998
set URL=http://localhost:%PORT%

:: Try Python 3
where python3 >nul 2>&1
if %errorlevel%==0 (
    echo Python 3 found - starting server...
    start "" "%URL%"
    python3 -m http.server %PORT%
    goto end
)

:: Try Python
where python >nul 2>&1
if %errorlevel%==0 (
    echo Python found - starting server...
    start "" "%URL%"
    python -m http.server %PORT%
    goto end
)

:: Try Node.js
where node >nul 2>&1
if %errorlevel%==0 (
    echo Node.js found - starting server...
    start "" "%URL%"
    node -e "const h=require('http');const fs=require('fs');const p=require('path');h.createServer((r,s)=>{let f='.'+decodeURIComponent(r.url.split('?')[0]);if(f=='./')f='./index.html';try{const c=fs.readFileSync(f);const e=p.extname(f).toLowerCase().replace('.','');const t={'html':'text/html','js':'application/javascript','css':'text/css','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','json':'application/json','wasm':'application/wasm','mp3':'audio/mpeg','wav':'audio/wav','ogg':'audio/ogg'};s.writeHead(200,{'Content-Type':t[e]||'application/octet-stream'});s.end(c)}catch(e){s.writeHead(404);s.end('404 Not Found')}}).listen(%PORT%)"
    goto end
)

:: Use PowerShell built-in server
where powershell >nul 2>&1
if %errorlevel%==0 (
    echo Python/Node.js not found.
    echo Using Windows PowerShell server instead...
    start "" "%URL%"

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$port=%PORT%; $root=(Get-Location).Path; " ^
    "$listener=New-Object System.Net.HttpListener; " ^
    "$listener.Prefixes.Add('http://localhost:'+$port+'/'); " ^
    "$listener.Start(); " ^
    "Write-Host 'Server running at http://localhost:'$port; " ^
    "Write-Host 'Root:' $root; " ^
    "Write-Host 'Press Ctrl+C to stop'; " ^
    "while($listener.IsListening){ " ^
    "$context=$listener.GetContext(); " ^
    "$request=$context.Request; " ^
    "$response=$context.Response; " ^
    "$url=[System.Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/')); " ^
    "if([string]::IsNullOrWhiteSpace($url)){ $url='index.html' } " ^
    "$file=Join-Path $root $url; " ^
    "if((Test-Path $file) -and -not (Get-Item $file).PSIsContainer){ " ^
    "$bytes=[System.IO.File]::ReadAllBytes($file); " ^
    "$ext=[System.IO.Path]::GetExtension($file).ToLower(); " ^
    "$mime='application/octet-stream'; " ^
    "switch($ext){ " ^
    "'.html' {$mime='text/html'} " ^
    "'.htm' {$mime='text/html'} " ^
    "'.js' {$mime='application/javascript'} " ^
    "'.css' {$mime='text/css'} " ^
    "'.json' {$mime='application/json'} " ^
    "'.png' {$mime='image/png'} " ^
    "'.jpg' {$mime='image/jpeg'} " ^
    "'.jpeg' {$mime='image/jpeg'} " ^
    "'.webp' {$mime='image/webp'} " ^
    "'.wasm' {$mime='application/wasm'} " ^
    "'.mp3' {$mime='audio/mpeg'} " ^
    "'.wav' {$mime='audio/wav'} " ^
    "'.ogg' {$mime='audio/ogg'} " ^
    "} " ^
    "$response.ContentType=$mime; " ^
    "$response.ContentLength64=$bytes.Length; " ^
    "$response.OutputStream.Write($bytes,0,$bytes.Length); " ^
    "} else { " ^
    "$msg=[Text.Encoding]::UTF8.GetBytes('404 Not Found'); " ^
    "$response.StatusCode=404; " ^
    "$response.OutputStream.Write($msg,0,$msg.Length); " ^
    "} " ^
    "$response.OutputStream.Close(); " ^
    "}"
    goto end
)

echo.
echo No Python, Node.js, or PowerShell found.
echo Cannot start local server.
echo.

:end
pause