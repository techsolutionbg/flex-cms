[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $PluginId,

    [Parameter(Mandatory = $true)]
    [string] $Version,

    [Parameter(Mandatory = $true)]
    [string] $Artifact,

    [string] $ReleaseNotes = '',
    [string] $PrivateKeyFile,
    [string] $KeyId,
    [string] $CompatibleFrom = '>=0.1.56 <1.0.0',
    [string] $Name = '',
    [string] $Description = '',
    [string] $MinimumPlatformVersion = '0.1.56'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$settings = @{}
$settingsPath = Join-Path $root '.publish.env'

if (Test-Path -LiteralPath $settingsPath) {
    foreach ($line in Get-Content -LiteralPath $settingsPath -Encoding UTF8) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[-1] -eq '"') -or ($value[0] -eq "'" -and $value[-1] -eq "'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $settings[$Matches[1]] = $value
        }
    }
}

function Get-Setting([string] $Name, [string] $Default = '') {
    $processValue = [Environment]::GetEnvironmentVariable($Name)
    if (-not [string]::IsNullOrWhiteSpace($processValue)) { return $processValue }
    if ($settings.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string] $settings[$Name])) { return [string] $settings[$Name] }
    return $Default
}

function Invoke-Native([string] $Executable, [string[]] $Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE." }
}

if ($PluginId -notmatch '^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$') {
    throw 'PluginId must look like vendor/name.'
}
if ($Version -notmatch '^\d+\.\d+\.\d+') { throw 'Version must be semantic.' }
if (-not (Test-Path -LiteralPath $Artifact -PathType Leaf)) { throw "Artifact not found: $Artifact" }

$baseUrl = (Get-Setting 'UPDATE_SERVER_BASE_URL' (Get-Setting 'UPDATE_SERVER_URL' 'https://updates-flex-cms.kriskata.com')).TrimEnd('/')
$sshTarget = Get-Setting 'UPDATE_SSH_TARGET' 'kriskata-hosting'
$remoteRoot = (Get-Setting 'UPDATE_REMOTE_ROOT' 'updates-flex-cms.kriskata.com').TrimEnd('/')
$keyId = if ([string]::IsNullOrWhiteSpace($KeyId)) { Get-Setting 'UPDATE_SIGNING_KEY_ID' 'release-2026-v3' } else { $KeyId }
if ([string]::IsNullOrWhiteSpace($PrivateKeyFile)) { $PrivateKeyFile = Get-Setting 'UPDATE_SIGNING_PRIVATE_KEY_FILE' }
if ([string]::IsNullOrWhiteSpace($PrivateKeyFile)) { throw 'Set UPDATE_SIGNING_PRIVATE_KEY_FILE in .publish.env.' }
if (-not [System.IO.Path]::IsPathRooted($PrivateKeyFile)) { $PrivateKeyFile = Join-Path $root $PrivateKeyFile }
if (-not (Test-Path -LiteralPath $PrivateKeyFile -PathType Leaf)) { throw 'Signing key file does not exist.' }

$pluginSlug = ($PluginId -split '/')[-1]
$artifactName = "{0}-{1}.zip" -f $pluginSlug, $Version
$checksum = (Get-FileHash -LiteralPath $Artifact -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $Artifact).Length
$remoteReleaseDirectory = "$remoteRoot/plugins/$PluginId/releases/$Version"
$remoteManifestPath = "$remoteRoot/plugins/$PluginId/manifest.json"
$remoteIndexPath = "$remoteRoot/plugins/index.json"
$remoteKeyPath = '/tmp/flex-update-private.key'
$releaseEntryPath = Join-Path $env:TEMP "flex-plugin-$pluginSlug-$Version.json"
$signedEntryPath = Join-Path $env:TEMP "flex-plugin-$pluginSlug-$Version-signed.json"
$manifestPath = Join-Path $env:TEMP "flex-plugin-$pluginSlug-manifest.json"
$indexPath = Join-Path $env:TEMP "flex-plugins-index.json"
$appContainer = ''
$keyWasCopied = $false

try {
    Push-Location $root
    foreach ($tool in @('docker', 'ssh', 'scp')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command is not available: $tool" }
    }

    $appContainer = ((& docker compose ps -q app) | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($appContainer)) { throw 'Start the Docker app container first.' }

    Invoke-Native 'docker' @('cp', $PrivateKeyFile, "${appContainer}:$remoteKeyPath")
    $keyWasCopied = $true

    $releaseEntry = [ordered]@{
        schema = 1
        package = $PluginId
        type = 'plugin'
        version = $Version
        channel = 'stable'
        download_url = "$baseUrl/plugins/$PluginId/releases/$Version/$artifactName"
        checksum = $checksum
        size = $size
        minimum_php = '>=8.3'
        compatible_from = $CompatibleFrom
        published_at = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:sszzz")
        release_notes = $ReleaseNotes
    }
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($releaseEntryPath, ($releaseEntry | ConvertTo-Json -Depth 8), $utf8)
    Invoke-Native 'docker' @('cp', $releaseEntryPath, "${appContainer}:/tmp/flex-release-entry.json")
    Invoke-Native 'docker' @('exec', $appContainer, 'php', 'bin/flex', 'updates:sign-manifest', '/tmp/flex-release-entry.json', '/tmp/flex-release-entry-signed.json', "--private-key-file=$remoteKeyPath", "--key-id=$keyId")
    Invoke-Native 'docker' @('cp', "${appContainer}:/tmp/flex-release-entry-signed.json", $signedEntryPath)

    $manifest = $null
    try {
        Invoke-WebRequest -Uri "$baseUrl/plugins/$PluginId/manifest.json" -UseBasicParsing -OutFile $manifestPath -TimeoutSec 30
    } catch {
        $statusCode = 0
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $statusCode = [int] $_.Exception.Response.StatusCode }
        if ($statusCode -ne 404) { throw }
        [System.IO.File]::WriteAllText($manifestPath, (@{ schema = 1; repository = 'flex-cms'; type = 'plugin'; releases = @() } | ConvertTo-Json -Depth 8), $utf8)
    }
    Invoke-Native 'docker' @('cp', $manifestPath, "${appContainer}:/tmp/flex-existing-catalog.json")
    Invoke-Native 'docker' @('cp', $signedEntryPath, "${appContainer}:/tmp/flex-release-entry-signed.json")
    Invoke-Native 'docker' @('exec', $appContainer, 'php', 'scripts/merge_update_catalog.php', '/tmp/flex-existing-catalog.json', '/tmp/flex-release-entry-signed.json', '/tmp/flex-merged-catalog.json', $remoteKeyPath)
    Invoke-Native 'docker' @('cp', "${appContainer}:/tmp/flex-merged-catalog.json", $manifestPath)

    try {
        Invoke-WebRequest -Uri "$baseUrl/plugins/index.json" -UseBasicParsing -OutFile $indexPath -TimeoutSec 30
        $index = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        $index = [pscustomobject]@{ schema = 1; repository = 'flex-cms'; type = 'plugin'; plugins = @() }
    }
    if (-not $index.plugins) { $index | Add-Member -NotePropertyName plugins -NotePropertyValue @() -Force }
    $plugins = @($index.plugins | Where-Object { $_.id -ne $PluginId })
    $manifestUrl = "$baseUrl/plugins/$PluginId/manifest.json"
    $entry = [ordered]@{
        id = $PluginId
        name = $(if ($Name) { $Name } else { $PluginId })
        description = $Description
        author = 'Flex'
        manifest_url = $manifestUrl
        minimum_platform_version = $MinimumPlatformVersion
        permissions = @('admin.ui', 'routes.admin', 'routes.public', 'frontend.assets')
    }
    $plugins += [pscustomobject]$entry
    $index.plugins = @($plugins | Sort-Object id)
    [System.IO.File]::WriteAllText($indexPath, ($index | ConvertTo-Json -Depth 16), $utf8)

    Write-Host 'Uploading plugin package...'
    Invoke-Native 'ssh' @($sshTarget, "mkdir -p '$remoteReleaseDirectory' '$remoteRoot/plugins/$PluginId'")
    Invoke-Native 'scp' @((Resolve-Path $Artifact).Path, "$sshTarget`:$remoteReleaseDirectory/$artifactName")
    $shaFile = Join-Path $env:TEMP "$artifactName.sha256"
    Set-Content -LiteralPath $shaFile -Value "$checksum  $artifactName" -Encoding ascii
    Invoke-Native 'scp' @($shaFile, "$sshTarget`:$remoteReleaseDirectory/$artifactName.sha256")

    $manifestTmp = "$remoteManifestPath.tmp-$([guid]::NewGuid().ToString('N'))"
    $indexTmp = "$remoteIndexPath.tmp-$([guid]::NewGuid().ToString('N'))"
    Invoke-Native 'scp' @($manifestPath, "$sshTarget`:$manifestTmp")
    Invoke-Native 'scp' @($indexPath, "$sshTarget`:$indexTmp")
    Invoke-Native 'ssh' @($sshTarget, "mv -f '$manifestTmp' '$remoteManifestPath' && mv -f '$indexTmp' '$remoteIndexPath'")

    Write-Host "Published plugin $PluginId $Version to $baseUrl"
    Write-Host "Manifest: $manifestUrl"
    Write-Host "Package: $baseUrl/plugins/$PluginId/releases/$Version/$artifactName"
} finally {
    if ($keyWasCopied -and $appContainer) {
        & docker exec $appContainer rm -f $remoteKeyPath /tmp/flex-release-entry.json /tmp/flex-release-entry-signed.json /tmp/flex-existing-catalog.json /tmp/flex-merged-catalog.json | Out-Null
    }
    foreach ($temporaryPath in @($releaseEntryPath, $signedEntryPath, $manifestPath, $indexPath)) {
        if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue }
    }
    Pop-Location -ErrorAction SilentlyContinue
}
