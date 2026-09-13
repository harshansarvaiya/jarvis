# J.A.R.V.I.S. Brain Sync Script
Write-Host "Syncing J.A.R.V.I.S. cognitive state into local Antigravity environment..." -ForegroundColor Cyan

$userHome = [System.Environment]::GetFolderPath('UserProfile')
$targetBrainDir = "$userHome\.gemini\antigravity\brain\c29737e7-70ca-4166-b8d9-7f9606888424"
$targetLogsDir = "$targetBrainDir\.system_generated\logs"

if (!(Test-Path $targetLogsDir)) {
    New-Item -ItemType Directory -Path $targetLogsDir -Force | Out-Null
}

$sourceSync = "$PSScriptRoot\brain-sync"
if (Test-Path "$sourceSync\transcript.jsonl") {
    Copy-Item "$sourceSync\transcript.jsonl" "$targetLogsDir\transcript.jsonl" -Force
}
if (Test-Path "$sourceSync\implementation_plan.md") {
    Copy-Item "$sourceSync\implementation_plan.md" "$targetBrainDir\implementation_plan.md" -Force
}
if (Test-Path "$sourceSync\walkthrough.md") {
    Copy-Item "$sourceSync\walkthrough.md" "$targetBrainDir\walkthrough.md" -Force
}

Write-Host "Cognitive state successfully restored into Antigravity brain!" -ForegroundColor Green
Write-Host "Directives 01, 02, 03, and 04 are active." -ForegroundColor Green
