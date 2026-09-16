<#
.SYNOPSIS
    J.A.R.V.I.S. Mark II — Zero-Install Windows Native WPF Command HUD
    Runs natively on 100% of Windows 10/11 machines (Zero Python, Zero Node, Zero Admin Rights).
    Directive 01 & 04 Compliant.
#>

[CmdletBinding()]
param()

# 1. Load Required Windows Assemblies
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Drawing, System.Windows.Forms

# 2. Configuration & Sovereign Token
$ApiUrl = "https://jarvis-iota-beige.vercel.app/api/jarvis/shortcut"
$BearerToken = "sk_jarvis_mobile_sovereign_2026_apex"

# 3. Clean XAML String Definition
$xamlString = @'
<Window
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    Title="J.A.R.V.I.S. HUD"
    Height="540" Width="740"
    WindowStartupLocation="CenterScreen"
    WindowStyle="None"
    AllowsTransparency="True"
    Background="Transparent"
    Topmost="True"
    ShowInTaskbar="True">
    
    <Border Background="#0A0E17" CornerRadius="12" BorderBrush="#00F0FF" BorderThickness="1.5">
        <Grid Margin="16">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <!-- Row 0: Header & Controls -->
            <Grid Grid.Row="0" Margin="0,0,0,10">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <StackPanel Orientation="Horizontal" Grid.Column="0">
                    <TextBlock Text="⚡ J.A.R.V.I.S. MARK II" Foreground="#00F0FF" FontWeight="Bold" FontSize="13" VerticalAlignment="Center"/>
                    <TextBlock Text="  //  SOVEREIGN HUD" Foreground="#8B949E" FontSize="12" VerticalAlignment="Center"/>
                    <Border Background="#052E16" CornerRadius="4" Padding="6,2" Margin="12,0,0,0">
                        <TextBlock x:Name="StatusBadge" Text="● ONLINE" Foreground="#00FF9D" FontWeight="Bold" FontSize="10"/>
                    </Border>
                </StackPanel>
                <TextBlock Grid.Column="1" Text="[ESC] Close  |  [ENTER] Execute" Foreground="#8B949E" FontSize="11" VerticalAlignment="Center" Margin="0,0,12,0"/>
                <Button x:Name="BtnClose" Grid.Column="2" Content="✕" Width="24" Height="22" Background="#111927" Foreground="#E2E8F0" BorderBrush="#1F2D42" FontWeight="Bold" Cursor="Hand"/>
            </Grid>

            <!-- Row 1: Command Input Box -->
            <Border Grid.Row="1" Background="#111927" CornerRadius="8" BorderBrush="#1F2D42" BorderThickness="1" Margin="0,0,0,8" Padding="10,4">
                <Grid>
                    <TextBox x:Name="PromptInput" Background="Transparent" Foreground="#E2E8F0" BorderThickness="0" FontSize="14" FontFamily="Segoe UI" VerticalAlignment="Center" CaretBrush="#00F0FF"/>
                </Grid>
            </Border>

            <!-- Row 2: Quick Action Pills -->
            <StackPanel Grid.Row="2" Orientation="Horizontal" Margin="0,0,0,10">
                <Button x:Name="BtnBriefing" Content="📊 Briefing" Height="26" Margin="0,0,6,0" Padding="10,0" Background="#111927" Foreground="#00F0FF" BorderBrush="#1F2D42" FontWeight="SemiBold" FontSize="11" Cursor="Hand"/>
                <Button x:Name="BtnRadar" Content="🎯 Radar" Height="26" Margin="0,0,6,0" Padding="10,0" Background="#111927" Foreground="#00F0FF" BorderBrush="#1F2D42" FontWeight="SemiBold" FontSize="11" Cursor="Hand"/>
                <Button x:Name="BtnAudit" Content="🛡️ Security Scan" Height="26" Margin="0,0,6,0" Padding="10,0" Background="#111927" Foreground="#00F0FF" BorderBrush="#1F2D42" FontWeight="SemiBold" FontSize="11" Cursor="Hand"/>
                <Button x:Name="BtnGroq" Content="⚡ Groq 120B" Height="26" Margin="0,0,6,0" Padding="10,0" Background="#111927" Foreground="#00F0FF" BorderBrush="#1F2D42" FontWeight="SemiBold" FontSize="11" Cursor="Hand"/>
                <Button x:Name="BtnClipboard" Content="📋 Analyze Clipboard" Height="26" Margin="0,0,6,0" Padding="10,0" Background="#111927" Foreground="#00F0FF" BorderBrush="#1F2D42" FontWeight="SemiBold" FontSize="11" Cursor="Hand"/>
            </StackPanel>

            <!-- Row 3: Response Output Display Area -->
            <Border Grid.Row="3" Background="#111927" CornerRadius="8" BorderBrush="#1F2D42" BorderThickness="1" Margin="0,0,0,10">
                <TextBox x:Name="OutputBox" Background="Transparent" Foreground="#E2E8F0" BorderThickness="0" FontSize="12" FontFamily="Consolas" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto" IsReadOnly="True" Padding="12" CaretBrush="#00F0FF"/>
            </Border>

            <!-- Row 4: Telemetry Footer -->
            <Grid Grid.Row="4">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <TextBlock x:Name="TelemetryLabel" Grid.Column="0" Text="Substrate: Standby  |  Zero-Install Office Mode" Foreground="#8B949E" FontSize="10" VerticalAlignment="Center"/>
                <Button x:Name="BtnCopy" Grid.Column="1" Content="📋 Copy Output" Height="24" Padding="10,0" Background="#1B2537" Foreground="#E2E8F0" BorderBrush="#1F2D42" FontSize="10" FontWeight="Bold" Cursor="Hand"/>
            </Grid>
        </Grid>
    </Border>
</Window>
'@

# 4. Safe XAML Deserialization
try {
    $stringReader = New-Object System.IO.StringReader($xamlString)
    $xmlReader = [System.Xml.XmlReader]::Create($stringReader)
    $window = [System.Windows.Markup.XamlReader]::Load($xmlReader)
} catch {
    Write-Error "Failed to load XAML interface: $_"
    Read-Host "Press Enter to exit..."
    exit 1
}

# 5. Extract Named Controls
$PromptInput = $window.FindName("PromptInput")
$OutputBox = $window.FindName("OutputBox")
$StatusBadge = $window.FindName("StatusBadge")
$TelemetryLabel = $window.FindName("TelemetryLabel")
$BtnBriefing = $window.FindName("BtnBriefing")
$BtnRadar = $window.FindName("BtnRadar")
$BtnAudit = $window.FindName("BtnAudit")
$BtnGroq = $window.FindName("BtnGroq")
$BtnClipboard = $window.FindName("BtnClipboard")
$BtnCopy = $window.FindName("BtnCopy")
$BtnClose = $window.FindName("BtnClose")

# Initial greeting
$OutputBox.Text = "J.A.R.V.I.S. Windows Sovereign HUD Initialized.`r`nReady for directives on your workstation, Sir.`r`n`r`nType a prompt above or click an action pill."

# Window Dragging
$window.Add_MouseLeftButtonDown({
    $window.DragMove()
})

# Close Button
$BtnClose.Add_Click({
    $window.Close()
})

# 6. Synchronous/Async Dispatch Helper
function Dispatch-JarvisDirective($prompt) {
    if ([string]::IsNullOrWhiteSpace($prompt)) { return }
    
    $StatusBadge.Text = "● THINKING..."
    $StatusBadge.Foreground = [System.Windows.Media.Brushes]::Cyan
    $OutputBox.Text = '⚡ Executing directive: "' + $prompt + '"...' + "`r`nTransmitting to J.A.R.V.I.S. Cloud Edge...`r`n"

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    $runspace = [runspacefactory]::CreateRunspace()
    $runspace.Open()
    $powershell = [powershell]::Create().AddScript({
        param($url, $token, $text)
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
            $headers = @{
                "Authorization" = "Bearer $token"
                "Content-Type" = "application/json"
            }
            $body = @{
                prompt = $text
                isVoice = $false
            } | ConvertTo-Json -Compress

            $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 30
            return @{ Success = $true; Data = $response }
        } catch {
            return @{ Success = $false; Error = $_.Exception.Message }
        }
    }).AddArgument($ApiUrl).AddArgument($BearerToken).AddArgument($prompt)

    $powershell.Runspace = $runspace
    $asyncResult = $powershell.BeginInvoke()

    $timer = New-Object System.Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMilliseconds(100)
    $timer.Add_Tick({
        if ($asyncResult.IsCompleted) {
            $timer.Stop()
            $stopwatch.Stop()
            $result = $powershell.EndInvoke($asyncResult)
            $powershell.Dispose()
            $runspace.Close()

            $StatusBadge.Text = "● ONLINE"
            $StatusBadge.Foreground = [System.Windows.Media.Brushes]::SpringGreen

            if ($result.Success) {
                $data = $result.Data
                $OutputBox.Text = $data.reply
                $engine = if ($data.telemetry) { $data.telemetry.engineUsed } else { "Cloud Engine" }
                $TelemetryLabel.Text = "Latency: $($stopwatch.ElapsedMilliseconds)ms  |  Engine: $engine"
            } else {
                $OutputBox.Text = '🚨 Communication Error: ' + $result.Error + "`r`n`r`nPlease check network connectivity or sovereign token."
                $TelemetryLabel.Text = "Status: Transmission Failed"
            }
        }
    })
    $timer.Start()
}

# 7. Event Bindings
$PromptInput.Add_KeyDown({
    param($sender, $e)
    if ($e.Key -eq [System.Windows.Input.Key]::Enter) {
        $text = $PromptInput.Text.Trim()
        if ($text) {
            Dispatch-JarvisDirective $text
        }
    }
})

$window.Add_KeyDown({
    param($sender, $e)
    if ($e.Key -eq [System.Windows.Input.Key]::Escape) {
        $window.Close()
    }
})

$BtnBriefing.Add_Click({
    $PromptInput.Text = "Give me an executive briefing on all active systems, tasks, and radar."
    Dispatch-JarvisDirective $PromptInput.Text
})

$BtnRadar.Add_Click({
    $PromptInput.Text = "List all active radar tasks and priorities."
    Dispatch-JarvisDirective $PromptInput.Text
})

$BtnAudit.Add_Click({
    $PromptInput.Text = "Run a comprehensive security audit of our infrastructure and codebase."
    Dispatch-JarvisDirective $PromptInput.Text
})

$BtnGroq.Add_Click({
    $PromptInput.Text = "/groq Report reflex tier status."
    Dispatch-JarvisDirective $PromptInput.Text
})

$BtnClipboard.Add_Click({
    $clip = [System.Windows.Forms.Clipboard]::GetText()
    if ($clip) {
        $PromptInput.Text = "Analyze this clipboard content / error"
        $maxLen = [Math]::Min(1500, $clip.Length)
        $clipSub = $clip.Substring(0, $maxLen)
        $directive = "Analyze this clipboard content / error:`r`n`r`n" + '```' + "`r`n" + $clipSub + "`r`n" + '```'
        Dispatch-JarvisDirective $directive
    } else {
        $OutputBox.Text = "Clipboard is currently empty, Sir."
    }
})

$BtnCopy.Add_Click({
    if ($OutputBox.Text) {
        [System.Windows.Forms.Clipboard]::SetText($OutputBox.Text)
        $BtnCopy.Content = "✅ Copied!"
        $resetTimer = New-Object System.Windows.Threading.DispatcherTimer
        $resetTimer.Interval = [TimeSpan]::FromMilliseconds(1500)
        $resetTimer.Add_Tick({
            $BtnCopy.Content = "📋 Copy Output"
            $resetTimer.Stop()
        })
        $resetTimer.Start()
    }
})

# 8. Show Dialog (Starts Native WPF Event Pump)
$PromptInput.Focus()
$null = $window.ShowDialog()
