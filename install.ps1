# EnQuota Universal Windows PowerShell Installer
$ErrorActionPreference = "Stop"

$Repo = "Najihh/EnQuota"
$BinName = "enquota.exe"
$Target = "enquota-windows-amd64.exe"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$Target"

Write-Host "=== Installing EnQuota for Windows ===" -ForegroundColor Cyan

$InstallDir = "$env:LOCALAPPDATA\Programs\EnQuota"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$Destination = Join-Path $InstallDir $BinName

Write-Host "Downloading $Target from $DownloadUrl..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $DownloadUrl -OutFile $Destination -UseBasicParsing

# Add to User PATH if not present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "Added $InstallDir to User PATH." -ForegroundColor Green
}

Write-Host "`n=== EnQuota installed successfully to $Destination ===" -ForegroundColor Green
Write-Host "Run 'enquota --help' or 'enquota detect 0896xxxxxxx' to get started."
