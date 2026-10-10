$ErrorActionPreference = 'Stop'

$version = '6.2.0'
$expectedHash = 'F2D2B98CE57018D074BE023583CE5D1801240E67DD37344EF7834E63BA7E521F'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$toolsDir = Join-Path $projectRoot 'tools'
$jarPath = Join-Path $toolsDir "jplag-$version.jar"
$downloadUrl = "https://github.com/jplag/JPlag/releases/download/v$version/jplag-$version-jar-with-dependencies.jar"

New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
if (Test-Path -LiteralPath $jarPath) {
    $actualHash = (Get-FileHash -LiteralPath $jarPath -Algorithm SHA256).Hash
    if ($actualHash -eq $expectedHash) {
        Write-Host "JPlag $version is already installed and verified: $jarPath"
        exit 0
    }
    throw "Existing JPlag JAR has an unexpected SHA256 hash: $jarPath. Move it aside manually before retrying."
}

$temporaryPath = Join-Path $toolsDir "jplag-$version.download"
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $temporaryPath
    $actualHash = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) {
        throw "Downloaded JPlag JAR failed SHA256 verification (actual: $actualHash)."
    }
    Move-Item -LiteralPath $temporaryPath -Destination $jarPath
    Write-Host "Installed JPlag ${version}: $jarPath"
} finally {
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath
    }
}
