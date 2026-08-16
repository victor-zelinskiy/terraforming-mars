# Measures the visible (alpha > threshold) bounding box of every assets/ma/*.png
# and emits src/client/components/ma/maArtFit.json — the per-asset OPTICAL-FIT map
# the console strategy rail uses to normalise medal art by visual mass (the same
# idea as the tag matrix's per-tag @tag-fill scale, derived from the pixels
# instead of hand-tuning 132 entries).
#
# Per asset:  s = background-size percentage (one value — aspect preserved)
#             x/y = background-position percentages centring the TRIMMED art
# Fill target: the trimmed art's LARGER dimension lands at 98% of the box.
# Low-res legacy canvases (< 300px wide) cap the upscale at 128% so a 140px
# asset is never blown into mush; they simply stay optically smaller until
# the asset itself is migrated to the 512 premium format.
#
# Regenerate:  pwsh scripts/measure-ma-art.ps1

Add-Type -AssemblyName System.Drawing

$assets = Get-ChildItem 'assets/ma/*.png' | Sort-Object Name
$map = [ordered]@{}
$alphaThreshold = 8
$fill = 0.98

foreach ($f in $assets) {
  $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
  try {
    $w = $bmp.Width; $h = $bmp.Height
    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bytes = New-Object byte[] ($data.Stride * $h)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
    $bmp.UnlockBits($data)

    $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $h; $y++) {
      $row = $y * $data.Stride
      for ($x = 0; $x -lt $w; $x++) {
        if ($bytes[$row + $x * 4 + 3] -gt $alphaThreshold) {
          if ($x -lt $minX) { $minX = $x }
          if ($x -gt $maxX) { $maxX = $x }
          if ($y -lt $minY) { $minY = $y }
          if ($y -gt $maxY) { $maxY = $y }
        }
      }
    }
    if ($maxX -lt 0) { continue }  # fully transparent — leave to the contain fallback

    $tw = $maxX - $minX + 1; $th = $maxY - $minY + 1
    # One-value background-size = image WIDTH as a fraction of the box; the
    # height follows the canvas ratio (square box assumed by the rail).
    $p = $fill * $w / [Math]::Max($tw, $th)
    if ($w -lt 300) { $p = [Math]::Min($p, 1.28) }
    $q = $p * $h / $w
    $cx = ($minX + $tw / 2.0) / $w
    $cy = ($minY + $th / 2.0) / $h
    $px = if ([Math]::Abs(1 - $p) -lt 0.001) { 50.0 } else { 100.0 * (0.5 - $cx * $p) / (1 - $p) }
    $py = if ([Math]::Abs(1 - $q) -lt 0.001) { 50.0 } else { 100.0 * (0.5 - $cy * $q) / (1 - $q) }

    $slug = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    $map[$slug] = [ordered]@{
      s = [Math]::Round(100 * $p, 1)
      x = [Math]::Round($px, 1)
      y = [Math]::Round($py, 1)
      c = "$w x $h"
    }
  } finally {
    $bmp.Dispose()
  }
}

$out = 'src/client/components/ma/maArtFit.json'
($map | ConvertTo-Json) | Set-Content -Path $out -Encoding UTF8
Write-Host "measured $($map.Count) assets -> $out"
