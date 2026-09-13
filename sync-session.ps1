param(
    [string]$ConversationId
)

# J.A.R.V.I.S. Brain Sync Script
Write-Host "Syncing J.A.R.V.I.S. cognitive state into local Antigravity environment..." -ForegroundColor Cyan

$userHome = [System.Environment]::GetFolderPath('UserProfile')
$brainRoot = "$userHome\.gemini\antigravity\brain"
$sourceSync = "$PSScriptRoot\brain-sync"

$targets = @()
if ($ConversationId) {
    $targets += "$brainRoot\$ConversationId"
} else {
    $targets += "$brainRoot\c29737e7-70ca-4166-b8d9-7f9606888424"
    if (Test-Path $brainRoot) {
        $existing = Get-ChildItem -Path $brainRoot -Directory | Select-Object -ExpandProperty FullName
        foreach ($dir in $existing) {
            if ($targets -notcontains $dir) {
                $targets += $dir
            }
        }
    }
}

foreach ($targetBrainDir in $targets) {
    $targetLogsDir = "$targetBrainDir\.system_generated\logs"
    if (!(Test-Path $targetLogsDir)) {
        New-Item -ItemType Directory -Path $targetLogsDir -Force | Out-Null
    }

    if (Test-Path "$sourceSync\transcript.jsonl") {
        Copy-Item "$sourceSync\transcript.jsonl" "$targetLogsDir\transcript.jsonl" -Force
    }
    if (Test-Path "$sourceSync\implementation_plan.md") {
        Copy-Item "$sourceSync\implementation_plan.md" "$targetBrainDir\implementation_plan.md" -Force
    }
    if (Test-Path "$sourceSync\walkthrough.md") {
        Copy-Item "$sourceSync\walkthrough.md" "$targetBrainDir\walkthrough.md" -Force
    }
    Write-Host "Restored cognitive state to: $targetBrainDir" -ForegroundColor DarkCyan
}

Write-Host "Cognitive state successfully restored into Antigravity brain!" -ForegroundColor Green
Write-Host "Directives 01, 02, 03, and 04 are active." -ForegroundColor Green
