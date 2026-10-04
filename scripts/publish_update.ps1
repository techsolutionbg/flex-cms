[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $TargetVersion,

    [string] $ReleaseNotes = '',
    [string] $PrivateKeyFile,
    [string] $KeyId,
    [string] $CompatibleFrom,
    [switch] $RunMigrations
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$settings = @{}
$settingsPath = Join-Path $root '.publish.env'

if (Test-Path -LiteralPath $settingsPath) {
    foreach ($line in Get-Content -LiteralPath $settingsPath) {
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
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE."
    }
}

if ($TargetVersion -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
    throw 'TargetVersion must use Semantic Versioning, for example 0.1.43.'
}

$baseUrl = (Get-Setting 'UPDATE_SERVER_BASE_URL' (Get-Setting 'UPDATE_SERVER_URL' 'https://updates-flex-cms.kriskata.com')).TrimEnd('/')
$sshTarget = Get-Setting 'UPDATE_SSH_TARGET' 'kriskata-hosting'
$remoteRoot = (Get-Setting 'UPDATE_REMOTE_ROOT' 'updates-flex-cms.kriskata.com').TrimEnd('/')
$keyId = if ([string]::IsNullOrWhiteSpace($KeyId)) { Get-Setting 'UPDATE_SIGNING_KEY_ID' 'release-2026-v2' } else { $KeyId }
$compatibleFrom = if ([string]::IsNullOrWhiteSpace($CompatibleFrom)) { Get-Setting 'UPDATE_COMPATIBLE_FROM' '>=0.1.0 <1.0.0' } else { $CompatibleFrom }
if ([string]::IsNullOrWhiteSpace($PrivateKeyFile)) { $PrivateKeyFile = Get-Setting 'UPDATE_SIGNING_PRIVATE_KEY_FILE' }
if ([string]::IsNullOrWhiteSpace($PrivateKeyFile)) { throw 'Set UPDATE_SIGNING_PRIVATE_KEY_FILE in .publish.env or pass --private-key-file.' }
if (-not [System.IO.Path]::IsPathRooted($PrivateKeyFile)) { $PrivateKeyFile = Join-Path $root $PrivateKeyFile }
if (-not (Test-Path -LiteralPath $PrivateKeyFile -PathType Leaf)) { throw 'The configured signing key file does not exist.' }
if ($baseUrl -notmatch '^https://[^/]+(?:/[^?#]*)?$') { throw 'UPDATE_SERVER_BASE_URL must be an HTTPS URL.' }
if ($sshTarget -notmatch '^[A-Za-z0-9_.@-]+$') { throw 'UPDATE_SSH_TARGET must be an SSH alias or user@host without spaces.' }
if ($remoteRoot -notmatch '^[A-Za-z0-9_./-]+$' -or $remoteRoot.StartsWith('/')) { throw 'UPDATE_REMOTE_ROOT must be a relative remote path.' }

$gitStatus = @(& git -C $root status --porcelain --untracked-files=normal)
if ($LASTEXITCODE -ne 0) { throw 'Git status could not be read.' }
$publishRelevantChanges = @($gitStatus | Where-Object { $_ -notmatch 'resources/admin-react/dist/' })
if ($publishRelevantChanges.Count -gt 0) {
    throw 'Commit or stash platform source changes before publishing. Releases are built from committed code.'
}

$appContainer = ''
$remoteKeyPath = '/tmp/flex-update-private.key'
$releaseEntryPath = Join-Path $env:TEMP "flex-release-$TargetVersion.json"
$signedEntryPath = Join-Path $env:TEMP "flex-release-$TargetVersion-signed.json"
$catalogPath = Join-Path $env:TEMP "flex-platform-manifest-$TargetVersion.json"
$artifactRelative = "releases/$TargetVersion/flex-cms-$TargetVersion.zip"
$artifactPath = Join-Path $root ("releases/{0}/flex-cms-{0}.zip" -f $TargetVersion)
$checksumPath = "$artifactPath.sha256"
$remoteReleaseDirectory = "$remoteRoot/platform/releases/$TargetVersion"
$catalogTemporary = "$remoteRoot/platform/manifest.json.tmp-$([guid]::NewGuid().ToString('N'))"
$keyWasCopied = $false

try {
    Push-Location $root
    try {
        foreach ($tool in @('docker', 'ssh', 'scp')) {
            if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command is not available: $tool" }
        }

        Write-Host 'Building production admin assets...'
        Invoke-Native 'docker' @('compose', 'run', '--rm', '--no-deps', '-T', 'frontend', 'sh', '-c', 'npm ci && npm run build')
        Invoke-Native 'docker' @('compose', 'run', '--rm', '--no-deps', '-T', 'frontend-react', 'sh', '-c', 'npm ci && npm run build:installer')

        Write-Host 'Building the PHP app image with signing support...'
        Invoke-Native 'docker' @('compose', 'up', '-d', '--no-deps', '--build', 'app')
        $appContainer = ((& docker compose ps -q app) | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($appContainer)) {
            throw 'The app container must be running. Start the development Docker stack first.'
        }

        Write-Host 'Copying the signing key into the app container...'
        Invoke-Native 'docker' @('cp', $PrivateKeyFile, "${appContainer}:$remoteKeyPath")
        $keyWasCopied = $true

        $buildArgs = @('exec', '-T', $appContainer, 'php', 'bin/flex', 'platform:build', "--target-version=$TargetVersion", "--private-key-file=$remoteKeyPath", "--key-id=$keyId", "--compatible-from=$compatibleFrom", "--output=/var/www/html/$artifactRelative")
        if ($RunMigrations) { $buildArgs += '--run-migrations' }
        Write-Host "Building signed platform package $TargetVersion..."
        Invoke-Native 'docker' $buildArgs

        $artifactDirectory = Split-Path -Parent $artifactPath
        New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
        Invoke-Native 'docker' @('cp', "${appContainer}:/var/www/html/$artifactRelative", $artifactPath)
        Invoke-Native 'docker' @('cp', "${appContainer}:/var/www/html/$artifactRelative.sha256", $checksumPath)

        Write-Host 'Reading the existing update catalog...'
        try {
            $catalog = Invoke-RestMethod -Uri "$baseUrl/platform/manifest.json" -TimeoutSec 30
        } catch {
            $statusCode = 0
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $statusCode = [int] $_.Exception.Response.StatusCode }
            if ($statusCode -ne 404) { throw }
            $catalog = @{ schema = 1; releases = @() }
        }
        if (-not $catalog.releases) { $catalog.releases = @() }

        $releaseEntry = [ordered]@{
            schema = 1
            package = 'flex-cms'
            type = 'platform'
            version = $TargetVersion
            channel = 'stable'
            download_url = "$baseUrl/platform/releases/$TargetVersion/flex-cms-$TargetVersion.zip"
            checksum = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
            size = (Get-Item -LiteralPath $artifactPath).Length
            minimum_php = '>=8.3'
            compatible_from = $compatibleFrom
            published_at = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
            release_notes = $ReleaseNotes
        }
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($releaseEntryPath, ($releaseEntry | ConvertTo-Json -Depth 8), $utf8)
        Invoke-Native 'docker' @('cp', $releaseEntryPath, "${appContainer}:/tmp/flex-release-entry.json")
        Invoke-Native 'docker' @('exec', '-T', $appContainer, 'php', 'bin/flex', 'updates:sign-manifest', '/tmp/flex-release-entry.json', '/tmp/flex-release-entry-signed.json', "--private-key-file=$remoteKeyPath", "--key-id=$keyId")
        Invoke-Native 'docker' @('cp', "${appContainer}:/tmp/flex-release-entry-signed.json", $signedEntryPath)
        $signedEntry = Get-Content -LiteralPath $signedEntryPath -Raw | ConvertFrom-Json

        $releases = @($catalog.releases | Where-Object { $_.package -ne 'flex-cms' -or $_.version -ne $TargetVersion -or $_.channel -ne 'stable' })
        $releases += $signedEntry
        $catalog.releases = @($releases | Sort-Object package, version, channel)
        [System.IO.File]::WriteAllText($catalogPath, ($catalog | ConvertTo-Json -Depth 16), $utf8)

        Write-Host 'Uploading package and checksum...'
        Invoke-Native 'ssh' @($sshTarget, "mkdir -p '$remoteReleaseDirectory' '$remoteRoot/platform'")
        Invoke-Native 'scp' @($artifactPath, "$sshTarget`:$remoteReleaseDirectory/flex-cms-$TargetVersion.zip")
        Invoke-Native 'scp' @($checksumPath, "$sshTarget`:$remoteReleaseDirectory/flex-cms-$TargetVersion.zip.sha256")

        Write-Host 'Publishing the update catalog last...'
        Invoke-Native 'scp' @($catalogPath, "$sshTarget`:$catalogTemporary")
        Invoke-Native 'ssh' @($sshTarget, "mv -f '$catalogTemporary' '$remoteRoot/platform/manifest.json'")
        Write-Host "Published platform $TargetVersion to $baseUrl"
        Write-Host "Local package: $artifactPath"
    } finally {
        Pop-Location
    }
} finally {
    if ($keyWasCopied -and $appContainer) {
        & docker exec $appContainer rm -f $remoteKeyPath /tmp/flex-release-entry.json /tmp/flex-release-entry-signed.json | Out-Null
    }
    foreach ($temporaryPath in @($releaseEntryPath, $signedEntryPath, $catalogPath)) {
        if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
    }
}
