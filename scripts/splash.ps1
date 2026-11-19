# Animated startup splash for Portfolio Nepse.
#
# Runs in its own STA runspace (started by launch.ps1) so the launcher's blocking
# port checks never stall the animation. Communicates through $sync, a
# synchronized hashtable:
#   Status      [string]  status line shown under the progress bar
#   Progress    [double]  0..1 target; the bar eases toward it and never moves back
#   Close       [bool]    set by the launcher; the splash fades out and exits
#   ProjectRoot [string]  used to load assets\icon.png
#   IconBase64  [string]  fallback logo
# Test mode: set $sync.RenderTo (directory) and $sync.RenderTimes (seconds) to
# write PNG frames instead of showing a window.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$W = 600
$H = 340

function New-Color([string]$hex, [int]$alpha = 255) {
    $c = [System.Drawing.ColorTranslator]::FromHtml($hex)
    return [System.Drawing.Color]::FromArgb($alpha, $c)
}

# Palette matches the app's light theme (src/index.css)
$Col = @{
    Bg      = New-Color '#FFFFFF'
    Border  = New-Color '#CBD5E1'
    Rule    = New-Color '#E2E8F0'
    Grid    = New-Color '#EEF2F6'
    Text    = New-Color '#0F172A'
    Muted   = New-Color '#64748B'
    Primary = New-Color '#1842B4'
    Second  = New-Color '#94A3B8'
    Faint   = New-Color '#CBD5E1'
}

function New-Font([string]$family, [single]$px, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
    try { return New-Object System.Drawing.Font($family, $px, $style, [System.Drawing.GraphicsUnit]::Pixel) }
    catch { return New-Object System.Drawing.Font('Segoe UI', $px, $style, [System.Drawing.GraphicsUnit]::Pixel) }
}

$Fnt = @{
    Title    = New-Font 'Segoe UI Semibold' 20
    Sub      = New-Font 'Segoe UI' 12
    Kicker   = New-Font 'Segoe UI' 11 ([System.Drawing.FontStyle]::Bold)
    Headline = New-Font 'Segoe UI Semibold' 15
    Caption  = New-Font 'Segoe UI' 12
    Axis     = New-Font 'Segoe UI' 10.5
    Value    = New-Font 'Segoe UI Semibold' 11.5
    Tag      = New-Font 'Segoe UI' 10.5
    Status   = New-Font 'Segoe UI' 12
}

$Br = @{
    Bg      = New-Object System.Drawing.SolidBrush($Col.Bg)
    Text    = New-Object System.Drawing.SolidBrush($Col.Text)
    Muted   = New-Object System.Drawing.SolidBrush($Col.Muted)
    Primary = New-Object System.Drawing.SolidBrush($Col.Primary)
    Second  = New-Object System.Drawing.SolidBrush($Col.Second)
    Track   = New-Object System.Drawing.SolidBrush($Col.Rule)
    Faint   = New-Object System.Drawing.SolidBrush($Col.Faint)
}

function New-Pen($color, [single]$width) {
    $p = New-Object System.Drawing.Pen($color, $width)
    $p.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $p.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $p.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $p
}

$Pn = @{
    Border  = New-Object System.Drawing.Pen($Col.Border, 1)
    Rule    = New-Object System.Drawing.Pen($Col.Rule, 1)
    Grid    = New-Object System.Drawing.Pen($Col.Grid, 1)
    Axis    = New-Object System.Drawing.Pen($Col.Faint, 1)
    Primary = New-Pen $Col.Primary 2.5
    Second  = New-Pen $Col.Second 2
    Thin    = New-Pen (New-Color '#B8C2D0') 1.2
    Trend   = New-Pen $Col.Text 1.2
}
$Pn.Trend.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash

# Layout
$LEFT = 24; $RIGHT = $W - 24
$PL = 40; $PR = 488; $PT = 134; $PB = 248     # plot rectangle
$CHART_TOP = 66; $CHART_BOTTOM = 292         # region that fades between scenes

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
function Clamp01([double]$x) { if ($x -lt 0) { 0.0 } elseif ($x -gt 1) { 1.0 } else { $x } }
function Ease([double]$x) { $x = Clamp01 $x; return 1 - [math]::Pow(1 - $x, 3) }

function Format-Lakh([double]$v) {
    if ($v -ge 100) { return ('{0:0.00} crore' -f ($v / 100)) }
    return ('{0:0.0} lakh' -f $v)
}

function Get-Points([double[]]$xs, [double[]]$ys, [double]$x0, [double]$x1, [double]$y0, [double]$y1) {
    $pts = New-Object 'System.Drawing.PointF[]' $xs.Length
    for ($i = 0; $i -lt $xs.Length; $i++) {
        $px = $PL + ($xs[$i] - $x0) / ($x1 - $x0) * ($PR - $PL)
        $py = $PB - ($ys[$i] - $y0) / ($y1 - $y0) * ($PB - $PT)
        $pts[$i] = New-Object System.Drawing.PointF([single]$px, [single]$py)
    }
    return , $pts
}

# First fraction p of a polyline, with the end point interpolated for smooth motion
function Get-Prefix([System.Drawing.PointF[]]$pts, [double]$p) {
    $n = $pts.Length
    $f = (Clamp01 $p) * ($n - 1)
    $i = [int][math]::Floor($f)
    if ($i -ge $n - 1) { return , $pts }
    $fr = $f - $i
    $out = New-Object 'System.Drawing.PointF[]' ($i + 2)
    [Array]::Copy($pts, $out, $i + 1)
    $a = $pts[$i]; $b = $pts[$i + 1]
    $out[$i + 1] = New-Object System.Drawing.PointF([single]($a.X + ($b.X - $a.X) * $fr), [single]($a.Y + ($b.Y - $a.Y) * $fr))
    return , $out
}

function Draw-Line($g, $pen, [System.Drawing.PointF[]]$pts) {
    if ($pts -and $pts.Length -ge 2) { $g.DrawLines($pen, $pts) }
}

function Draw-Dot($g, $brush, [System.Drawing.PointF]$pt) {
    $g.FillEllipse($Br.Bg, $pt.X - 5, $pt.Y - 5, 10, 10)
    $g.FillEllipse($brush, $pt.X - 3.5, $pt.Y - 3.5, 7, 7)
}

# Labels next to line tips: @{ Pt; Value; Tag; Brush }. Pushed apart so they never overlap.
function Draw-TipLabels($g, $labels) {
    $sorted = @($labels | Sort-Object { $_.Pt.Y })
    $lastY = -1000
    foreach ($l in $sorted) {
        $y = [math]::Max($l.Pt.Y - 14, $lastY + 30)
        $x = [math]::Max($l.Pt.X + 9, $PR + 6)
        $g.DrawString($l.Value, $Fnt.Value, $l.Brush, $x, $y)
        $g.DrawString($l.Tag, $Fnt.Tag, $Br.Muted, $x, $y + 14)
        $lastY = $y
    }
}

function Draw-Grid($g, [int]$rows = 3) {
    for ($r = 0; $r -lt $rows; $r++) {
        $y = $PT + ($PB - $PT) * $r / $rows
        $g.DrawLine($Pn.Grid, $PL, $y, $PR, $y)
    }
    $g.DrawLine($Pn.Axis, $PL, $PB, $PR, $PB)
}

function Draw-XLabels($g, [double]$x0, [double]$x1, $ticks, [string]$suffix) {
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $last = $ticks[-1]
    foreach ($t in $ticks) {
        $x = $PL + ($t - $x0) / ($x1 - $x0) * ($PR - $PL)
        $txt = if ($t -eq $last -and $suffix) { "$t $suffix" } else { "$t" }
        $g.DrawString($txt, $Fnt.Axis, $Br.Muted, [single]$x, [single]($PB + 4), $fmt)
    }
}

function New-RandomWalk([int]$seed, [int]$steps, [double]$drift, [double]$vol) {
    $rng = New-Object System.Random($seed)
    $v = New-Object 'double[]' ($steps + 1)
    $v[0] = 100.0
    for ($i = 1; $i -le $steps; $i++) {
        $u1 = 1.0 - $rng.NextDouble(); $u2 = $rng.NextDouble()
        $z = [math]::Sqrt(-2.0 * [math]::Log($u1)) * [math]::Cos(2.0 * [math]::PI * $u2)
        $v[$i] = $v[$i - 1] * [math]::Exp($drift - 0.5 * $vol * $vol + $vol * $z)
    }
    return , $v
}


# ------------------------------------------------------------------
# Scene data (computed once)
# ------------------------------------------------------------------

# 1. Compounding: Rs 1 lakh at 12% for 25 years, simple vs compound
$c_t = [double[]](0..100 | ForEach-Object { $_ * 0.25 })
$c_comp = [double[]]($c_t | ForEach-Object { [math]::Pow(1.12, $_) })
$c_simp = [double[]]($c_t | ForEach-Object { 1 + 0.12 * $_ })
$c_ptsComp = Get-Points $c_t $c_comp 0 25 0 18
$c_ptsSimp = Get-Points $c_t $c_simp 0 25 0 18

# 2. Starting early: Rs 10,000/month at 1%/month, start at 25 vs 35, value at each age (lakh)
function SIP-Value([double]$months) {
    if ($months -le 0) { return 0.0 }
    return 0.1 * ([math]::Pow(1.01, $months) - 1) / 0.01
}
$s_age = [double[]](0..140 | ForEach-Object { 25 + $_ * 0.25 })
$s_a = [double[]]($s_age | ForEach-Object { SIP-Value (($_ - 25) * 12) })
$s_b = [double[]]($s_age | ForEach-Object { SIP-Value (($_ - 35) * 12) })
$s_ptsA = Get-Points $s_age $s_a 25 60 0 700
$s_ptsB = Get-Points $s_age $s_b 25 60 0 700

# 3. Patience: simulated 15-year monthly price path, log scale, least-squares trend
$pSeed = if ($sync.PSeed) { [int]$sync.PSeed } else { 11 }
$p_v = New-RandomWalk $pSeed 180 0.009 0.065
$p_x = [double[]](0..180 | ForEach-Object { $_ / 12.0 })
$p_log = [double[]]($p_v | ForEach-Object { [math]::Log($_) })
$p_mx = 90.0; $p_my = ($p_log | Measure-Object -Average).Average
$p_sxy = 0.0; $p_sxx = 0.0
for ($i = 0; $i -le 180; $i++) { $p_sxy += ($i - $p_mx) * ($p_log[$i] - $p_my); $p_sxx += ($i - $p_mx) * ($i - $p_mx) }
$p_b = $p_sxy / $p_sxx; $p_a = $p_my - $p_b * $p_mx
$p_trend = [double[]](0..180 | ForEach-Object { $p_a + $p_b * $_ })
$p_lo = [math]::Min(($p_log | Measure-Object -Minimum).Minimum, $p_trend[0])
$p_hi = [math]::Max(($p_log | Measure-Object -Maximum).Maximum, $p_trend[180])
$p_pad = ($p_hi - $p_lo) * 0.06
$p_pts = Get-Points $p_x $p_log 0 15 ($p_lo - $p_pad) ($p_hi + $p_pad)
$p_ptsTrend = Get-Points $p_x $p_trend 0 15 ($p_lo - $p_pad) ($p_hi + $p_pad)

# 4. Rule of 72: value of Rs 1 lakh at 12% every 6 years
$r_years = @(0, 6, 12, 18, 24)
$r_vals = [double[]]($r_years | ForEach-Object { [math]::Pow(1.12, $_) })

# 5. Diversification: six independent simulated stocks and their equal-weight basket
# Plotted on a log scale so one runaway stock does not flatten the rest.
$dSeed = if ($sync.DSeed) { [int]$sync.DSeed } else { 21 }
$d_n = 120
$d_paths = @()
for ($k = 0; $k -lt 6; $k++) { $d_paths += , (New-RandomWalk ($dSeed + $k * 17) $d_n 0.008 0.085) }
$d_basket = New-Object 'double[]' ($d_n + 1)
for ($i = 0; $i -le $d_n; $i++) {
    $s = 0.0; foreach ($pth in $d_paths) { $s += $pth[$i] }
    $d_basket[$i] = $s / $d_paths.Count
}
$d_logs = @(); foreach ($pth in $d_paths) { $d_logs += , [double[]]($pth | ForEach-Object { [math]::Log($_) }) }
$d_logBasket = [double[]]($d_basket | ForEach-Object { [math]::Log($_) })
$d_all = @(); foreach ($l in $d_logs) { $d_all += $l }
$d_lo = ($d_all | Measure-Object -Minimum).Minimum
$d_hi = ($d_all | Measure-Object -Maximum).Maximum
$d_pad = ($d_hi - $d_lo) * 0.05
$d_x = [double[]](0..$d_n | ForEach-Object { $_ / 12.0 })
$d_pts = @(); foreach ($l in $d_logs) { $d_pts += , (Get-Points $d_x $l 0 10 ($d_lo - $d_pad) ($d_hi + $d_pad)) }
$d_ptsBasket = Get-Points $d_x $d_logBasket 0 10 ($d_lo - $d_pad) ($d_hi + $d_pad)

# ------------------------------------------------------------------
# Scenes: Kicker, Headline, Caption, Draw { param($g, $p) } with p = draw progress 0..1
# ------------------------------------------------------------------
$Scenes = @(
    @{
        Kicker   = 'COMPOUNDING'
        Headline = 'Rs 1 lakh at 12% a year for 25 years'
        Caption  = 'Simple interest grows in a straight line. Reinvested returns earn returns of their own.'
        Draw     = {
            param($g, $p)
            Draw-Grid $g
            Draw-XLabels $g 0 25 @(0, 5, 10, 15, 20, 25) 'yrs'
            $a = Get-Prefix $c_ptsSimp $p
            $b = Get-Prefix $c_ptsComp $p
            Draw-Line $g $Pn.Second $a
            Draw-Line $g $Pn.Primary $b
            $t = 25 * (Clamp01 $p)
            Draw-Dot $g $Br.Second $a[-1]
            Draw-Dot $g $Br.Primary $b[-1]
            Draw-TipLabels $g @(
                @{ Pt = $b[-1]; Value = (Format-Lakh ([math]::Pow(1.12, $t))); Tag = 'compounded'; Brush = $Br.Primary },
                @{ Pt = $a[-1]; Value = (Format-Lakh (1 + 0.12 * $t)); Tag = 'simple interest'; Brush = $Br.Text }
            )
        }
    },
    @{
        Kicker   = 'START EARLY'
        Headline = 'Rs 10,000 a month at 12%: starting at age 25 vs. 35'
        Caption  = 'Rs 42 lakh paid in vs. Rs 30 lakh, yet the early start ends with over 3x the money.'
        Draw     = {
            param($g, $p)
            Draw-Grid $g
            Draw-XLabels $g 25 60 @(25, 30, 35, 40, 45, 50, 55, 60) 'age'
            $a = Get-Prefix $s_ptsA $p
            $b = Get-Prefix $s_ptsB $p
            Draw-Line $g $Pn.Second $b
            Draw-Line $g $Pn.Primary $a
            $age = 25 + 35 * (Clamp01 $p)
            Draw-Dot $g $Br.Second $b[-1]
            Draw-Dot $g $Br.Primary $a[-1]
            Draw-TipLabels $g @(
                @{ Pt = $a[-1]; Value = (Format-Lakh (SIP-Value (($age - 25) * 12))); Tag = 'from age 25'; Brush = $Br.Primary },
                @{ Pt = $b[-1]; Value = (Format-Lakh (SIP-Value (($age - 35) * 12))); Tag = 'from age 35'; Brush = $Br.Text }
            )
        }
    },
    @{
        Kicker   = 'PATIENCE'
        Headline = 'A simulated 15-year price path, month by month'
        Caption  = 'Single months can drop sharply. Over long holding periods the trend outweighs the noise.'
        Draw     = {
            param($g, $p)
            Draw-Grid $g
            Draw-XLabels $g 0 15 @(0, 3, 6, 9, 12, 15) 'yrs'
            $trendP = Clamp01 (($p - 0.55) / 0.45)
            if ($trendP -gt 0) { Draw-Line $g $Pn.Trend (Get-Prefix $p_ptsTrend $trendP) }
            $a = Get-Prefix $p_pts $p
            Draw-Line $g $Pn.Primary $a
            $idx = [int][math]::Floor((Clamp01 $p) * 180)
            $chg = ($p_v[$idx] / $p_v[0] - 1) * 100
            Draw-Dot $g $Br.Primary $a[-1]
            Draw-TipLabels $g @(@{ Pt = $a[-1]; Value = ('{0:+0;-0}%' -f $chg); Tag = 'since start'; Brush = $Br.Primary })
        }
    },
    @{
        Kicker   = 'RULE OF 72'
        Headline = 'At 12% a year, money roughly doubles every 6 years'
        Caption  = 'Divide 72 by the yearly return to estimate the doubling time: 72 / 12 = 6 years.'
        Draw     = {
            param($g, $p)
            Draw-Grid $g
            $fmt = New-Object System.Drawing.StringFormat
            $fmt.Alignment = [System.Drawing.StringAlignment]::Center
            $slot = ($PR - $PL) / $r_years.Count
            $bw = 46
            for ($i = 0; $i -lt $r_years.Count; $i++) {
                $local = Ease (($p - $i * 0.14) / 0.32)
                $cx = $PL + $slot * ($i + 0.5)
                $h = $r_vals[$i] / 17.0 * ($PB - $PT) * $local
                if ($h -gt 0.5) {
                    $g.FillRectangle($Br.Primary, [single]($cx - $bw / 2), [single]($PB - $h), [single]$bw, [single]$h)
                }
                if ($local -gt 0.02) {
                    $g.DrawString(('{0:0.0} lakh' -f ($r_vals[$i] * $local)), $Fnt.Value, $Br.Text, [single]$cx, [single]($PB - $h - 18), $fmt)
                }
                $g.DrawString("Year $($r_years[$i])", $Fnt.Axis, $Br.Muted, [single]$cx, [single]($PB + 4), $fmt)
            }
        }
    },
    @{
        Kicker   = 'DIVERSIFICATION'
        Headline = 'Six simulated stocks vs. an equal-weight basket of all six'
        Caption  = 'Each stock swings on its own news. Holding all six together smooths the ride.'
        Draw     = {
            param($g, $p)
            Draw-Grid $g
            Draw-XLabels $g 0 10 @(0, 2, 4, 6, 8, 10) 'yrs'
            foreach ($pts in $d_pts) { Draw-Line $g $Pn.Thin (Get-Prefix $pts $p) }
            $a = Get-Prefix $d_ptsBasket $p
            Draw-Line $g $Pn.Primary $a
            Draw-Dot $g $Br.Primary $a[-1]
            Draw-TipLabels $g @(@{ Pt = $a[-1]; Value = 'Basket'; Tag = 'equal weight'; Brush = $Br.Primary })
        }
    }
)

$SCENE_LEN = 4.6     # seconds per scene
$DRAW_LEN = 2.9      # seconds for the line to draw in
$FADE_IN = 0.3
$FADE_OUT = 0.4

# ------------------------------------------------------------------
# Logo
# ------------------------------------------------------------------
$Logo = $null
try {
    $iconPath = Join-Path $sync.ProjectRoot 'assets\icon.png'
    if (Test-Path $iconPath) { $Logo = [System.Drawing.Image]::FromFile($iconPath) }
} catch {}
if (-not $Logo -and $sync.IconBase64) {
    try {
        $bytes = [Convert]::FromBase64String($sync.IconBase64)
        $Logo = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream(, $bytes)))
    } catch {}
}

# ------------------------------------------------------------------
# Frame renderer
# ------------------------------------------------------------------
$Bmp = New-Object System.Drawing.Bitmap($W, $H)
$G = [System.Drawing.Graphics]::FromImage($Bmp)
$G.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$G.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$G.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$FarFmt = New-Object System.Drawing.StringFormat
$FarFmt.Alignment = [System.Drawing.StringAlignment]::Far

# Minimize button (top-right of the header)
$MinBtn = New-Object System.Drawing.Rectangle(($W - 46), 12, 32, 28)
$MinHoverBrush = New-Object System.Drawing.SolidBrush((New-Color '#F1F5F9'))
$MinGlyphPen = New-Object System.Drawing.Pen($Col.Muted, 1.5)

function Draw-MinimizeButton($g, [bool]$hover) {
    if ($hover) { $g.FillRectangle($MinHoverBrush, $MinBtn) }
    $cx = $MinBtn.X + $MinBtn.Width / 2
    $cy = $MinBtn.Y + $MinBtn.Height / 2 + 1
    $g.DrawLine($MinGlyphPen, [single]($cx - 6), [single]$cy, [single]($cx + 6), [single]$cy)
}

function Render-Frame([double]$t, [double]$progress, [string]$status) {
    $g = $G
    $g.Clear($Col.Bg)

    # Header
    if ($Logo) { $g.DrawImage($Logo, $LEFT, 18, 30, 30) }
    $g.DrawString('Portfolio Nepse', $Fnt.Title, $Br.Text, 62, 12)
    $g.DrawString('NEPSE portfolio analysis', $Fnt.Sub, $Br.Muted, 64, 38)
    $g.DrawLine($Pn.Rule, 0, $CHART_TOP - 2, $W, $CHART_TOP - 2)
    Draw-MinimizeButton $g ([bool]($State -and $State.Hover))

    # Scene
    $idx = [int]([math]::Floor($t / $SCENE_LEN)) % $Scenes.Count
    $local = $t - [math]::Floor($t / $SCENE_LEN) * $SCENE_LEN
    $scene = $Scenes[$idx]
    $g.DrawString($scene.Kicker, $Fnt.Kicker, $Br.Primary, $LEFT, 80)
    $g.DrawString($scene.Headline, $Fnt.Headline, $Br.Text, $LEFT - 1, 96)
    & $scene.Draw $g (Ease (($local - 0.15) / $DRAW_LEN))
    $g.DrawString($scene.Caption, $Fnt.Caption, $Br.Muted, $LEFT - 1, 270)

    # Cross-fade between scenes: wash the chart region with the background colour
    $alpha = [math]::Min((Clamp01 ($local / $FADE_IN)), (Clamp01 (($SCENE_LEN - $local) / $FADE_OUT)))
    if ($alpha -lt 1) {
        $wash = New-Object System.Drawing.SolidBrush((New-Color '#FFFFFF' ([int](255 * (1 - $alpha)))))
        $g.FillRectangle($wash, 0, $CHART_TOP, $W, $CHART_BOTTOM - $CHART_TOP)
        $wash.Dispose()
    }

    # Scene position dots
    for ($i = 0; $i -lt $Scenes.Count; $i++) {
        $x = $RIGHT - ($Scenes.Count - 1 - $i) * 14 - 6
        $brush = if ($i -eq $idx) { $Br.Primary } else { $Br.Faint }
        $g.FillEllipse($brush, [single]$x, 83, 6, 6)
    }

    # Progress
    $g.FillRectangle($Br.Track, $LEFT, 302, $RIGHT - $LEFT, 4)
    $g.FillRectangle($Br.Primary, $LEFT, 302, [single](($RIGHT - $LEFT) * (Clamp01 $progress)), 4)
    $g.DrawString($status, $Fnt.Status, $Br.Text, $LEFT - 1, 312)
    $g.DrawString(('{0:0}%' -f (100 * (Clamp01 $progress))), $Fnt.Status, $Br.Muted, (New-Object System.Drawing.RectangleF($LEFT, 312, ($RIGHT - $LEFT), 18)), $FarFmt)

    $g.DrawRectangle($Pn.Border, 0, 0, $W - 1, $H - 1)
}

# ------------------------------------------------------------------
# Test mode: render frames to PNG and exit
# ------------------------------------------------------------------
if ($sync.RenderTo) {
    $n = 0
    foreach ($t in $sync.RenderTimes) {
        Render-Frame $t $sync.Progress $sync.Status
        $Bmp.Save((Join-Path $sync.RenderTo ('frame_{0:00}.png' -f $n)), [System.Drawing.Imaging.ImageFormat]::Png)
        $n++
    }
    return
}

# ------------------------------------------------------------------
# Window
# ------------------------------------------------------------------
[System.Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size($W, $H)
$form.BackColor = $Col.Bg
$form.TopMost = $true
# Shown in the taskbar so the splash can be minimized and restored.
$form.ShowInTaskbar = $true
$form.Text = 'Portfolio Nepse - starting'
if ($Logo) {
    try { $form.Icon = [System.Drawing.Icon]::FromHandle((New-Object System.Drawing.Bitmap($Logo, 64, 64)).GetHicon()) } catch {}
}

$pic = New-Object System.Windows.Forms.PictureBox
$pic.Dock = 'Fill'
$pic.Image = $Bmp
$form.Controls.Add($pic)

$State = @{
    Clock     = [System.Diagnostics.Stopwatch]::StartNew()
    Shown     = 0.0
    Closing   = $false
    Hover     = $false
    MouseDown = $false
}

# A left or right click outside the splash minimizes it to the taskbar (it can
# be restored from there; the launcher still closes it when the app is ready).
# Uses PortfolioNepse.NativeMouse, compiled by launch.ps1 ($sync.MouseApi).
function Test-OutsideClick {
    if (-not $sync.MouseApi) { return $false }
    $down = (([PortfolioNepse.NativeMouse]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0) -or
            (([PortfolioNepse.NativeMouse]::GetAsyncKeyState(0x02) -band 0x8000) -ne 0)
    $pressed = $down -and -not $State.MouseDown
    $State.MouseDown = $down
    return ($pressed -and -not $form.Bounds.Contains([System.Windows.Forms.Control]::MousePosition))
}

$pic.add_MouseMove({
    param($s, $e)
    $over = $MinBtn.Contains($e.Location)
    if ($over -ne $State.Hover) {
        $State.Hover = $over
        $pic.Cursor = if ($over) { [System.Windows.Forms.Cursors]::Hand } else { [System.Windows.Forms.Cursors]::Default }
    }
})
$pic.add_MouseLeave({ $State.Hover = $false; $pic.Cursor = [System.Windows.Forms.Cursors]::Default })
$pic.add_MouseClick({
    param($s, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left -and $MinBtn.Contains($e.Location)) {
        $State.Hover = $false
        $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
    }
})

Render-Frame 0 0 ([string]$sync.Status)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 30
$timer.add_Tick({
    try {
        $target = [double]$sync.Progress
        if ($target -gt $State.Shown) { $State.Shown += ($target - $State.Shown) * 0.12 }
        if ($form.WindowState -ne [System.Windows.Forms.FormWindowState]::Minimized -and -not $sync.Close -and (Test-OutsideClick)) {
            $State.Hover = $false
            $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
        }

        # Nothing to draw while minimized; the animation clock keeps running.
        if ($form.WindowState -ne [System.Windows.Forms.FormWindowState]::Minimized) {
            Render-Frame $State.Clock.Elapsed.TotalSeconds $State.Shown ([string]$sync.Status)
            $pic.Invalidate()
        }

        if ($sync.Close) {
            # 0.0, not 0: an int first argument makes PowerShell pick Max(int, int) and round the opacity back to 1
            $form.Opacity = [math]::Max(0.0, $form.Opacity - 0.2)
            if ($form.Opacity -le 0.05) { $timer.Stop(); $form.Close() }
        }
    } catch { $sync.LastError = "$($_.Exception.Message) @ line $($_.InvocationInfo.ScriptLineNumber)" }
})
$timer.Start()

[System.Windows.Forms.Application]::Run($form)

$timer.Dispose()
$G.Dispose()
$Bmp.Dispose()
