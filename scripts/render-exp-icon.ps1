# Rasterize the polygon/rectangle SVG without fonts or external dependencies.
Add-Type -AssemblyName System.Drawing
$spriteDirectory = Join-Path $PSScriptRoot '../public/sprites'
[xml]$svg = Get-Content -LiteralPath (Join-Path $spriteDirectory 'icon_exp.svg') -Raw
$bitmap = [System.Drawing.Bitmap]::new(64, 64)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    foreach ($shape in $svg.DocumentElement.ChildNodes) {
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($shape.fill))
        try {
            switch ($shape.LocalName) {
                'polygon' {
                    [System.Drawing.PointF[]]$points = foreach ($pair in ($shape.points -split ' ')) {
                        $coordinates = $pair -split ','
                        [System.Drawing.PointF]::new([float]$coordinates[0], [float]$coordinates[1])
                    }
                    $graphics.FillPolygon($brush, $points)
                }
                'rect' { $graphics.FillRectangle($brush, [float]$shape.x, [float]$shape.y, [float]$shape.width, [float]$shape.height) }
                default { throw "Unsupported SVG shape: $($shape.LocalName)" }
            }
        } finally { $brush.Dispose() }
    }
    $bitmap.Save((Join-Path $spriteDirectory 'icon_exp.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $bitmap.Dispose() }
