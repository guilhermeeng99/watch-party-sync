$ErrorActionPreference = "Stop"

$iconDirectory = Join-Path $PSScriptRoot "..\extension\public\icons"
New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Rectangle]::new(0, 0, $size, $size),
    [System.Drawing.Color]::FromArgb(0, 107, 255),
    [System.Drawing.Color]::FromArgb(11, 53, 88),
    45
  )
  $graphics.FillRectangle($background, 0, 0, $size, $size)

  $radius = [Math]::Max(2, [Math]::Floor($size * 0.16))
  $inner = [System.Drawing.RectangleF]::new($size * 0.16, $size * 0.22, $size * 0.68, $size * 0.56)
  $graphics.FillEllipse(
    [System.Drawing.Brushes]::White,
    $inner.X,
    $inner.Y,
    $inner.Width,
    $inner.Height
  )

  $triangle = New-Object System.Drawing.Drawing2D.GraphicsPath
  $triangle.AddPolygon(@(
    [System.Drawing.PointF]::new($size * 0.42, $size * 0.36),
    [System.Drawing.PointF]::new($size * 0.42, $size * 0.64),
    [System.Drawing.PointF]::new($size * 0.66, $size * 0.50)
  ))
  $graphics.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 107, 255))), $triangle)

  $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(130, 255, 255, 255), [Math]::Max(1, $size * 0.06))
  $graphics.DrawRectangle($ringPen, $radius, $radius, $size - ($radius * 2), $size - ($radius * 2))

  $path = Join-Path $iconDirectory "icon-$size.png"
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $ringPen.Dispose()
  $triangle.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
