param(
    [string]$OutputDir = ".\dist\windows",
    [switch]$RequireMsi
)

$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([string]$Path)
    if (!(Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Find-WixCommand {
    $wix = Get-Command wix -ErrorAction SilentlyContinue
    if ($wix) {
        return $wix.Source
    }
    return $null
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$output = Resolve-Path -Path $OutputDir -ErrorAction SilentlyContinue
if (-not $output) {
    Ensure-Directory $OutputDir
    $output = Resolve-Path $OutputDir
}

Push-Location $repoRoot
try {
    Write-Host "Building release binary..."
    cargo build --release -p ae-mcp

    $exePath = Join-Path $repoRoot "target\release\ae-mcp.exe"
    if (!(Test-Path $exePath)) {
        throw "Release binary not found: $exePath"
    }

    $stageDir = Join-Path $output "stage"
    Ensure-Directory $stageDir
    Copy-Item $exePath (Join-Path $stageDir "ae-mcp.exe") -Force

    $zipPath = Join-Path $output "after-effects-mcp-rs-windows-x86_64.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -Force
    Write-Host "Created archive: $zipPath"

    $wixCmd = Find-WixCommand
    if (-not $wixCmd) {
        $msg = "WiX CLI (wix) is not installed; skipped MSI generation."
        if ($RequireMsi) {
            throw $msg
        }
        Write-Warning $msg
        return
    }

    $wxsPath = Join-Path $output "ae-mcp.wxs"
    $msiPath = Join-Path $output "after-effects-mcp-rs-windows-x86_64.msi"
    $escapedExe = (Join-Path $stageDir "ae-mcp.exe").Replace("\", "\\")

    @"
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Package Name="After Effects MCP (Rust)"
           Manufacturer="after-effects-mcp-rs contributors"
           Version="0.1.0.0"
           UpgradeCode="D7C1D860-4DA9-4E1E-B64A-8F64B7D9CC6E"
           Compressed="yes">
    <MediaTemplate EmbedCab="yes" />
    <StandardDirectory Id="ProgramFiles64Folder">
      <Directory Id="INSTALLFOLDER" Name="AfterEffectsMcp">
        <Component Id="AeMcpExeComponent" Guid="F94E8CF7-36DE-4E55-8FE5-C86069A6A4F9">
          <File Id="AeMcpExeFile" Source="$escapedExe" KeyPath="yes" />
        </Component>
      </Directory>
    </StandardDirectory>
    <Feature Id="MainFeature" Title="After Effects MCP" Level="1">
      <ComponentRef Id="AeMcpExeComponent" />
    </Feature>
  </Package>
</Wix>
"@ | Set-Content -Encoding UTF8 $wxsPath

    & $wixCmd build $wxsPath -arch x64 -out $msiPath
    Write-Host "Created MSI: $msiPath"
}
finally {
    Pop-Location
}

