# Обход DPI с самоподбором: берёт движок zapret (winws.exe + WinDivert) и перебирает стратегии,
# оставляя ту, при которой работают И YouTube, И шлюз Discord.
# Запускается из любой папки на любой машине: если движка нет -- скачает сам (в zapret-work рядом с собой).
#
# Примеры:
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -Check          # ничего не трогать, только сказать что сейчас
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -VoiceOnly      # спросить бота: поднимается ли голосовой канал (без прав; бот должен быть выключен)
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -SkipVoice      # подбор без проверки голоса (быстрее)
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -List           # показать пресеты, которые будет пробовать
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -EngineOnly     # только принести движок (без прав)
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1                 # подобрать и запустить лучшее (нужен админ)
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -TestOnly       # подобрать, но ничего не оставлять
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -Only "ALT"     # только пресеты, в имени которых есть ALT
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -Stop           # остановить обход
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -Restore        # вернуть службу zapret, как было
#
# Хранитель (главное): держит оба пути рабочими без твоего участия.
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -Keeper         # следить: каждые 5 мин проверять ютуб+дискорд, при поломке переподобрать
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -Keeper -Every 2 # то же, проверка каждые 2 минуты
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -Autostart       # поставить хранителя в планировщик (сам поднимется при входе)
#   powershell -ExecutionPolicy Bypass -File zapret-pick.ps1 -AutostartOff    # снять с планировщика
#
# Права администратора нужны только самому обходу (драйвер WinDivert). -Check, -List и -EngineOnly -- без прав.

param(
    [string]$ZapretDir = '',
    [int]$Seconds = 6,
    [switch]$TestOnly,
    [switch]$Stop,
    [switch]$Restore,
    [switch]$List,
    [switch]$Check,
    [switch]$VoiceOnly,
    [switch]$SkipVoice,
    [switch]$EngineOnly,
    [switch]$FetchEngine,
    [switch]$Menu,
    [switch]$Keeper,
    [switch]$Autostart,
    [switch]$AutostartOff,
    [int]$Every = 5,
    [string]$Only = ''
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Here) { $Here = (Get-Location).Path }
$proj = Split-Path $Here -Parent
$Work = Join-Path $Here 'zapret-work'
$ZapretRoot = Join-Path $Work 'zapret'
if (-not (Test-Path $Work)) { New-Item -ItemType Directory -Path $Work -Force | Out-Null }
$LogPath = Join-Path $Work 'zapret-pick.log'
$ChosenBat = Join-Path $Work 'zapret-chosen.bat'
$Repo = 'Flowseal/zapret-discord-youtube'
$FallbackTag = '1.10.3'

function W($m)
{
    $line = '[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $m
    Write-Host $line
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
}

function IsAdmin
{
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object -TypeName 'Security.Principal.WindowsPrincipal' -ArgumentList $id
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-EngineDir($p)
{
    if (-not $p) { return $false }
    return (Test-Path (Join-Path $p 'bin\winws.exe'))
}

# ---------- движок: принести самому, если его нет ----------
function Fetch-Engine([bool]$Force)
{
    if ($Force -and (Test-Path $ZapretRoot)) { Remove-Item -Path $ZapretRoot -Recurse -Force -ErrorAction SilentlyContinue }
    $found = Get-ChildItem -Path $ZapretRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-EngineDir $_.FullName } | Select-Object -First 1
    if ($found) { return $found.FullName }

    $tag = $FallbackTag
    try
    {
        $rel = Invoke-RestMethod -Uri ('https://api.github.com/repos/' + $Repo + '/releases/latest') -Headers @{ 'User-Agent' = 'zapret-pick' } -TimeoutSec 20 -ErrorAction Stop
        if ($rel.tag_name) { $tag = [string]$rel.tag_name }
    }
    catch { W ('не спросил последний выпуск (' + $_.Exception.Message + '), беру ' + $tag) }

    $zip = Join-Path $Work 'zapret.zip'
    # список собираю по одной строке: запись вида @('a' + $x, 'b') в PowerShell склеивает всё в ОДИН элемент
    $urls = @()
    $urls += 'https://github.com/' + $Repo + '/archive/refs/tags/' + $tag + '.zip'
    $urls += 'https://github.com/' + $Repo + '/archive/refs/heads/main.zip'
    $urls += 'https://github.com/' + $Repo + '/archive/refs/heads/master.zip'
    foreach ($url in $urls)
    {
        try
        {
            W ('качаю движок: ' + $url)
            Invoke-WebRequest -Uri $url -OutFile $zip -TimeoutSec 180 -UseBasicParsing -ErrorAction Stop
            if ((Get-Item $zip).Length -lt 100000) { throw 'архив подозрительно мал' }
            if (Test-Path $ZapretRoot) { Remove-Item -Path $ZapretRoot -Recurse -Force -ErrorAction SilentlyContinue }
            New-Item -ItemType Directory -Path $ZapretRoot -Force | Out-Null
            Expand-Archive -Path $zip -DestinationPath $ZapretRoot -Force -ErrorAction Stop
            $found = Get-ChildItem -Path $ZapretRoot -Directory -ErrorAction SilentlyContinue |
                Where-Object { Test-EngineDir $_.FullName } | Select-Object -First 1
            if ($found) { W ('движок на месте: ' + $found.FullName); return $found.FullName }
            W 'в архиве нет bin\winws.exe -- беру другой источник'
        }
        catch { W ('не вышло (' + $_.Exception.Message + ')') }
    }
    return ''
}

# ---------- где лежит zapret ----------
function Find-ZapretDir
{
    if ($ZapretDir -and (Test-EngineDir $ZapretDir)) { return (Resolve-Path $ZapretDir).Path }
    if (Test-EngineDir $ZapretRoot) { return $ZapretRoot }
    $found = Get-ChildItem -Path $ZapretRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-EngineDir $_.FullName } | Select-Object -First 1
    if ($found) { return $found.FullName }

    $tries = @(
        (Join-Path $Here 'zapret'),
        (Join-Path $Here '..\zapret'),
        'C:\zapret'
    )
    foreach ($t in $tries) { if (Test-EngineDir $t) { return (Resolve-Path $t).Path } }

    foreach ($root in @((Join-Path $env:USERPROFILE 'Desktop'), (Join-Path $env:USERPROFILE 'Downloads'), 'C:\'))
    {
        if (-not (Test-Path $root)) { continue }
        $hit = Get-ChildItem -Path $root -Directory -Filter 'zapret*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit -and (Test-EngineDir $hit.FullName)) { return $hit.FullName }
    }
    return ''
}

# ---------- проверки ----------
function Test-Youtube
{
    foreach ($u in @('https://www.youtube.com/robots.txt', 'https://www.youtube.com/'))
    {
        try
        {
            $r = Invoke-WebRequest -Uri $u -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { return $true }
        }
        catch { }
    }
    return $false
}

function Test-DiscordGateway
{
    # именно шлюз: рукопожатие WebSocket, как у самого бота
    try
    {
        $ws = New-Object System.Net.WebSockets.ClientWebSocket
        $cts = New-Object System.Threading.CancellationTokenSource
        $cts.CancelAfter(8000)
        $task = $ws.ConnectAsync([Uri]'wss://gateway.discord.gg/?v=10&encoding=json', $cts.Token)
        $task.Wait(9000) | Out-Null
        $ok = ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open)
        try { $ws.Dispose() } catch { }
        return $ok
    }
    catch { return $false }
}

function Find-Node($proj)
{
    $d = Get-ChildItem -Path $proj -Directory -Filter 'node-v*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($d)
    {
        $x = Join-Path $d.FullName 'node.exe'
        if (Test-Path $x) { return $x }
    }
    $cmd = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return ''
}

function Test-DiscordVoice($proj)
{
    $node = Find-Node $proj
    if (-not $node) { return @{ ok = $false; skip = $true; why = 'не нашёл node.exe, не могу спросить бота' } }
    $out = Join-Path $Work 'voice-out.txt'
    $err = $out + '.err'
    Remove-Item $out, $err -ErrorAction SilentlyContinue
    try
    {
        $proc = Start-Process -FilePath $node -ArgumentList '.', 'voice' -WorkingDirectory $proj -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
        $proc | Wait-Process -Timeout 90 -ErrorAction SilentlyContinue
        if (-not $proc.HasExited) { try { $proc | Stop-Process -Force } catch { } }
    }
    catch { return @{ ok = $false; skip = $false; why = $_.Exception.Message } }
    $lines = @()
    foreach ($f in @($out, $err))
    {
        if (Test-Path $f)
        {
            $lines += @(Get-Content -Path $f -Encoding UTF8 -ErrorAction SilentlyContinue | Where-Object { $_ -match '\[voice\]' })
        }
    }
    $text = ($lines -join ' | ')
    if ($text -match 'бот уже запущен') { return @{ ok = $false; skip = $true; why = 'бот сейчас запущен -- голос проверю, когда он выключен' } }
    if ($text -match 'голос работает') { return @{ ok = $true; skip = $false; why = '' } }
    $why = ''
    if ($text -match '\[voice\] ([^|]*)$') { $why = $Matches[1].Trim() }
    if ($why.Length -gt 120) { $why = $why.Substring(0, 120) }
    return @{ ok = $false; skip = $false; why = $why }
}

function Test-DiscordApi
{
    try
    {
        $r = Invoke-WebRequest -Uri 'https://discord.com/api/v10/gateway' -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
        return ($r.StatusCode -eq 200)
    }
    catch { return $false }
}

# ---------- пресеты из папки zapret ----------
function Get-Strategies($dir)
{
    $bin = (Join-Path $dir 'bin') + '\'
    $lists = (Join-Path $dir 'lists') + '\'
    $out = @()
    foreach ($f in (Get-ChildItem -Path $dir -Filter 'general*.bat' -File -ErrorAction SilentlyContinue))
    {
        if ($Only -and ($f.Name -notlike ('*' + $Only + '*'))) { continue }
        $lines = @(Get-Content -Path $f.FullName -ErrorAction SilentlyContinue)
        $joined = ''
        $started = $false
        foreach ($raw in $lines)
        {
            $t = $raw.Trim()
            if (-not $started)
            {
                if ($t -match '(?i)^start\s+"zapret') { $started = $true; $t = ($t -replace '(?i)^start\s+"[^"]*"\s*', ''); $t = ($t -replace '(?i)^/min\s*', '') }
                else { continue }
            }
            $more = $t.EndsWith('^')
            $t = $t.TrimEnd('^').Trim()
            $joined += ' ' + $t
            if (-not $more) { break }
        }
        if ($joined -notmatch '(?i)winws\.exe') { continue }
        $wargs = ($joined -replace '(?is)^.*?winws\.exe', '').Trim()
        $wargs = $wargs -replace '%BIN%', $bin
        $wargs = $wargs -replace '%LISTS%', $lists
        $wargs = $wargs -replace '%GameFilterTCP%', ''
        $wargs = $wargs -replace '%GameFilterUDP%', ''
        $wargs = $wargs -replace '%GameFilter%', ''
        if ($wargs -match '%') { continue }   # остались нераскрытые переменные -- пресет пропускаю
        $out += [pscustomobject]@{ Name = $f.BaseName; Args = $wargs }
    }
    return $out
}

# ---------- управление движком ----------
function Stop-Bypass
{
    foreach ($svc in @('zapret', 'winws', 'zapret-service'))
    {
        $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($s -and $s.Status -ne 'Stopped') { Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue; W ('служба ' + $svc + ' остановлена') }
    }
    Get-Process -Name 'winws' -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.Id -Force; W ('остановлен winws.exe pid ' + $_.Id) } catch { } }
    Start-Sleep -Milliseconds 800
}

function Start-Winws($winws, $wargs)
{
    return Start-Process -FilePath $winws -ArgumentList $wargs -WorkingDirectory (Split-Path $winws -Parent) -WindowStyle Hidden -PassThru
}

function ServiceState($name)
{
    $s = Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($s) { return $s.Status.ToString() }
    return 'нет'
}

# ---------- сторож: вернуть как было, даже если прогон прервут ----------
function Arm-Watchdog($wasRunning, $seconds)
{
    $w = Join-Path $Work 'zapret-watchdog.ps1'
    $body = @'
param([int]$Delay, [string]$Service, [bool]$WasRunning)
Start-Sleep -Seconds $Delay
$s = Get-Service -Name $Service -ErrorAction SilentlyContinue
if ($WasRunning -and $s -and $s.Status -ne 'Running') { try { Start-Service -Name $Service } catch { } }
'@
    Set-Content -Path $w -Value $body -Encoding ASCII
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $w, '-Delay', $seconds, '-Service', 'zapret', '-WasRunning', ([bool]$wasRunning).ToString() | Out-Null
    W ('сторож поставлен: через ' + $seconds + ' с вернёт службу zapret в прежнее состояние')
}

function Restore-Service($wasRunning)
{
    if ($wasRunning)
    {
        try { Start-Service -Name 'zapret' -ErrorAction Stop; W 'служба zapret поднята обратно (как было)' }
        catch { W ('не смог поднять службу zapret: ' + $_.Exception.Message) }
    }
}

# ---------- меню (для запуска двойным кликом через obhod.cmd) ----------
function Run-Pick($extraArgs, [bool]$elevate, [bool]$wait)
{
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath) + $extraArgs
    if ($elevate -and -not (IsAdmin))
    {
        W ('прошу права для: ' + ($extraArgs -join ' '))
        if ($wait) { Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $a -Wait }
        else { Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $a | Out-Null }
    }
    else
    {
        if ($wait) { Start-Process -FilePath 'powershell.exe' -ArgumentList $a -NoNewWindow -Wait }
        else { Start-Process -FilePath 'powershell.exe' -ArgumentList $a -NoNewWindow | Out-Null }
    }
}

function Show-Menu
{
    $empty = 0
    $quit = $false
    while ($true)
    {
        Write-Host ''
        Write-Host '=========================================================='
        Write-Host '  ОБХОД DPI -- ЮТУБ и ДИСКОРД (самоподбор и хранитель)'
        Write-Host '=========================================================='
        Write-Host '  [1] проверить сейчас         -- ничего не менять (без прав)'
        Write-Host '  [2] показать пресеты         -- что будет пробовать (без прав)'
        Write-Host '  [3] принести движок          -- скачать zapret сюда (без прав)'
        Write-Host '  [v] голосовой канал сейчас   -- спросить бота по-настоящему (без прав)'
        Write-Host '  [4] ПОДОБРАТЬ и запустить    -- оставить рабочий (права)'
        Write-Host '  [5] подобрать, не оставлять  -- вернуть как было (права)'
        Write-Host '  [6] ХРАНИТЕЛЬ                -- следить и чинить сам (права)'
        Write-Host '  [7] хранитель в автозапуск   -- поднимется сам при входе (права)'
        Write-Host '  [8] снять с автозапуска      -- (права)'
        Write-Host '  [9] остановить обход         -- (права)'
        Write-Host '  [0] вернуть службу zapret    -- как было (права)'
        Write-Host '  [q] выйти'
        Write-Host ''
        $ch = $null
        try { $ch = Read-Host '  Твой выбор' } catch { break }
        # Read-Host при кончившемся вводе отдаёт null -- без проверки падает на .Trim()
        if ($null -eq $ch -or ([string]$ch).Trim() -eq '')
        {
            $empty = $empty + 1
            if ($empty -ge 2) { Write-Host '  Ввод закончился -- выхожу.'; break }
            continue
        }
        $ch = ([string]$ch).Trim().ToLower()
        $empty = 0
        switch ($ch)
        {
            '1' { Run-Pick @('-Check') $false $true }
            '2' { Run-Pick @('-List') $false $true }
            '3' { Run-Pick @('-EngineOnly') $false $true }
            'v' { Run-Pick @('-VoiceOnly') $false $true }
            '4' { Run-Pick @('-Seconds', '10') $true $true }
            '5' { Run-Pick @('-TestOnly') $true $true }
            '6' { Run-Pick @('-Keeper', '-Every', '5') $true $false }
            '7' { Run-Pick @('-Autostart') $true $true }
            '8' { Run-Pick @('-AutostartOff') $true $true }
            '9' { Run-Pick @('-Stop') $true $true }
            '0' { Run-Pick @('-Restore') $true $true }
            'q' { $quit = $true }
            default { Write-Host '  Не понял выбор.'; Start-Sleep -Seconds 1 }
        }
        # break внутри switch выходит из switch, а не из цикла -- выход делаю отдельно
        if ($quit) { break }
    }
}

# ---------- сам подбор: перебрать пресеты и вернуть лучший ----------
function Invoke-Pick($Strategies, $Winws, $WasRunning)
{
    $need = $Strategies.Count * ($Seconds + 4) + 30
    W ('пресетов к проверке: ' + $Strategies.Count + ' (по ' + $Seconds + ' с на каждый)')
    W ('внимание: на время подбора обход останавливается -- youtube и discord будут недоступны примерно ' + $need + ' с, потом сторож вернёт службу сам')
    Arm-Watchdog $WasRunning $need

    $results = @()
    foreach ($st in $Strategies)
    {
        Stop-Bypass
        $proc = Start-Winws $Winws $st.Args
        Start-Sleep -Seconds $Seconds
        $yt = Test-Youtube
        $gw = Test-DiscordGateway
        $api = Test-DiscordApi
        $alive = ($proc -and -not $proc.HasExited)
        $mark = 'нет'
        if ($yt -and ($gw -or $api)) { $mark = 'ДА' } elseif ($yt -or $gw -or $api) { $mark = 'частично' }
        W ($st.Name.PadRight(34) + ' процесс: ' + $(if ($alive) { 'работает' } else { 'упал' }) + ' | youtube: ' + $(if ($yt) { 'да' } else { 'нет' }) + ' | шлюз discord: ' + $(if ($gw) { 'да' } else { 'нет' }) + ' | api discord: ' + $(if ($api) { 'да' } else { 'нет' }) + '  -> ' + $mark)
        $results += [pscustomobject]@{ Name = $st.Name; Args = $st.Args; Yt = $yt; Gw = $gw; Api = $api; Alive = $alive }
        Stop-Bypass
    }

    # берём ту, где работают ОБА пути; только если такой нет -- довольствуемся частичной
    $best = $results | Where-Object { $_.Yt -and ($_.Gw -or $_.Api) } | Select-Object -First 1
    if (-not $best) { $best = $results | Where-Object { $_.Gw -or $_.Api } | Select-Object -First 1 }
    if (-not $best) { $best = $results | Where-Object { $_.Yt } | Select-Object -First 1 }
    return $best
}

# ---------- хранитель: держит оба пути рабочими ----------
function Lock-Keeper
{
    $lf = Join-Path $Work 'keeper.lock'
    if (Test-Path $lf)
    {
        $old = 0
        try { $old = [int]((Get-Content -Path $lf -ErrorAction SilentlyContinue | Select-Object -First 1)) } catch { $old = 0 }
        if ($old -gt 0 -and (Get-Process -Id $old -ErrorAction SilentlyContinue)) { return $false }
    }
    Set-Content -Path $lf -Value $PID -Encoding ASCII
    return $true
}

function Invoke-Keeper($Winws, $Strategies, $WasRunning)
{
    W '===== хранитель: держу рабочими и youtube, и discord ====='
    W ('проверка каждые ' + $Every + ' мин; при поломке сам перебираю пресеты и возвращаю рабочий')
    $first = $true
    while ($true)
    {
        $yt = Test-Youtube
        $gw = Test-DiscordGateway
        $api = Test-DiscordApi
        if ($yt -and ($gw -or $api))
        {
            W ('оба пути живы: youtube=да, discord=да -- следующая проверка через ' + $Every + ' мин')
        }
        else
        {
            W ('ПОЛОМКА: youtube=' + $(if ($yt) { 'да' } else { 'нет' }) + ', шлюз discord=' + $(if ($gw) { 'да' } else { 'нет' }) + ', api discord=' + $(if ($api) { 'да' } else { 'нет' }) + ' -- переподбираю стратегию')
            $svc = (ServiceState 'zapret') -eq 'Running'
            if (-not $Strategies -or -not $Strategies.Count)
            {
                W 'чинить нечем: нет движка или пресетов -- запусти с правами и с набором zapret (либо сними задачу и подбери заново)'
            }
            else
            {
                $best = Invoke-Pick $Strategies $Winws $svc
                if ($best)
                {
                    Stop-Bypass
                    Start-Winws $Winws $best.Args | Out-Null
                    Start-Sleep -Seconds 3
                    W ('поднял стратегию: ' + $best.Name + ' | youtube=' + $(if (Test-Youtube) { 'да' } else { 'нет' }) + ', шлюз discord=' + $(if (Test-DiscordGateway) { 'да' } else { 'нет' }))
                }
                else
                {
                    W 'рабочей стратегии не нашлось: оставляю как было и проверю снова (набор zapret стоит обновить)'
                    Restore-Service $svc
                }
            }
        }
        $first = $false
        Start-Sleep -Seconds ($Every * 60)
    }
}

# ---------- автозапуск: хранитель сам поднимается при входе ----------
function Invoke-Schtasks($arguments)
{
    $out = Join-Path $Work 'autostart.txt'
    try { Start-Process -FilePath 'schtasks.exe' -ArgumentList $arguments -Wait -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError $out -ErrorAction Stop | Out-Null }
    catch { W ('schtasks не сработал: ' + $_.Exception.Message) }
    $text = ''
    try { $text = ((Get-Content -Path $out -ErrorAction SilentlyContinue) -join ' | ') } catch { }
    W ('schtasks: ' + $text)
}

function Register-Keeper
{
    $script = Join-Path $Here 'zapret-pick.ps1'
    $exe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    # при входе в систему и с повышенными правами: UAC не спросит, окна не будет
    $tr = '"' + $exe + '" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '" -Keeper'
    Invoke-Schtasks ('/Create /TN "obhod-dpi" /SC ONLOGON /RL HIGHEST /F /TR "' + $tr + '"')
    Invoke-Schtasks '/Query /TN "obhod-dpi" /FO LIST'
}

function Unregister-Keeper
{
    Invoke-Schtasks '/Delete /TN "obhod-dpi" /F'
}

# ================= основной ход =================
# лог НЕ стираю: в нём история (когда рвалось, что помогло). Старый ухожу в .1 -- хранитель должен помнить.
if ((Test-Path $LogPath) -and ((Get-Item $LogPath).Length -gt 512000)) { Move-Item -Path $LogPath -Destination ($LogPath + '.1') -Force }
W ('===== обход DPI: самоподбор стратегии (' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ') =====')

if ($Menu)
{
    Show-Menu
    exit 0
}

if ($VoiceOnly)   # спросить бота про голосовой канал (прав не надо, бот должен быть выключен)
{
    $v = Test-DiscordVoice $proj
    if ($v.skip) { W ('голосовой канал: ' + $v.why); exit 3 }
    if ($v.ok) { W 'голосовой канал: работает (бот вошёл в канал и медиа-адрес ответил)'; exit 0 }
    W ('голосовой канал: НЕ работает -- ' + $v.why)
    W 'без голосового канала музыка играть не сможет (это и есть критичный уровень)'
    exit 1
}

if ($Check)   # ничего не трогаем: только говорим, что сейчас
{
    W ('права администратора: ' + $(if (IsAdmin) { 'есть' } else { 'нет' }))
    W ('служба zapret: ' + (ServiceState 'zapret'))
    W ('youtube: ' + $(if (Test-Youtube) { 'отвечает' } else { 'НЕ отвечает' }))
    W ('шлюз discord: ' + $(if (Test-DiscordGateway) { 'отвечает' } else { 'НЕ отвечает' }))
    W ('api discord: ' + $(if (Test-DiscordApi) { 'отвечает' } else { 'НЕ отвечает' }))
    W ('папка zapret: ' + $(if ((Find-ZapretDir)) { Find-ZapretDir } else { 'не найдена (её принесёт -EngineOnly)' }))
    W 'голосовой канал: проверяется отдельно (нужно выключить бота для этого замера): -VoiceOnly'
    exit 0
}

if ($EngineOnly)   # только принести движок, без прав и без запуска
{
    $d = Find-ZapretDir
    if (-not $d) { $d = Fetch-Engine ([bool]$FetchEngine) }
    if ($d) { W ('движок zapret: ' + $d); exit 0 }
    W 'движок не нашёл и не скачал. Укажи папку вручную: -ZapretDir "C:\путь\к\zapret"'
    exit 3
}

if ($List)   # список стратегий без прав и без запуска
{
    $d0 = Find-ZapretDir
    if (-not $d0) { W 'не нашёл папку zapret. Принести без прав: -EngineOnly'; exit 3 }
    W ('папка: ' + $d0)
    foreach ($st in (Get-Strategies $d0)) { W ($st.Name + ' :: ' + $st.Args) }
    exit 0
}

if ($Keeper)
{
    if (-not (Lock-Keeper))
    {
        W 'хранитель уже работает -- второй не запускаю (см. keeper.lock)'
        exit 0
    }
    $kWinws = ''
    $kStr = @()
    if (IsAdmin)
    {
        $kDir = Find-ZapretDir
        if (-not $kDir) { $kDir = Fetch-Engine $false }
        if ($kDir)
        {
            $kWinws = Join-Path $kDir 'bin\winws.exe'
            $kStr = @(Get-Strategies $kDir)
        }
        if (-not $kStr.Count) { W 'движка или пресетов нет -- буду только следить, чинить нечем (принеси движок: -EngineOnly)' }
    }
    else
    {
        W 'прав нет -- буду только следить и писать в лог; чинить обход умеет запуск с правами (автозапуск: -Autostart)'
    }
    Invoke-Keeper $kWinws $kStr ((ServiceState 'zapret') -eq 'Running')
    exit 0
}

if (-not (IsAdmin))
{
    W 'ОШИБКА: нужны права администратора (драйвер WinDivert ставится только так).'
    W 'Запусти так: правая кнопка на PowerShell -> "Запуск от имени администратора", затем эту команду.'
    exit 5
}

$svcBefore = ServiceState 'zapret'

# автозапуск и остановка движка не требуют самой папки zapret -- только прав
if ($Autostart)
{
    Register-Keeper
    exit 0
}
if ($AutostartOff)
{
    Unregister-Keeper
    exit 0
}
if ($Restore)
{
    Stop-Bypass
    Restore-Service $true
    exit 0
}
if ($Stop)
{
    Stop-Bypass
    W 'обход остановлен'
    exit 0
}

$dir = Find-ZapretDir
if (-not $dir) { $dir = Fetch-Engine ([bool]$FetchEngine) }
if (-not $dir)
{
    W 'ОШИБКА: не нашёл и не скачал движок zapret (нужен bin\winws.exe).'
    W 'Скачай набор (zapret-discord-youtube) и укажи путь: -ZapretDir "C:\путь\к\zapret"'
    exit 3
}
$winws = Join-Path $dir 'bin\winws.exe'
W ('папка zapret: ' + $dir)
W ('служба zapret до работы: ' + $svcBefore)

$wasRunning = ($svcBefore -eq 'Running')
$strategies = @(Get-Strategies $dir)
if (-not $strategies.Count) { W 'ОШИБКА: не нашёл ни одного пресета general*.bat'; exit 4 }

$best = Invoke-Pick $strategies $winws $wasRunning

if (-not $SkipVoice -and $best)
{
    # голосовой канал -- критичный уровень: проверяю его у лучших по очереди (не больше четырёх)
    $cands = @()
    $cands += @($results | Where-Object { $_.Yt -and ($_.Gw -or $_.Api) })
    $cands += @($results | Where-Object { -not ($_.Yt -and ($_.Gw -or $_.Api)) -and ($_.Gw -or $_.Api) })
    if (-not $cands.Count) { $cands = @($results) }
    if ($cands.Count -gt 4) { $cands = $cands[0..3] }
    W ''
    W ('--- голосовой канал: проверяю по-настоящему у лучших (' + $cands.Count + ' -- не больше четырёх) ---')
    $voiceResult = 'НЕ работает'
    $voiceDone = $false
    foreach ($c in $cands)
    {
        Stop-Bypass
        Start-Winws $winws $c.Args | Out-Null
        Start-Sleep -Seconds 3
        $v = Test-DiscordVoice $proj
        if ($v.skip)
        {
            W ('   ' + $c.Name + ': голос не проверял -- ' + $v.why)
            $voiceResult = 'не проверял'
            break
        }
        if ($v.ok)
        {
            W ('   ' + $c.Name + ': голос РАБОТАЕТ')
            $best = $c
            $voiceDone = $true
            $voiceResult = 'работает'
            break
        }
        W ('   ' + $c.Name + ': голос не поднялся -- ' + $v.why)
    }
    if (-not $voiceDone -and $voiceResult -ne 'не проверял') { W '   ни одна из лучших не подняла канал -- музыка не заиграет, пока это так' }
    Stop-Bypass
}
else
{
    $voiceResult = 'не проверял'
}

W ''
W '===== итог ====='
if ($best)
{
    $cmdOk = ($best.Gw -or $best.Api)
    W ('лучшая стратегия: ' + $best.Name)
    W ('   дискорд, команды (бот слышит команды): ' + $(if ($cmdOk) { 'да' } else { 'нет' }))
    W ('   дискорд, голосовой канал: ' + $(if ($voiceResult -eq 'работает') { 'да (бот вошёл и медиа-адрес ответил)' } else { $voiceResult }))
    W ('   ютуб (новые треки): ' + $(if ($best.Yt) { 'да' } else { 'нет' }))
    if ($cmdOk -and $voiceResult -eq 'работает') { W '   вердикт: критичное в порядке -- команды доходят и голос поднимается; ютуб как получится' }
    elseif ($cmdOk) { W '   вердикт: команды доходят, но голос не поднялся -- без канала музыка играть не сможет' }
    else { W '   вердикт: дискорд не работает -- бота в комнате нет, это надо чинить в первую очередь' }
    $bat = '@echo off' + "`r`n" + 'cd /d "%~dp0"' + "`r`n" +
        '"' + $winws + '"' + $best.Args + "`r`n"
    [IO.File]::WriteAllText($ChosenBat, $bat, [Text.Encoding]::GetEncoding(866))
    W ('записал готовый запуск: ' + $ChosenBat)
    if (-not $TestOnly)
    {
        Stop-Bypass
        Start-Winws $winws $best.Args | Out-Null
        Start-Sleep -Seconds 3
        W ('запущено: youtube=' + $(if (Test-Youtube) { 'да' } else { 'нет' }) + ', шлюз discord=' + $(if (Test-DiscordGateway) { 'да' } else { 'нет' }))
        W 'чтобы это поднималось само после перезагрузки: положи zapret-chosen.bat в автозапуск или поставь службу из набора zapret'
    }
    else
    {
        Stop-Bypass
        W 'режим проверки: обход не оставлен запущенным'
        Restore-Service $wasRunning
    }
}
else
{
    W 'ни одна стратегия из этой папки не дала ни YouTube, ни Discord.'
    W 'Что делать: обновить набор zapret (там добавляют пресеты под новых провайдеров) или взять другой обход.'
    Restore-Service $wasRunning
}
W 'готово'
