[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('plugin', 'theme')]
    [string] $Type,

    [Parameter(Mandatory = $true)]
    [string] $SourceRoot,

    [Parameter(Mandatory = $true)]
    [string] $OutputZip
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
if (-not $SourceRoot.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'SourceRoot must live inside the Flex CMS project so Docker can read it.'
}

$OutputZip = [System.IO.Path]::GetFullPath($OutputZip)
$outputDir = Split-Path -Parent $OutputZip
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$relative = $SourceRoot.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
$containerSource = "/var/www/html/$relative"
$remoteOut = '/tmp/flex-extension-package.zip'

Push-Location $root
try {
    $container = ((& docker compose ps -q app) | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($container)) {
        throw 'Start the Docker app container before building extension packages.'
    }
    & docker exec $container php /var/www/html/scripts/build_extension_package.php $Type $containerSource $remoteOut
    if ($LASTEXITCODE -ne 0) { throw 'Package build failed inside the app container.' }
    & docker cp "${container}:${remoteOut}" $OutputZip
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the built package from the container.' }
    & docker exec $container rm -f $remoteOut | Out-Null
    Write-Output $OutputZip
} finally {
    Pop-Location
}
