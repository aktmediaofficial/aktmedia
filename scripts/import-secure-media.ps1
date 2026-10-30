param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$destination = Join-Path $RepoRoot "artifacts\api-server\media"
New-Item -ItemType Directory -Force -Path $destination | Out-Null

$tracks = @(
    @{ Source = "E:\Studio One\Songs\Don't Be Dumb\Mixdown\Don't Be Dumb.wav"; Name = "Don't Be Dumb.wav" },
    @{ Source = "E:\Studio One\Songs\Ekseni\Mixdown\Ekseni.wav"; Name = "Ekseni.wav" },
    @{ Source = "E:\Studio One\Songs\Masambe\Mixdown\Masambe.wav"; Name = "Masambe.wav" },
    @{ Source = "E:\Studio One\Songs\LO-FI\Mixdown\Money Moves.wav"; Name = "Money Moves.wav" },
    @{ Source = "E:\Studio One\Songs\Drip\Mixdown\Drip.wav"; Name = "Drip.wav" }
)

foreach ($track in $tracks) {
    if (-not (Test-Path -LiteralPath $track.Source)) {
        throw "Missing source file: $($track.Source)"
    }

    $target = Join-Path $destination $track.Name
    Copy-Item -LiteralPath $track.Source -Destination $target -Force
    Write-Host "Copied $($track.Name)"
}

Write-Host ""
Write-Host "Lossless media is ready in: $destination"
Write-Host "The website streams these files only through /api/audio/stream."
