param(
    [string]$BridgeScriptPath
)

$ErrorActionPreference = "Stop"

function Resolve-BridgeScriptPath {
    param([string]$InputPath)

    if (-not [string]::IsNullOrWhiteSpace($InputPath) -and (Test-Path -LiteralPath $InputPath)) {
        return (Resolve-Path -LiteralPath $InputPath).Path
    }

    $fallback = Join-Path $PSScriptRoot "mcp-bridge-auto.jsx"
    if (Test-Path -LiteralPath $fallback) {
        return (Resolve-Path -LiteralPath $fallback).Path
    }

    throw "Bridge script not found. Provide -BridgeScriptPath or place mcp-bridge-auto.jsx beside this script."
}

function Get-AeInstallPaths {
    $adobeRoot = "C:\Program Files\Adobe"
    if (-not (Test-Path -LiteralPath $adobeRoot)) {
        return @()
    }

    return @(Get-ChildItem -LiteralPath $adobeRoot -Directory |
        Where-Object { $_.Name -match '^Adobe After Effects (\d{4})$' } |
        Sort-Object { [int]($_.Name -replace '^Adobe After Effects ', '') } -Descending |
        ForEach-Object { $_.FullName })
}

$source = Resolve-BridgeScriptPath -InputPath $BridgeScriptPath
$targets = Get-AeInstallPaths

if ($targets.Count -eq 0) {
    Write-Host "No After Effects installation was detected under C:\Program Files\Adobe. Skipped bridge deployment."
    exit 0
}

$installed = 0
foreach ($aePath in $targets) {
    $destDir = Join-Path $aePath "Support Files\Scripts\ScriptUI Panels"
    $destFile = Join-Path $destDir "mcp-bridge-auto.jsx"

    try {
        if (-not (Test-Path -LiteralPath $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $source -Destination $destFile -Force
        Write-Host "Installed: $destFile"
        $installed++
    } catch {
        Write-Warning "Failed to install bridge panel to '$destFile': $($_.Exception.Message)"
    }
}

Write-Host "Bridge deployment completed. Installed to $installed location(s)."
