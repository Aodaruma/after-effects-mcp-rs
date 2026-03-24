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
    $bridgePanelPath = Join-Path $repoRoot "src\scripts\mcp-bridge-auto.jsx"
    if (!(Test-Path $bridgePanelPath)) {
        throw "Bridge panel script not found: $bridgePanelPath"
    }
    $installerBridgeScriptPath = Join-Path $repoRoot "scripts\install-bridge-installer.ps1"
    if (!(Test-Path $installerBridgeScriptPath)) {
        throw "Installer bridge deployment script not found: $installerBridgeScriptPath"
    }

    $stageDir = Join-Path $output "stage"
    Ensure-Directory $stageDir
    Copy-Item $exePath (Join-Path $stageDir "ae-mcp.exe") -Force
    Copy-Item $bridgePanelPath (Join-Path $stageDir "mcp-bridge-auto.jsx") -Force
    Copy-Item $installerBridgeScriptPath (Join-Path $stageDir "install-bridge-installer.ps1") -Force

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
    $escapedBridgePanel = (Join-Path $stageDir "mcp-bridge-auto.jsx").Replace("\", "\\")
    $escapedBridgeInstallerPs1 = (Join-Path $stageDir "install-bridge-installer.ps1").Replace("\", "\\")

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
        <Component Id="BridgeAssetsComponent" Guid="6EFCE0CF-7EFD-4A28-9DF9-9A4B1A16F9D4">
          <File Id="BridgePanelFile" Source="$escapedBridgePanel" KeyPath="yes" />
          <File Id="BridgeInstallerScriptFile" Source="$escapedBridgeInstallerPs1" />
        </Component>
      </Directory>
    </StandardDirectory>
    <CustomAction Id="InstallAeBridgePanels"
                  Directory="INSTALLFOLDER"
                  ExeCommand="&quot;[System64Folder]WindowsPowerShell\v1.0\powershell.exe&quot; -NoProfile -ExecutionPolicy Bypass -File &quot;[INSTALLFOLDER]install-bridge-installer.ps1&quot; -BridgeScriptPath &quot;[INSTALLFOLDER]mcp-bridge-auto.jsx&quot;"
                  Execute="deferred"
                  Impersonate="no"
                  Return="ignore" />
    <InstallExecuteSequence>
      <Custom Action="InstallAeBridgePanels" After="InstallFiles" Condition="NOT Installed AND NOT REMOVE" />
    </InstallExecuteSequence>
    <Feature Id="MainFeature" Title="After Effects MCP" Level="1">
      <ComponentRef Id="AeMcpExeComponent" />
      <ComponentRef Id="BridgeAssetsComponent" />
    </Feature>
  </Package>
</Wix>
"@ | Set-Content -Encoding UTF8 $wxsPath

    & $wixCmd build $wxsPath -arch x64 -out $msiPath
    if (!(Test-Path $msiPath)) {
        throw "MSI generation failed. See WiX output above."
    }
    Write-Host "Created MSI: $msiPath"
}
finally {
    Pop-Location
}
