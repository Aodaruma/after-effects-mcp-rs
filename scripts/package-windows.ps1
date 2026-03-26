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
    $premiereCepPath = Join-Path $repoRoot "src\premiere\cep\mcp-bridge-premiere"
    if (!(Test-Path $premiereCepPath)) {
        throw "Premiere CEP bridge not found: $premiereCepPath"
    }
    $installerBridgeScriptPath = Join-Path $repoRoot "scripts\install-bridge-installer.ps1"
    if (!(Test-Path $installerBridgeScriptPath)) {
        throw "Installer bridge deployment script not found: $installerBridgeScriptPath"
    }

    $stageDir = Join-Path $output "stage"
    Ensure-Directory $stageDir
    Copy-Item $exePath (Join-Path $stageDir "ae-mcp.exe") -Force
    Copy-Item $bridgePanelPath (Join-Path $stageDir "mcp-bridge-auto.jsx") -Force
    $premiereStageDir = Join-Path $stageDir "premiere-cep"
    Ensure-Directory $premiereStageDir
    Copy-Item $premiereCepPath (Join-Path $premiereStageDir "mcp-bridge-premiere") -Recurse -Force
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
    $premiereRoot = Join-Path $stageDir "premiere-cep\mcp-bridge-premiere"
    $escapedPremiereManifest = (Join-Path $premiereRoot "CSXS\manifest.xml").Replace("\", "\\")
    $escapedPremiereIndex = (Join-Path $premiereRoot "index.html").Replace("\", "\\")
    $escapedPremiereCss = (Join-Path $premiereRoot "css\styles.css").Replace("\", "\\")
    $escapedPremiereJs = (Join-Path $premiereRoot "js\main.js").Replace("\", "\\")
    $escapedPremiereJsx = (Join-Path $premiereRoot "jsx\bridge.jsx").Replace("\", "\\")

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
        <Directory Id="PremiereCepRoot" Name="premiere-cep">
          <Directory Id="PremiereCepExtension" Name="mcp-bridge-premiere">
            <Directory Id="PremiereCepCsxs" Name="CSXS">
              <Component Id="PremiereBridgeManifestComponent" Guid="B6F8D17F-1D0E-42B8-B13E-17F6C8D4E5B1">
                <File Id="PremiereBridgeManifestFile" Source="$escapedPremiereManifest" KeyPath="yes" />
              </Component>
            </Directory>
            <Directory Id="PremiereCepCss" Name="css">
              <Component Id="PremiereBridgeCssComponent" Guid="D8C77E1B-9D3E-4D74-91E7-98A9D1F9B8B1">
                <File Id="PremiereBridgeCssFile" Source="$escapedPremiereCss" KeyPath="yes" />
              </Component>
            </Directory>
            <Directory Id="PremiereCepJs" Name="js">
              <Component Id="PremiereBridgeJsComponent" Guid="0E5C32E5-5E2B-4AF0-A3C2-7BE2C2B6A6E7">
                <File Id="PremiereBridgeJsFile" Source="$escapedPremiereJs" KeyPath="yes" />
              </Component>
            </Directory>
            <Directory Id="PremiereCepJsx" Name="jsx">
              <Component Id="PremiereBridgeJsxComponent" Guid="A7E7F6A2-52A9-4E9A-8B1F-9F7855DD6F4B">
                <File Id="PremiereBridgeJsxFile" Source="$escapedPremiereJsx" KeyPath="yes" />
              </Component>
            </Directory>
            <Component Id="PremiereBridgeIndexComponent" Guid="5D1D4F77-98D5-4A6B-9F93-3D60B610B1F0">
              <File Id="PremiereBridgeIndexFile" Source="$escapedPremiereIndex" KeyPath="yes" />
            </Component>
          </Directory>
        </Directory>
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
      <ComponentRef Id="PremiereBridgeManifestComponent" />
      <ComponentRef Id="PremiereBridgeCssComponent" />
      <ComponentRef Id="PremiereBridgeJsComponent" />
      <ComponentRef Id="PremiereBridgeJsxComponent" />
      <ComponentRef Id="PremiereBridgeIndexComponent" />
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
