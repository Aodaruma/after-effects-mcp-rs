param(
    [string]$AfterEffectsPath,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Normalize-PathText {
    param([string]$PathText)

    if ([string]::IsNullOrWhiteSpace($PathText)) {
        return $null
    }

    return $PathText.Trim().Trim('"').Trim("'")
}

function Resolve-PreferredPathInput {
    param(
        [string]$ProvidedPath,
        [object[]]$RemainingArgs
    )

    $candidate = Normalize-PathText -PathText $ProvidedPath
    if (-not $candidate) {
        return $null
    }

    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    if ($RemainingArgs -and $RemainingArgs.Count -gt 0) {
        $parts = @($candidate)

        foreach ($token in $RemainingArgs) {
            $segment = [string]$token
            if ($segment.StartsWith("-")) {
                break
            }
            $parts += $segment
        }

        if ($parts.Count -gt 1) {
            $joined = Normalize-PathText -PathText ($parts -join " ")
            if ($joined) {
                if (Test-Path -LiteralPath $joined) {
                    return $joined
                }

                # gsudo/cmd argument parsing can leave a trailing "\" artifact.
                if ($joined.Length -gt 3 -and $joined.EndsWith("\")) {
                    $trimmed = $joined.Substring(0, $joined.Length - 1)
                    if (Test-Path -LiteralPath $trimmed) {
                        return $trimmed
                    }
                }

                return $joined
            }
        }
    }

    return $candidate
}

function Resolve-AfterEffectsPath {
    param([string]$PreferredPath)

    if ($PreferredPath) {
        if (Test-Path -LiteralPath $PreferredPath) {
            return $PreferredPath
        }
        throw "Specified After Effects path not found: $PreferredPath"
    }

    $possiblePaths = @(
        "C:\Program Files\Adobe\Adobe After Effects 2026",
        "C:\Program Files\Adobe\Adobe After Effects 2025",
        "C:\Program Files\Adobe\Adobe After Effects 2024",
        "C:\Program Files\Adobe\Adobe After Effects 2023",
        "C:\Program Files\Adobe\Adobe After Effects 2022",
        "C:\Program Files\Adobe\Adobe After Effects 2021"
    )

    foreach ($path in $possiblePaths) {
        if (Test-Path -LiteralPath $path) {
            return $path
        }
    }

    throw "After Effects install path was not detected. Pass -AfterEffectsPath explicitly."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceScript = Join-Path $repoRoot "src\scripts\mcp-bridge-auto.jsx"

if (!(Test-Path $sourceScript)) {
    throw "Bridge script not found: $sourceScript"
}

$resolvedPreferredPath = Resolve-PreferredPathInput -ProvidedPath $AfterEffectsPath -RemainingArgs $args
$aePath = Resolve-AfterEffectsPath -PreferredPath $resolvedPreferredPath
$destinationFolder = Join-Path $aePath "Support Files\Scripts\ScriptUI Panels"
$destinationScript = Join-Path $destinationFolder "mcp-bridge-auto.jsx"

Write-Host "Source      : $sourceScript"
Write-Host "Destination : $destinationScript"

if ($DryRun) {
    Write-Host "DryRun mode: no file copy was executed."
    exit 0
}

try {
    if (!(Test-Path $destinationFolder)) {
        New-Item -ItemType Directory -Path $destinationFolder -Force | Out-Null
    }
    Copy-Item -Path $sourceScript -Destination $destinationScript -Force
} catch {
    if (-not (Test-IsAdministrator)) {
        Write-Error @"
Copy failed. Administrator privileges are required.
Re-run in elevated PowerShell:
  powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
Original error: $($_.Exception.Message)
"@
        exit 1
    }
    throw
}

Write-Host ""
Write-Host "Bridge script installed."
Write-Host "Next steps:"
Write-Host "1. Open After Effects"
Write-Host "2. Edit > Preferences > Scripting & Expressions"
Write-Host "3. Enable Allow Scripts to Write Files and Access Network"
Write-Host "4. Restart After Effects"
Write-Host "5. Open Window > mcp-bridge-auto.jsx"
