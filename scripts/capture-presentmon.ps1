<#
.SYNOPSIS
  Capture one self-describing PresentMon run against the game, for the Windows
  present-path matrix in docs/PERFORMANCE_AUDIT.md (Iteration 3).

.DESCRIPTION
  Writes <OutRoot>\<label>\capture.csv plus env.txt. env.txt is the point of the
  script: a PresentMon CSV is MEANINGLESS without the display count, fullscreen
  state and DWM registry values it was taken under, and Iteration 3 already
  burned once on an undocumented machine state (OverlayTestMode=5 was set on the
  target box the whole time, invalidating the premise of matrix step 2).

  Change ONE knob between runs. Never two.

.EXAMPLE
  # Run from an ELEVATED pwsh. Launch the game first, get to the scene of
  # interest, then:
  .\scripts\capture-presentmon.ps1 -Label baseline -Seconds 60 -Hz 120 `
      -Note 'packaged exe, laptop panel only, TV not attached'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Label,
    [int]$Seconds = 60,
    [string]$ProcessName = 'Terraforming Mars.exe',
    [int]$Hz = 0,
    [string]$Note = '',
    [string]$PresentMon = 'C:\Users\zelin\tools\PresentMon\PresentMon-2.5.1-x64.exe',
    [string]$OutRoot = 'C:\Users\zelin\tools\PresentMon\captures'
)

$ErrorActionPreference = 'Stop'

# --- preflight ---------------------------------------------------------------
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Output 'ERROR: PresentMon consumes ETW and needs an ELEVATED shell.'
    Write-Output 'Open Windows Terminal as Administrator and re-run this script there.'
    exit 1
}
if (-not (Test-Path $PresentMon)) {
    Write-Output "ERROR: PresentMon not found at $PresentMon"
    Write-Output 'Get PresentMon-<ver>-x64.exe from https://github.com/GameTechDev/PresentMon/releases'
    exit 1
}

$target = Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($ProcessName)) -ErrorAction SilentlyContinue
if (-not $target) {
    Write-Output "WARNING: '$ProcessName' is not running. PresentMon will record nothing."
    Write-Output 'Launch the game, reach the scene you want to measure, then re-run.'
    exit 1
}

$outDir = Join-Path $OutRoot $Label
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$csv = Join-Path $outDir 'capture.csv'
$env = Join-Path $outDir 'env.txt'

# --- env snapshot ------------------------------------------------------------
# Everything that changes the MEANING of the numbers goes in here.
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens

$dwmKey = 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm'
$dwmVals = foreach ($n in 'OverlayTestMode', 'OverlayMinFPS') {
    try { "  $n = $((Get-ItemProperty -Path $dwmKey -Name $n -ErrorAction Stop).$n)" }
    catch { "  $n = <not set>" }
}

$lines = @()
$lines += "label      : $Label"
$lines += "captured   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += "note       : $Note"
$lines += "duration   : $Seconds s"
$lines += "refresh Hz : $(if ($Hz) { $Hz } else { '<not stated>' })"
$lines += ''
$lines += '--- target process ---'
foreach ($p in $target) {
    $lines += "  pid $($p.Id)  $($p.Path)"
    if ($p.Path) {
        $fv = (Get-Item $p.Path).VersionInfo
        $lines += "    file version: $($fv.FileVersion)   product: $($fv.ProductVersion)"
    }
}
$lines += ''
$lines += '--- DWM / MPO registry (HKLM\SOFTWARE\Microsoft\Windows\Dwm) ---'
$lines += $dwmVals
$lines += ''
$lines += "--- displays ($($screens.Count) attached) ---"
foreach ($s in $screens) {
    $lines += "  $($s.DeviceName)  primary=$($s.Primary)  bounds=$($s.Bounds)  workarea=$($s.WorkingArea)"
}
$lines += ''
$lines += '--- GPUs ---'
foreach ($g in Get-CimInstance Win32_VideoController) {
    $lines += "  $($g.Name)  driver $($g.DriverVersion)  mode '$($g.VideoModeDescription)'  refresh $($g.CurrentRefreshRate) Hz"
}
$lines += ''
$lines += '--- OS ---'
$os = Get-CimInstance Win32_OperatingSystem
$lines += "  $($os.Caption)  version $($os.Version)  build $($os.BuildNumber)"
$lines += ''
$lines += '--- PresentMon ---'
$lines += "  $PresentMon"
$lines += "  sha256 $((Get-FileHash $PresentMon -Algorithm SHA256).Hash)"

Set-Content -Path $env -Value $lines -Encoding utf8
Write-Output "env snapshot -> $env"
Write-Output ''
$lines | Write-Output
Write-Output ''

# --- capture -----------------------------------------------------------------
# --v1_metrics       : PresentMode strings + msBetweenDisplayChange (cause B, pacing)
# --track_hybrid_present : flags cross-adapter copies (cause C/D)
Write-Output "capturing $Seconds s of '$ProcessName' -> $csv"
Write-Output 'Play/animate normally: open an overlay, run a deal cinematic, move the gamepad cursor.'
Write-Output ''

& $PresentMon `
    --process_name $ProcessName `
    --output_file $csv `
    --v1_metrics `
    --track_hybrid_present `
    --timed $Seconds `
    --terminate_after_timed `
    --terminate_on_proc_exit `
    --stop_existing_session

Write-Output ''
if (Test-Path $csv) {
    $rows = (Get-Content $csv | Measure-Object -Line).Lines - 1
    Write-Output "captured $rows rows -> $csv"
    Write-Output ''
    Write-Output 'Analyse with:'
    $hzFlag = if ($Hz) { " --hz $Hz" } else { '' }
    Write-Output "  node C:\Projects\Mods\terraforming-mars\scripts\analyze-presentmon.cjs `"$csv`"$hzFlag"
} else {
    Write-Output "WARNING: no CSV produced at $csv"
}
