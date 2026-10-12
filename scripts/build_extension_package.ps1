[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('plugin', 'theme')]
    [string] $Type,

    [Parameter(Mandatory = $true)]
    [string] $SourceRoot,

    [Parameter(Mandatory = $true)]
    [string] $OutputZip,

    [string] $ArchiveFolderName = ''
)

$ErrorActionPreference = 'Stop'
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
    throw "Source directory not found: $SourceRoot"
}

$excludeNames = @('.git', '.github', 'node_modules', 'vendor', 'dist', 'tests', '.phpunit.cache', '.phpunit.result.cache', '.php-cs-fixer.cache', '.idea', '.vscode')
$excludePatterns = @('*.log', '.env', '.env.*')

function Test-ExcludedLeaf([string] $Name) {
    foreach ($pattern in $excludePatterns) {
        if ($Name -like $pattern) { return $true }
    }
    return $false
}

$manifestName = if ($Type -eq 'theme') { 'theme.json' } else { 'plugin.json' }
$manifestPath = Join-Path $SourceRoot $manifestName
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Missing $manifestName in $SourceRoot"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string] $manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+') { throw "Invalid version in $manifestName." }

if ([string]::IsNullOrWhiteSpace($ArchiveFolderName)) {
    if ($Type -eq 'theme') {
        $ArchiveFolderName = [string] $manifest.id
    } else {
        $ArchiveFolderName = ''
    }
}

$stageRoot = Join-Path $env:TEMP ("flex-pack-{0}-{1}" -f $Type, [guid]::NewGuid().ToString('N'))
$packRoot = if ($ArchiveFolderName -ne '') { Join-Path $stageRoot $ArchiveFolderName } else { $stageRoot }
New-Item -ItemType Directory -Path $packRoot -Force | Out-Null

try {
    $queue = [System.Collections.Generic.Queue[string]]::new()
    $queue.Enqueue($SourceRoot)
    while ($queue.Count -gt 0) {
        $current = $queue.Dequeue()
        foreach ($entry in Get-ChildItem -LiteralPath $current -Force) {
            if ($excludeNames -contains $entry.Name) { continue }
            if (Test-ExcludedLeaf $entry.Name) { continue }
            $relative = $entry.FullName.Substring($SourceRoot.Length).TrimStart('\', '/')
            $target = Join-Path $packRoot $relative
            if ($entry.PSIsContainer) {
                New-Item -ItemType Directory -Path $target -Force | Out-Null
                $queue.Enqueue($entry.FullName)
            } else {
                $targetDir = Split-Path -Parent $target
                if (-not (Test-Path -LiteralPath $targetDir)) {
                    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                }
                Copy-Item -LiteralPath $entry.FullName -Destination $target -Force
            }
        }
    }

    if (Test-Path -LiteralPath $OutputZip) { Remove-Item -LiteralPath $OutputZip -Force }
    $zipParent = Split-Path -Parent $OutputZip
    if ($zipParent -and -not (Test-Path -LiteralPath $zipParent)) {
        New-Item -ItemType Directory -Path $zipParent -Force | Out-Null
    }
    $zipItems = if ($ArchiveFolderName -ne '') {
        @((Join-Path $stageRoot $ArchiveFolderName))
    } else {
        @(Get-ChildItem -LiteralPath $packRoot | ForEach-Object { $_.FullName })
    }
    Compress-Archive -LiteralPath $zipItems -DestinationPath $OutputZip -CompressionLevel Optimal
    Write-Output $OutputZip
} finally {
    if (Test-Path -LiteralPath $stageRoot) {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
