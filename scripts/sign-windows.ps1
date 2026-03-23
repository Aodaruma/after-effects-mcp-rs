param(
    [string]$ArtifactDir = ".\dist\windows",
    [string]$PfxPath = $env:WIN_SIGN_PFX_PATH,
    [string]$PfxPassword = $env:WIN_SIGN_PFX_PASSWORD,
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

function Get-SignToolPath {
    $cmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $defaultRoots = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
        "${env:ProgramFiles}\Windows Kits\10\bin"
    )
    foreach ($root in $defaultRoots) {
        if (!(Test-Path $root)) { continue }
        $candidate = Get-ChildItem -Path $root -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($candidate) {
            return $candidate.FullName
        }
    }
    return $null
}

if (!(Test-Path $ArtifactDir)) {
    throw "Artifact directory not found: $ArtifactDir"
}
if ([string]::IsNullOrWhiteSpace($PfxPath)) {
    throw "PFX path is not set. Pass -PfxPath or WIN_SIGN_PFX_PATH."
}
if (!(Test-Path $PfxPath)) {
    throw "PFX file not found: $PfxPath"
}
if ([string]::IsNullOrWhiteSpace($PfxPassword)) {
    throw "PFX password is empty. Pass -PfxPassword or WIN_SIGN_PFX_PASSWORD."
}

$signtool = Get-SignToolPath
if (-not $signtool) {
    throw "signtool.exe was not found. Install Windows SDK or Visual Studio Build Tools."
}

$targets = Get-ChildItem -Path $ArtifactDir -Recurse -File |
    Where-Object { $_.Extension -in @(".exe", ".msi") }

if ($targets.Count -eq 0) {
    throw "No .exe or .msi files found under $ArtifactDir"
}

foreach ($file in $targets) {
    Write-Host "Signing: $($file.FullName)"
    & $signtool sign `
        /fd SHA256 `
        /f $PfxPath `
        /p $PfxPassword `
        /tr $TimestampUrl `
        /td SHA256 `
        $file.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "signtool sign failed for $($file.FullName)"
    }

    & $signtool verify /pa $file.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "signtool verify failed for $($file.FullName)"
    }
}

Write-Host "Windows signing completed."

